import { NextRequest, NextResponse } from "next/server";
import { getClinicalNotesWithMedicines } from "@/lib/firestore/clinicalNotes";
import { extractMedicinesFromNote } from "@/lib/medicines/extractFromNotes";

/**
 * GET /api/medicines/prescribed
 * Fetch prescribed medicines from clinical notes for a patient
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 10;

    // Validate userId
    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Fetch clinical notes with medicines
    const notes = await getClinicalNotesWithMedicines(userId, limit);

    // Transform to SuggestedMedicineGroup format
    const groups = notes
      .map((note) => {
        const medicines = extractMedicinesFromNote(note.medications, note.note);

        if (medicines.length === 0) return null;

        return {
          noteId: note.id,
          doctorId: note.doctorId,
          doctorName: note.doctorName,
          date: note.createdAt.toISOString(),
          medicines,
        };
      })
      .filter((group) => group !== null);

    console.log(`📋 Found ${groups.length} prescribed medicine groups for user: ${userId}`);

    return NextResponse.json({
      success: true,
      groups,
    });
  } catch (error: any) {
    console.error("Error fetching prescribed medicines:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch prescribed medicines" },
      { status: 500 }
    );
  }
}
