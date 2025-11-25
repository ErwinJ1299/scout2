import { NextRequest, NextResponse } from "next/server";
import { getOrdersForUser } from "@/lib/firestore/medicineOrders";

/**
 * GET /api/medicines/orders
 * Fetch medicine orders for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam) : 20;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const orders = await getOrdersForUser(userId, limit);

    return NextResponse.json({ orders });
  } catch (error: any) {
    console.error("Error fetching medicine orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders", details: error.message },
      { status: 500 }
    );
  }
}
