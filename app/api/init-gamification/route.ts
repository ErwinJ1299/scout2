import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    console.log('Initializing GamificationProgress for user:', userId);

    // Check if already exists
    const gamificationDoc = await adminDb.collection('GamificationProgress').doc(userId).get();
    
    if (gamificationDoc.exists) {
      return NextResponse.json({ 
        message: 'Already exists', 
        data: gamificationDoc.data() 
      });
    }

    // Get patient data
    const patientDoc = await adminDb.collection('patients').doc(userId).get();
    const patientData = patientDoc.exists ? patientDoc.data() : null;

    console.log('Patient data:', patientData);

    // Create GamificationProgress with current points
    const gamificationData = {
      userId: userId,
      totalPoints: patientData?.points || 370,
      currentStreak: patientData?.streak || 2,
      longestStreak: 7,
      tasksCompletedToday: 0,
      lastTaskCompletedAt: new Date(),
      lastUpdated: new Date(),
    };

    await adminDb.collection('GamificationProgress').doc(userId).set(gamificationData);

    console.log('✅ GamificationProgress initialized:', gamificationData);

    return NextResponse.json({ 
      message: 'GamificationProgress initialized successfully', 
      data: gamificationData 
    });
  } catch (error: any) {
    console.error('Error initializing GamificationProgress:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
