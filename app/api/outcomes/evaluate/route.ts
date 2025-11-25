import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import {
  evaluateAllRules,
  grantOutcomeReward,
} from '@/lib/outcomes/evaluator';
import { OutcomeEvaluationResult, OutcomeRule, Challenge } from '@/types';

/**
 * POST /api/outcomes/evaluate
 * 
 * Evaluates all active outcome rules for the authenticated user
 * and grants rewards for eligible improvements.
 * 
 * Flow:
 * 1. Verify user authentication
 * 2. Fetch and evaluate all active outcome rules
 * 3. For each eligible rule, grant rewards via transaction
 * 4. Return summary of granted rewards
 * 
 * This endpoint should be called from:
 * - /patient/progress (on page load)
 * - /patient/wellness (wallet tab)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    console.log(`🎯 Evaluating outcome rewards for user: ${userId}`);

    // Evaluate all active rules
    const evaluationResults = await evaluateAllRules(adminDb, userId);

    console.log(`📊 Evaluated ${evaluationResults.length} rules`);

    // Filter eligible results
    const eligibleResults = evaluationResults.filter((result) => result.eligible);

    console.log(`✅ Found ${eligibleResults.length} eligible improvements`);

    // Grant rewards for each eligible result
    const grantedRewards: any[] = [];

    for (const result of eligibleResults) {
      try {
        // Fetch the full rule to pass to grantOutcomeReward
        const ruleDoc = await adminDb.collection('outcomeRules').doc(result.ruleId).get();
        
        if (!ruleDoc.exists) {
          console.warn(`Rule ${result.ruleId} not found`);
          continue;
        }

        const rule: OutcomeRule = {
          id: ruleDoc.id,
          ...ruleDoc.data(),
        } as OutcomeRule;

        // Grant the reward using transaction
        const outcomeReward = await grantOutcomeReward(adminDb, userId, rule, result);

        grantedRewards.push({
          ruleId: result.ruleId,
          metric: result.metric,
          improvementValue: result.improvementValue,
          rewardHp: result.rewardHp,
          rewardWc: result.rewardWc,
          description: rule.description,
        });

        console.log(`✨ Granted reward: ${rule.description} (+${result.rewardHp} HP, +${result.rewardWc} WC)`);
      } catch (error) {
        console.error(`Failed to grant reward for ${result.ruleId}:`, error);
      }
    }

    // Build response
    const response: Challenge = {
      granted: grantedRewards,
      checkedRules: evaluationResults.length,
      message:
        grantedRewards.length > 0
          ? `🎉 ${grantedRewards.length} outcome reward${grantedRewards.length > 1 ? 's' : ''} granted!`
          : 'No new outcome rewards yet. Keep up the good work!',
    };

    console.log(`🎁 Response: ${response.message}`);

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('❌ Outcome evaluation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to evaluate outcomes' },
      { status: 500 }
    );
  }
}
