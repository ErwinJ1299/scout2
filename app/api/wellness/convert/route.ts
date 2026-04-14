import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const HP_TO_WC_RATIO = 50; // 1 WC = 50 HP
const DAILY_HP_LIMIT = 2000; // Max 2000 HP conversion per day

export async function POST(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin is not configured' },
        { status: 500 }
      );
    }

    const { userId, hpAmount } = await request.json();

    if (!userId || !hpAmount) {
      return NextResponse.json(
        { error: 'Missing userId or hpAmount' },
        { status: 400 }
      );
    }

    // Validate HP amount
    if (hpAmount <= 0 || hpAmount % HP_TO_WC_RATIO !== 0) {
      return NextResponse.json(
        { error: `HP amount must be a positive multiple of ${HP_TO_WC_RATIO}` },
        { status: 400 }
      );
    }

    const tokensToCredit = hpAmount / HP_TO_WC_RATIO;

    // Run transaction to ensure atomicity
    const result = await adminDb.runTransaction(async (transaction) => {
      // Get HP source. Primary: gamification (current app). Fallback: GamificationProgress (legacy).
      const gamificationRef = adminDb.collection('gamification').doc(userId);
      const legacyGamificationRef = adminDb.collection('GamificationProgress').doc(userId);
      const patientRef = adminDb.collection('patients').doc(userId);

      const gamificationDoc = await transaction.get(gamificationRef);
      const legacyGamificationDoc = gamificationDoc.exists
        ? null
        : await transaction.get(legacyGamificationRef);
      const patientDoc = (!gamificationDoc.exists && !legacyGamificationDoc?.exists)
        ? await transaction.get(patientRef)
        : null;

      const hpSourceDoc = gamificationDoc.exists
        ? gamificationDoc
        : legacyGamificationDoc?.exists
          ? legacyGamificationDoc
          : patientDoc?.exists
            ? patientDoc
            : null;

      if (!hpSourceDoc) {
        throw new Error('No HP source found for this user');
      }

      const hpSourceRef = gamificationDoc.exists
        ? gamificationRef
        : legacyGamificationDoc?.exists
          ? legacyGamificationRef
          : patientRef;

      const gamificationData = hpSourceDoc.data();
      const currentHP = gamificationData?.totalPoints || 0;

      // Get user stats for WC and conversion tracking
      const userStatsRef = adminDb.collection('userStats').doc(userId);
      const userStatsDoc = await transaction.get(userStatsRef);

      const stats = userStatsDoc.exists ? userStatsDoc.data() : {};
      const currentWC = stats?.rewardTokens || 0;
      const totalEarned = stats?.totalTokensEarned || 0;

      // Check if user has enough HP
      if (currentHP < hpAmount) {
        throw new Error(`Insufficient HP. You have ${currentHP} HP but need ${hpAmount} HP`);
      }

      // Check daily conversion limit
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastConversionDate = stats?.lastConversionDate?.toDate?.();
      const isSameDay = lastConversionDate && 
        lastConversionDate.setHours(0, 0, 0, 0) === today.getTime();

      const hpConvertedToday = isSameDay ? (stats?.hpConvertedToday || 0) : 0;

      if (hpConvertedToday + hpAmount > DAILY_HP_LIMIT) {
        throw new Error(
          `Daily conversion limit exceeded. You have converted ${hpConvertedToday} HP today. Limit: ${DAILY_HP_LIMIT} HP/day`
        );
      }

      // Update HP source (deduct HP)
      transaction.update(hpSourceRef, {
        totalPoints: currentHP - hpAmount,
        lastUpdated: FieldValue.serverTimestamp(),
      });

      // Update or create user stats (add WC and track conversion)
      if (userStatsDoc.exists) {
        transaction.update(userStatsRef, {
          rewardTokens: currentWC + tokensToCredit,
          totalTokensEarned: totalEarned + tokensToCredit,
          lastConversionDate: FieldValue.serverTimestamp(),
          hpConvertedToday: hpConvertedToday + hpAmount,
        });
      } else {
        transaction.set(userStatsRef, {
          rewardTokens: tokensToCredit,
          totalTokensEarned: tokensToCredit,
          lastConversionDate: FieldValue.serverTimestamp(),
          hpConvertedToday: hpAmount,
        });
      }

      // Log transaction
      const transactionRef = adminDb.collection('transactions').doc();
      transaction.set(transactionRef, {
        userId,
        type: 'credit',
        source: 'conversion',
        hpUsed: hpAmount,
        tokens: tokensToCredit,
        timestamp: FieldValue.serverTimestamp(),
        description: `Converted ${hpAmount} HP to ${tokensToCredit} WC`,
      });

      return {
        success: true,
        hpDeducted: hpAmount,
        wcCredited: tokensToCredit,
        newHpBalance: currentHP - hpAmount,
        newWcBalance: currentWC + tokensToCredit,
        dailyLimitRemaining: DAILY_HP_LIMIT - (hpConvertedToday + hpAmount),
      };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Conversion error:', error);
    return NextResponse.json(
      { error: error.message || 'Conversion failed' },
      { status: 400 }
    );
  }
}

// Get conversion info
export async function GET(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin is not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    // Get HP from primary source (gamification), fallback to legacy and then patients.
    const gamificationDoc = await adminDb.collection('gamification').doc(userId).get();
    const legacyGamificationDoc = gamificationDoc.exists
      ? null
      : await adminDb.collection('GamificationProgress').doc(userId).get();
    const patientDoc = (!gamificationDoc.exists && !legacyGamificationDoc?.exists)
      ? await adminDb.collection('patients').doc(userId).get()
      : null;

    const hpDoc = gamificationDoc.exists
      ? gamificationDoc
      : legacyGamificationDoc?.exists
        ? legacyGamificationDoc
        : patientDoc?.exists
          ? patientDoc
          : null;

    const gamificationData = hpDoc?.data() || null;
    const currentHP = gamificationData?.totalPoints || 0;

    console.log('Wellness API - Get conversion info:', {
      userId,
      gamificationExists: !!hpDoc,
      gamificationData: gamificationData,
      currentHP: currentHP
    });

    // Get user stats for WC and conversion tracking
    const userStatsDoc = await adminDb.collection('userStats').doc(userId).get();
    const stats = userStatsDoc.exists ? userStatsDoc.data() : null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastConversionDate = stats?.lastConversionDate?.toDate?.();
    const isSameDay = lastConversionDate && 
      lastConversionDate.setHours(0, 0, 0, 0) === today.getTime();

    const hpConvertedToday = isSameDay ? (stats?.hpConvertedToday || 0) : 0;

    return NextResponse.json({
      currentHP: currentHP,
      currentWC: stats?.rewardTokens || 0,
      hpToWcRatio: HP_TO_WC_RATIO,
      dailyLimit: DAILY_HP_LIMIT,
      hpConvertedToday,
      dailyLimitRemaining: DAILY_HP_LIMIT - hpConvertedToday,
      canConvert: currentHP >= HP_TO_WC_RATIO && hpConvertedToday < DAILY_HP_LIMIT,
    }, { status: 200 });
  } catch (error: any) {
    console.error('Get conversion info error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get conversion info' },
      { status: 500 }
    );
  }
}
