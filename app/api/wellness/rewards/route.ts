import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  try {
    // Simplified query - just get active rewards without sorting
    // We'll sort on the server side after fetching to avoid needing a composite index
    const rewardsSnapshot = await adminDb
      .collection("rewards")
      .where("active", "==", true)
      .get();

    const rewards = rewardsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort by costTokens on server side after fetching
    rewards.sort((a: any, b: any) => a.costTokens - b.costTokens);

    return NextResponse.json({ rewards });
  } catch (error) {
    console.error("Error fetching rewards:", error);
    return NextResponse.json(
      { error: "Failed to fetch rewards" },
      { status: 500 }
    );
  }
}

