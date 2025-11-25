/**
 * Medicine Extraction Utilities
 * Extracts medicine names from clinical note text
 */

/**
 * Extracts medicine names from free-form text
 * Looks for patterns that likely contain medicine names (with dosages)
 * @param text - Raw text from clinical notes
 * @returns Array of extracted medicine names
 */
export function extractMedicinesFromText(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Split by common delimiters: commas, semicolons, newlines
  const segments = text.split(/[,;\n]/g);

  // Filter and clean medicine names
  const medicines = segments
    .map((segment) => segment.trim())
    .filter((segment) => {
      // Must not be empty
      if (segment.length === 0) return false;

      // Should contain numbers (dosage) - crude filter
      // Example: "Metformin 500mg", "Aspirin 75mg"
      if (!segment.match(/[0-9]/)) return false;

      // Filter out very short strings (likely noise)
      if (segment.length < 5) return false;

      // Filter out common non-medicine phrases
      const excludePatterns = [
        /^test/i,
        /^lab/i,
        /^report/i,
        /^visit/i,
        /^follow[\s-]?up/i,
        /^appointment/i,
      ];

      for (const pattern of excludePatterns) {
        if (pattern.test(segment)) return false;
      }

      return true;
    });

  // Remove duplicates
  return Array.from(new Set(medicines));
}

/**
 * Extracts medicines from structured medications array or note text
 * Prefers medications array if available, falls back to text extraction
 * @param medications - Optional array of medicine names from clinical note
 * @param noteText - Raw note text
 * @returns Array of medicine names
 */
export function extractMedicinesFromNote(
  medications: string[] | undefined,
  noteText: string
): string[] {
  // If medications array exists and is not empty, use it
  if (medications && medications.length > 0) {
    return medications.filter((m) => m && m.trim().length > 0);
  }

  // Otherwise, extract from note text
  return extractMedicinesFromText(noteText);
}
