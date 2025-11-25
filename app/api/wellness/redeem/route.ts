import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Generate short unique redemption code
 * Format: WC-XXXXXX (6 alphanumeric characters)
 */
function generateRedemptionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar-looking characters
  let code = 'WC-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, rewardId } = await request.json();

    // Validate input
    if (!userId || !rewardId) {
      return NextResponse.json(
        { error: 'Missing userId or rewardId' },
        { status: 400 }
      );
    }

    // Run transaction to ensure atomicity
    const result = await adminDb.runTransaction(async (transaction) => {
      // Get user stats
      const userStatsRef = adminDb.collection('userStats').doc(userId);
      const userStatsDoc = await transaction.get(userStatsRef);

      if (!userStatsDoc.exists) {
        throw new Error('User stats not found');
      }

      // Get reward details
      const rewardRef = adminDb.collection('rewards').doc(rewardId);
      const rewardDoc = await transaction.get(rewardRef);

      if (!rewardDoc.exists) {
        throw new Error('Reward not found');
      }

      const reward = rewardDoc.data();
      const stats = userStatsDoc.data();

      // Check if reward is active
      if (!reward?.active) {
        throw new Error('This reward is no longer available');
      }

      // Check stock if applicable
      if (reward.stock !== null && reward.stock !== undefined && reward.stock <= 0) {
        throw new Error('This reward is out of stock');
      }

      const currentWC = stats?.rewardTokens || 0;
      const costTokens = reward.costTokens || 0;

      // Validate user has enough Wellness Coins
      if (currentWC < costTokens) {
        throw new Error(
          `Insufficient Wellness Coins. You have ${currentWC} WC but need ${costTokens} WC`
        );
      }

      // Generate unique redemption code
      const code = generateRedemptionCode();

      // Calculate expiry date (90 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90);

      // Deduct Wellness Coins
      const newWcBalance = currentWC - costTokens;
      const totalSpent = (stats?.totalTokensSpent || 0) + costTokens;

      transaction.update(userStatsRef, {
        rewardTokens: newWcBalance,
        totalTokensSpent: totalSpent,
      });

      // Create redemption record
      const redemptionRef = adminDb.collection('redemptions').doc();
      transaction.set(redemptionRef, {
        userId,
        rewardId,
        rewardTitle: reward.title,
        rewardCategory: reward.category,
        costTokens,
        code,
        status: 'active',
        redeemedAt: FieldValue.serverTimestamp(),
        expiresAt,
        externalUrl: reward.externalUrl || null,
      });

      // Log transaction
      const transactionRef = adminDb.collection('transactions').doc();
      transaction.set(transactionRef, {
        userId,
        type: 'debit',
        source: 'reward_redeem',
        tokens: costTokens,
        timestamp: FieldValue.serverTimestamp(),
        description: `Redeemed: ${reward.title}`,
        redemptionId: redemptionRef.id,
      });

      // Update reward stock if applicable
      if (reward.stock !== null && reward.stock !== undefined) {
        transaction.update(rewardRef, {
          stock: reward.stock - 1,
        });
      }

      // Build redirect URL with coupon code
      let redirectUrl = null;
      if (reward.externalUrl) {
        const url = new URL(reward.externalUrl);
        url.searchParams.set('coupon', code);
        redirectUrl = url.toString();
      }

      return {
        success: true,
        code,
        redirectUrl,
        newBalance: newWcBalance,
        redemptionId: redemptionRef.id,
      };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Redemption error:', error);
    return NextResponse.json(
      { error: error.message || 'Redemption failed' },
      { status: 400 }
    );
  }
}
