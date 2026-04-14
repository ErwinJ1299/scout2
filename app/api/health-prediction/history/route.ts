import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

function toDate(value: any): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

function extractTimestamp(data: any): Date | undefined {
  return toDate(data.createdAt) || toDate(data.timestamp) || toDate(data.recordedAt) || toDate(data.date);
}

function toNumber(value: any): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function pickMetric(data: any, keys: string[]): number | undefined {
  for (const key of keys) {
    const n = toNumber(data[key]);
    if (typeof n === 'number') return n;
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json(
        {
          success: false,
          error: 'Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.',
        },
        { status: 500 }
      );
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log('📊 Fetching history for user:', userId);

    // Fetch ALL readings for this user using Firebase Admin SDK
    let snapshot = await adminDb
      .collection('readings')
      .where('patientId', '==', userId)
      .get();

    // Support legacy schema where readings are saved with userId instead of patientId.
    if (snapshot.empty) {
      const legacySnapshot = await adminDb
        .collection('readings')
        .where('userId', '==', userId)
        .get();
      if (!legacySnapshot.empty) {
        snapshot = legacySnapshot;
      }
    }

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

    const docs = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return { data, timestamp: extractTimestamp(data) };
      })
      .sort((a, b) => {
        const aTs = a.timestamp?.getTime() ?? 0;
        const bTs = b.timestamp?.getTime() ?? 0;
        return aTs - bTs;
      });

    const recentDocs = docs.filter((item) => {
      if (!item.timestamp) return true;
      return item.timestamp >= thirtyDaysAgo;
    });

    const sourceDocs = recentDocs.length > 0 ? recentDocs : docs;
    if (recentDocs.length === 0) {
      console.log('ℹ️  No readings in last 30 days. Falling back to all available historical readings.');
    }

    const dailyData: { [key: string]: any } = {};

    sourceDocs.forEach(({ data, timestamp }) => {
      const heartRate = pickMetric(data, ['heartRate', 'heart_rate']);
      const steps = pickMetric(data, ['steps', 'stepCount', 'step_count']);
      const glucose = pickMetric(data, ['glucose', 'bloodGlucose', 'blood_glucose']);
      const bpSystolic = pickMetric(data, ['bpSystolic', 'bp_systolic', 'bloodPressureSystolic']);

      // Skip readings that don't contain any supported prediction metrics.
      if (
        heartRate === undefined &&
        steps === undefined &&
        glucose === undefined &&
        bpSystolic === undefined
      ) {
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

      if (heartRate !== undefined) dailyData[date].heart_rate.push(heartRate);
      if (steps !== undefined) dailyData[date].steps.push(steps);
      if (glucose !== undefined) dailyData[date].glucose.push(glucose);
      if (bpSystolic !== undefined) dailyData[date].bp_systolic.push(bpSystolic);
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
