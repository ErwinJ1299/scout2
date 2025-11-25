import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Simplified query - just filter by userId, sort in memory
    const redemptionsSnapshot = await adminDb
      .collection('redemptions')
      .where('userId', '==', userId)
      .get();

    const redemptions = redemptionsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Firestore timestamps to ISO strings for client
        redeemedAt: data.redeemedAt?.toDate?.()?.toISOString() || null,
        expiresAt: data.expiresAt?.toDate?.()?.toISOString() || null,
      };
    });

    // Sort by redeemedAt descending in memory
    redemptions.sort((a: any, b: any) => {
      const dateA = new Date(a.redeemedAt || 0).getTime();
      const dateB = new Date(b.redeemedAt || 0).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({ redemptions }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching redemptions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch redemptions' },
      { status: 500 }
    );
  }
}
