/**
 * Outcome-Based Rewards Evaluator
 * 
 * Evaluates health metric improvements over time windows and determines
 * eligibility for outcome-based rewards (HP + WC).
 * 
 * Key Concepts:
 * - Current Window: Last N days of data
 * - Previous Window: N days immediately before current window
 * - Improvement: Calculated delta between windows based on rule direction
 * - Cooldown: Prevents duplicate rewards for same rule within X days
 */

import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { 
  OutcomeRule, 
  OutcomeReward, 
  OutcomeEvaluationResult,
  MetricType 
} from '@/types';

// Timezone: India (IST = UTC+5:30)
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Get current time in IST
 */
function getNowIST(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}

/**
 * Get start of day in IST for a given date
 */
function getStartOfDayIST(date: Date): Date {
  const istDate = new Date(date.getTime() + IST_OFFSET_MS);
  istDate.setUTCHours(0, 0, 0, 0);
  return new Date(istDate.getTime() - IST_OFFSET_MS);
}

/**
 * Calculate time windows for evaluation
 */
export function calculateWindows(windowDays: number, now: Date = getNowIST()) {
  const currentWindowEnd = now;
  const currentWindowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const previousWindowEnd = currentWindowStart;
  const previousWindowStart = new Date(previousWindowEnd.getTime() - windowDays * 24 * 60 * 60 * 1000);

  return {
    current: {
      start: currentWindowStart,
      end: currentWindowEnd,
    },
    previous: {
      start: previousWindowStart,
      end: previousWindowEnd,
    },
  };
}

/**
 * Fetch readings for a specific metric and time range
 */
async function fetchReadings(
  db: Firestore,
  userId: string,
  metric: MetricType,
  startTime: Date,
  endTime: Date
): Promise<number[]> {
  const readingsSnapshot = await db
    .collection('readings')
    .where('patientId', '==', userId)
    .where('createdAt', '>=', Timestamp.fromDate(startTime))
    .where('createdAt', '<=', Timestamp.fromDate(endTime))
    .get();

  const values: number[] = [];

  for (const doc of readingsSnapshot.docs) {
    const data = doc.data();
    let value: number | null = null;

    switch (metric) {
      case 'glucose':
        value = data.glucose;
        break;
      case 'bp':
        // Use systolic BP
        value = data.bpSystolic || data.bloodPressure?.split('/')[0];
        break;
      case 'steps':
        value = data.steps;
        break;
      case 'weight':
        value = data.weight;
        break;
    }

    if (value !== null && value !== undefined && !isNaN(value)) {
      values.push(Number(value));
    }
  }

  return values;
}

/**
 * Calculate average of an array of numbers
 */
function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Check if user received this reward recently (within cooldown period)
 */
async function checkCooldown(
  db: Firestore,
  userId: string,
  ruleId: string,
  cooldownDays: number
): Promise<boolean> {
  const cooldownStart = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000);

  const recentRewardsSnapshot = await db
    .collection('outcomeRewards')
    .where('userId', '==', userId)
    .where('ruleId', '==', ruleId)
    .where('createdAt', '>=', Timestamp.fromDate(cooldownStart))
    .limit(1)
    .get();

  return recentRewardsSnapshot.empty; // True if no recent reward (eligible)
}

/**
 * Evaluate a single outcome rule for a user
 */
