import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/outcomes/rewards
 * Fetch outcome rewards for a user (most recent first)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Fetch outcome rewards for user
    const rewardsSnap = await adminDb
      .collection("outcomeRewards")
      .where("userId", "==", userId)
      .get();

    const rewards = rewardsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort by grantedAt (most recent first) in memory
    rewards.sort((a: any, b: any) => {
      const aTime = a.grantedAt?.seconds || 0;
      const bTime = b.grantedAt?.seconds || 0;
      return bTime - aTime;
    });

    return NextResponse.json({ rewards });
  } catch (error: any) {
    console.error("Error fetching outcome rewards:", error);
    return NextResponse.json(
      { error: "Failed to fetch outcome rewards", details: error.message },
      { status: 500 }
    );
  }
}
