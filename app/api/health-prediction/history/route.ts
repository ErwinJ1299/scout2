import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log('📊 Fetching history for user:', userId);

    // Fetch ALL readings for this user using Firebase Admin SDK
    const snapshot = await adminDb
      .collection('readings')
      .where('patientId', '==', userId)
      .get();

    console.log(`✅ Found ${snapshot.size} health metrics`);

    if (snapshot.empty) {
      console.log('⚠️  No health metrics found for user');
      return NextResponse.json({
        success: true,
        history: []
      });
    }

    // Filter to last 30 days and aggregate by date
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyData: { [key: string]: any } = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      const timestamp = data.createdAt?.toDate();
      
      // Skip if older than 30 days
      if (timestamp && timestamp < thirtyDaysAgo) {
        return;
      }

      const date = timestamp ? timestamp.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          heart_rate: [],
          steps: [],
          glucose: [],
          bp_systolic: []
        };
      }

      // Extract readings data
      if (data.heartRate) dailyData[date].heart_rate.push(data.heartRate);
      if (data.steps) dailyData[date].steps.push(data.steps);
      if (data.glucose) dailyData[date].glucose.push(data.glucose);
      if (data.bpSystolic) dailyData[date].bp_systolic.push(data.bpSystolic);
    });

    // Calculate daily averages and sort by date
    const history = Object.values(dailyData)
      .map((day: any) => ({
        date: day.date,
        heart_rate: day.heart_rate.length > 0
          ? day.heart_rate.reduce((a: number, b: number) => a + b, 0) / day.heart_rate.length
          : 0,
        steps: day.steps.length > 0
          ? day.steps.reduce((a: number, b: number) => a + b, 0) / day.steps.length
          : 0,
        glucose: day.glucose.length > 0
          ? day.glucose.reduce((a: number, b: number) => a + b, 0) / day.glucose.length
          : 0,
        bp_systolic: day.bp_systolic.length > 0
          ? day.bp_systolic.reduce((a: number, b: number) => a + b, 0) / day.bp_systolic.length
          : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    console.log(`📈 Returning ${history.length} days of history`);

    return NextResponse.json({
      success: true,
      history
    });

  } catch (error: any) {
    console.error('❌ History API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
