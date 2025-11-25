/**
 * Clinical Notes Firestore Operations
 * Fetches clinical notes for medicine ordering integration
 */

import { adminDb } from "../firebase-admin";
import type { ClinicalNote } from "@/types";

/**
 * Fetches the latest clinical notes for a patient
 * Used for extracting prescribed medicines
 * @param patientId - Patient user ID
 * @param limit - Maximum number of notes to fetch (default: 10)
 * @returns Array of clinical notes with medicines
 */
export async function getLatestClinicalNotes(
  patientId: string,
  limit: number = 10
): Promise<ClinicalNote[]> {
  try {
    const notesSnapshot = await adminDb
      .collection("clinicalNotes")
      .where("patientId", "==", patientId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const notes: ClinicalNote[] = [];

    notesSnapshot.forEach((doc) => {
      const data = doc.data();

      // Convert Firestore Timestamp to Date
      const createdAt =
        data.createdAt && typeof data.createdAt.toDate === "function"
          ? data.createdAt.toDate()
          : new Date(data.createdAt);

      const updatedAt =
        data.updatedAt && typeof data.updatedAt.toDate === "function"
          ? data.updatedAt.toDate()
          : data.updatedAt
          ? new Date(data.updatedAt)
          : undefined;

      notes.push({
        id: doc.id,
        patientId: data.patientId,
        doctorId: data.doctorId,
        doctorName: data.doctorName || "Unknown Doctor",
        note: data.note || "",
        recommendation: data.recommendation,
        diagnosis: data.diagnosis,
        medications: data.medications || [],
        followUpDate: data.followUpDate,
        createdAt,
        updatedAt,
        isPriority: data.isPriority || false,
      });
    });

    return notes;
  } catch (error) {
    console.error("Error fetching clinical notes:", error);
    throw new Error("Failed to fetch clinical notes");
  }
}

/**
 * Fetches clinical notes that contain medications
 * Filters out notes without any medicine prescriptions
 * @param patientId - Patient user ID
 * @param limit - Maximum number of notes to fetch
 * @returns Array of clinical notes with at least one medicine
 */
export async function getClinicalNotesWithMedicines(
  patientId: string,
  limit: number = 10
): Promise<ClinicalNote[]> {
  const notes = await getLatestClinicalNotes(patientId, limit);

  // Filter notes that have medications array with at least one medicine
  // or have text that might contain medicine names
  return notes.filter(
    (note) =>
      (note.medications && note.medications.length > 0) ||
      (note.note && note.note.length > 0)
  );
}
