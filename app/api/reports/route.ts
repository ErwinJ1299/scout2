import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const period = searchParams.get('period') || 'week'; // 'week', 'month', 'all'

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    if (period === 'week') {
      startDate.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      startDate.setDate(now.getDate() - 30);
    } else {
      startDate.setFullYear(now.getFullYear() - 1); // Last year for 'all'
    }

    // Fetch readings
    const readingsSnapshot = await adminDb
      .collection('readings')
      .where('patientId', '==', userId)
      .where('createdAt', '>=', startDate)
      .orderBy('createdAt', 'desc')
      .get();

    const readings = readingsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate()
    }));

    // Calculate statistics
    const stats = {
      totalReadings: readings.length,
      avgHeartRate: 0,
      avgSteps: 0,
      avgGlucose: 0,
      avgBPSystolic: 0,
      avgBPDiastolic: 0,
      trends: {
        heartRate: 'stable',
        steps: 'stable',
        glucose: 'stable',
        bp: 'stable'
      }
    };

    // Calculate averages
    let hrCount = 0, stepsCount = 0, glucoseCount = 0, bpCount = 0;
    
    readings.forEach(r => {
      if (r.heartRate) { stats.avgHeartRate += r.heartRate; hrCount++; }
      if (r.steps) { stats.avgSteps += r.steps; stepsCount++; }
      if (r.glucose) { stats.avgGlucose += r.glucose; glucoseCount++; }
      if (r.bpSystolic) { stats.avgBPSystolic += r.bpSystolic; bpCount++; }
      if (r.bpDiastolic) { stats.avgBPDiastolic += r.bpDiastolic; }
    });

    if (hrCount) stats.avgHeartRate = Math.round(stats.avgHeartRate / hrCount);
    if (stepsCount) stats.avgSteps = Math.round(stats.avgSteps / stepsCount);
    if (glucoseCount) stats.avgGlucose = Math.round(stats.avgGlucose / glucoseCount);
    if (bpCount) {
      stats.avgBPSystolic = Math.round(stats.avgBPSystolic / bpCount);
      stats.avgBPDiastolic = Math.round(stats.avgBPDiastolic / bpCount);
    }

    // Calculate trends (simple: compare first half vs second half)
    const midpoint = Math.floor(readings.length / 2);
    const firstHalf = readings.slice(midpoint);
    const secondHalf = readings.slice(0, midpoint);

    const calculateTrend = (metric: string) => {
      const first = firstHalf.filter(r => r[metric]).reduce((sum, r) => sum + r[metric], 0) / firstHalf.filter(r => r[metric]).length;
      const second = secondHalf.filter(r => r[metric]).reduce((sum, r) => sum + r[metric], 0) / secondHalf.filter(r => r[metric]).length;
      
      if (!first || !second) return 'stable';
      const change = ((second - first) / first) * 100;
      
      if (change > 5) return 'increasing';
      if (change < -5) return 'decreasing';
      return 'stable';
    };

    if (readings.length >= 4) {
      stats.trends.heartRate = calculateTrend('heartRate');
      stats.trends.steps = calculateTrend('steps');
      stats.trends.glucose = calculateTrend('glucose');
      stats.trends.bp = calculateTrend('bpSystolic');
    }

    // Fetch goals
    const goalsSnapshot = await adminDb
      .collection('healthGoals')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .get();

    const goals = goalsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Fetch achievements (without orderBy to avoid index requirement)
    const achievementsSnapshot = await adminDb
      .collection('achievements')
      .where('userId', '==', userId)
      .limit(20)
      .get();

    // Sort achievements manually by earnedAt
    const recentAchievements = achievementsSnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a: any, b: any) => {
        const aTime = a.earnedAt?.toDate?.() || new Date(0);
        const bTime = b.earnedAt?.toDate?.() || new Date(0);
        return bTime.getTime() - aTime.getTime();
      })
      .slice(0, 10);

    // Fetch user stats
    const statsDoc = await adminDb.collection('userStats').doc(userId).get();
    const userStats = statsDoc.exists ? statsDoc.data() : null;

    // Fetch alerts (without date filter to avoid index requirement)
    const alertsSnapshot = await adminDb
      .collection('healthAlerts')
      .where('userId', '==', userId)
      .limit(50)
      .get();

    // Filter and sort alerts manually
    const alerts = alertsSnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter((alert: any) => {
        const alertDate = alert.createdAt?.toDate?.() || new Date(0);
        return alertDate >= startDate;
      })
      .sort((a: any, b: any) => {
        const aTime = a.createdAt?.toDate?.() || new Date(0);
        const bTime = b.createdAt?.toDate?.() || new Date(0);
        return bTime.getTime() - aTime.getTime();
      })
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString()
      },
      stats,
      readings: readings.slice(0, 50), // Limit for report
      goals,
      recentAchievements,
      userStats,
      alerts: alerts.slice(0, 10)
    });
  } catch (error) {
    console.error('Error generating report data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate report data' },
      { status: 500 }
    );
  }
}
