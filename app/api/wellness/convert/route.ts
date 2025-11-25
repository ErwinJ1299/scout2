import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const HP_TO_WC_RATIO = 50; // 1 WC = 50 HP
const DAILY_HP_LIMIT = 2000; // Max 2000 HP conversion per day

export async function POST(request: NextRequest) {
  try {
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
      // Get gamification progress for HP
      const gamificationRef = adminDb.collection('GamificationProgress').doc(userId);
      const gamificationDoc = await transaction.get(gamificationRef);
      
      if (!gamificationDoc.exists) {
        throw new Error('Gamification progress not found');
      }
      
      const gamificationData = gamificationDoc.data();
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

      // Update gamification progress (deduct HP)
      transaction.update(gamificationRef, {
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
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    // Get gamification progress for HP
    const gamificationDoc = await adminDb.collection('GamificationProgress').doc(userId).get();
    const gamificationData = gamificationDoc.exists ? gamificationDoc.data() : null;
    const currentHP = gamificationData?.totalPoints || 0;

    console.log('Wellness API - Get conversion info:', {
      userId,
      gamificationExists: gamificationDoc.exists,
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
