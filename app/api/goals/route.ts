import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const { userId, goalType, targetValue, deadline, title } = await request.json();

    if (!userId || !goalType || !targetValue) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const goal = {
      userId,
      goalType, // 'steps', 'glucose', 'weight', 'bp', 'heartRate'
      targetValue,
      currentValue: 0,
      deadline: deadline || null,
      title: title || `${goalType} goal`,
      status: 'active', // 'active', 'completed', 'failed'
      progress: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('healthGoals').add(goal);

    return NextResponse.json({
      success: true,
      goalId: docRef.id,
      goal
    });
  } catch (error) {
    console.error('Error creating goal:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create goal' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const snapshot = await adminDb
      .collection('healthGoals')
      .where('userId', '==', userId)
      .get();

    let goals = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.().toISOString() || doc.data().createdAt,
      deadline: doc.data().deadline?.toDate?.().toISOString() || doc.data().deadline,
    }));

    // Sort by createdAt in memory (descending)
    goals = goals.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({
      success: true,
      goals
    });
  } catch (error) {
    console.error('Error fetching goals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch goals' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { goalId, updates } = await request.json();

    if (!goalId) {
      return NextResponse.json(
        { success: false, error: 'Goal ID is required' },
        { status: 400 }
      );
    }

    await adminDb
      .collection('healthGoals')
      .doc(goalId)
      .update({
        ...updates,
        updatedAt: FieldValue.serverTimestamp()
      });

    return NextResponse.json({
      success: true,
      message: 'Goal updated successfully'
    });
  } catch (error) {
    console.error('Error updating goal:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update goal' },
      { status: 500 }
    );
  }
}
