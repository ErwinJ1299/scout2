import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { createOrder } from "@/lib/firestore/medicineOrders";
import { generatePartnerUrl, isPartnerEnabled, getPartnerById } from "@/lib/partners/pharmacyPartners";

/**
 * POST /api/medicines/order
 * Create a medicine order and return redirect URL
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, medicineName, partnerId, source, noteId, prescriptionId } = body;

    // Validate inputs
    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    if (!medicineName || medicineName.trim() === "") {
      return NextResponse.json(
        { error: "medicineName is required and cannot be empty" },
        { status: 400 }
      );
    }

    if (!partnerId) {
      return NextResponse.json(
        { error: "partnerId is required" },
        { status: 400 }
      );
    }

    // Validate partner exists and is enabled
    if (!isPartnerEnabled(partnerId)) {
      return NextResponse.json(
        { error: `Partner ${partnerId} is not available or enabled` },
        { status: 400 }
      );
    }

    // Verify user exists (basic auth check)
    const userDoc = await adminDb.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Generate redirect URL
    let redirectUrl: string;
    try {
      redirectUrl = generatePartnerUrl(partnerId, medicineName.trim());
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || "Failed to generate partner URL" },
        { status: 400 }
      );
    }

    // Create order in Firestore
    const order = await createOrder({
      userId,
      medicineName: medicineName.trim(),
      source: (source as "manual" | "clinical_note" | "prescription_ocr") || "manual",
      partner: partnerId,
      redirectUrl,
      createdAt: new Date(),
      ...(noteId && { noteId }), // Include noteId only if provided
      ...(prescriptionId && { prescriptionId }), // Include prescriptionId only if provided
    });

    console.log(`✅ Medicine order created: ${order.id} for ${medicineName} via ${partnerId} (source: ${source || "manual"})`);

    return NextResponse.json({
      success: true,
      orderId: order.id,
      redirectUrl: order.redirectUrl,
    });
  } catch (error: any) {
    console.error("Error creating medicine order:", error);
    return NextResponse.json(
      { error: "Failed to create order", details: error.message },
      { status: 500 }
    );
  }
}