export async function evaluateRule(
  db: Firestore,
  userId: string,
  rule: OutcomeRule
): Promise<OutcomeEvaluationResult> {
  const result: OutcomeEvaluationResult = {
    ruleId: rule.id,
    metric: rule.metric,
    eligible: false,
  };

  try {
    // 1. Calculate time windows
    const windows = calculateWindows(rule.windowDays);

    // 2. Fetch readings for both windows
    const [currentReadings, previousReadings] = await Promise.all([
      fetchReadings(db, userId, rule.metric, windows.current.start, windows.current.end),
      fetchReadings(db, userId, rule.metric, windows.previous.start, windows.previous.end),
    ]);

    // 3. Check minimum data requirement (at least 3 readings per window)
    if (currentReadings.length < 3) {
      result.reason = 'Insufficient data in current window (need ≥3 readings)';
      return result;
    }

    if (previousReadings.length < 3) {
      result.reason = 'Insufficient data in previous window (need ≥3 readings)';
      return result;
    }

    // 4. Calculate averages
    const currentAvg = calculateAverage(currentReadings);
    const previousAvg = calculateAverage(previousReadings);

    result.currentAverage = Math.round(currentAvg * 100) / 100;
    result.previousAverage = Math.round(previousAvg * 100) / 100;

    // 5. Calculate improvement based on direction
    let improvementValue: number;

    if (rule.direction === 'decrease') {
      // For metrics that should decrease (glucose, BP, weight)
      improvementValue = previousAvg - currentAvg;
    } else if (rule.direction === 'increase') {
      // For metrics that should increase (steps)
      improvementValue = currentAvg - previousAvg;
    } else {
      result.reason = 'Unsupported direction type';
      return result;
    }

    result.improvementValue = Math.round(improvementValue * 100) / 100;

    // 6. Check if improvement meets threshold
    if (improvementValue < rule.minChange) {
      result.reason = `Improvement ${improvementValue.toFixed(1)} < required ${rule.minChange}`;
      return result;
    }

    // 7. Check target range if specified
    if (rule.targetMin !== undefined && currentAvg < rule.targetMin) {
      result.reason = `Current average ${currentAvg.toFixed(1)} below target min ${rule.targetMin}`;
      return result;
    }

    if (rule.targetMax !== undefined && currentAvg > rule.targetMax) {
      result.reason = `Current average ${currentAvg.toFixed(1)} above target max ${rule.targetMax}`;
      return result;
    }

    // 8. Check cooldown period
    const isEligible = await checkCooldown(db, userId, rule.id, rule.cooldownDays);
    if (!isEligible) {
      result.reason = `Cooldown active (${rule.cooldownDays} days)`;
      return result;
    }

    // 9. All checks passed - eligible for reward!
    result.eligible = true;
    result.rewardHp = rule.rewardHp;
    result.rewardWc = rule.rewardWc;
    result.reason = 'Eligible for outcome reward';

    return result;
  } catch (error) {
    console.error(`Error evaluating rule ${rule.id}:`, error);
    result.reason = 'Evaluation error';
    return result;
  }
}

/**
 * Grant outcome reward using Firestore transaction
 */
export async function grantOutcomeReward(
  db: Firestore,
  userId: string,
  rule: OutcomeRule,
  evaluationResult: OutcomeEvaluationResult
): Promise<OutcomeReward> {
  const windows = calculateWindows(rule.windowDays);

  return await db.runTransaction(async (transaction) => {
    // 1. Get user stats
    const userStatsRef = db.collection('userStats').doc(userId);
    const userStatsDoc = await transaction.get(userStatsRef);

    if (!userStatsDoc.exists) {
      throw new Error('User stats not found');
    }

    const stats = userStatsDoc.data();
    const currentHP = stats?.totalPoints || 0;
    const currentWC = stats?.rewardTokens || 0;
    const totalEarned = stats?.totalTokensEarned || 0;

    // 2. Update user stats
    transaction.update(userStatsRef, {
      totalPoints: currentHP + evaluationResult.rewardHp!,
      rewardTokens: currentWC + evaluationResult.rewardWc!,
      totalTokensEarned: totalEarned + evaluationResult.rewardWc!,
    });

    // 3. Create outcome reward record
    const outcomeRewardRef = db.collection('outcomeRewards').doc();
    const outcomeReward: Partial<OutcomeReward> = {
      userId,
      metric: rule.metric,
      ruleId: rule.id,
      periodStart: Timestamp.fromDate(windows.current.start),
      periodEnd: Timestamp.fromDate(windows.current.end),
      improvementValue: evaluationResult.improvementValue!,
      currentAverage: evaluationResult.currentAverage!,
      previousAverage: evaluationResult.previousAverage!,
      rewardHp: evaluationResult.rewardHp!,
      rewardWc: evaluationResult.rewardWc!,
      createdAt: Timestamp.now(),
    };

    transaction.set(outcomeRewardRef, outcomeReward);

    // 4. Log transaction for tracking
    const transactionRef = db.collection('transactions').doc();
    transaction.set(transactionRef, {
      userId,
      type: 'credit',
      source: 'outcome_reward',
      hpUsed: 0,
      tokens: evaluationResult.rewardWc!,
      timestamp: Timestamp.now(),
      description: `Outcome Reward: ${rule.description}`,
      outcomeRewardId: outcomeRewardRef.id,
    });

    return {
      id: outcomeRewardRef.id,
      ...outcomeReward,
    } as OutcomeReward;
  });
}

/**
 * Evaluate all active outcome rules for a user
 */
export async function evaluateAllRules(
  db: Firestore,
  userId: string
): Promise<OutcomeEvaluationResult[]> {
  // Fetch all active outcome rules
  const rulesSnapshot = await db
    .collection('outcomeRules')
    .where('active', '==', true)
    .get();

  const rules: OutcomeRule[] = rulesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as OutcomeRule[];

  // Evaluate each rule
  const results: OutcomeEvaluationResult[] = [];

  for (const rule of rules) {
    const result = await evaluateRule(db, userId, rule);
    results.push(result);
  }

  return results;
}
