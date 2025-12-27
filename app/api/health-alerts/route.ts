import { NextRequest

export const dynamic = 'force-dynamic';
, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

interface Alert {
  type: 'critical' | 'warning' | 'info';
  metric: string;
  message: string;
  value: number;
  threshold: string;
  recommendation: string;
  priority: number;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log('🔔 Analyzing health alerts for user:', userId);

    // Fetch last 30 days of readings
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const snapshot = await adminDb
      .collection('readings')
      .where('patientId', '==', userId)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({
        success: true,
        alerts: [],
        summary: 'No health data available for analysis'
      });
    }

    const readings: any[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const timestamp = data.createdAt?.toDate();
      
      if (timestamp && timestamp >= thirtyDaysAgo) {
        readings.push({
          heartRate: data.heartRate,
          steps: data.steps,
          glucose: data.glucose,
          bpSystolic: data.bpSystolic,
          bpDiastolic: data.bpDiastolic,
          weight: data.weight,
          timestamp
        });
      }
    });

    console.log(`📊 Analyzing ${readings.length} readings`);

    const alerts: Alert[] = [];

    // Get latest readings
    const latest = readings.sort((a, b) => b.timestamp - a.timestamp)[0];
    
    // Get averages
    const heartRates = readings.filter(r => r.heartRate).map(r => r.heartRate);
    const glucoseLevels = readings.filter(r => r.glucose).map(r => r.glucose);
    const bpSystolic = readings.filter(r => r.bpSystolic).map(r => r.bpSystolic);
    const stepsCounts = readings.filter(r => r.steps).map(r => r.steps);

    const avgHR = heartRates.length > 0 ? heartRates.reduce((a, b) => a + b, 0) / heartRates.length : 0;
    const avgGlucose = glucoseLevels.length > 0 ? glucoseLevels.reduce((a, b) => a + b, 0) / glucoseLevels.length : 0;
    const avgBP = bpSystolic.length > 0 ? bpSystolic.reduce((a, b) => a + b, 0) / bpSystolic.length : 0;
    const avgSteps = stepsCounts.length > 0 ? stepsCounts.reduce((a, b) => a + b, 0) / stepsCounts.length : 0;

    // CRITICAL ALERTS - Immediate attention needed
    
    if (latest.glucose && latest.glucose > 200) {
      alerts.push({
        type: 'critical',
        metric: 'glucose',
        message: 'Very high blood sugar detected',
        value: latest.glucose,
        threshold: '> 200 mg/dL',
        recommendation: 'Seek immediate medical attention. This level requires urgent intervention.',
        priority: 10
      });
    } else if (latest.glucose && latest.glucose < 70) {
      alerts.push({
        type: 'critical',
        metric: 'glucose',
        message: 'Low blood sugar (Hypoglycemia)',
        value: latest.glucose,
        threshold: '< 70 mg/dL',
        recommendation: 'Consume fast-acting carbohydrates immediately. Contact your doctor if symptoms persist.',
        priority: 9
      });
    }

    if (latest.bpSystolic && latest.bpSystolic > 180) {
      alerts.push({
        type: 'critical',
        metric: 'blood_pressure',
        message: 'Hypertensive crisis detected',
        value: latest.bpSystolic,
        threshold: '> 180 mmHg',
        recommendation: 'Seek emergency medical care immediately. This is a hypertensive crisis.',
        priority: 10
      });
    }

    if (latest.heartRate && (latest.heartRate > 120 || latest.heartRate < 50)) {
      alerts.push({
        type: 'critical',
        metric: 'heart_rate',
        message: latest.heartRate > 120 ? 'Very high heart rate' : 'Very low heart rate',
        value: latest.heartRate,
        threshold: latest.heartRate > 120 ? '> 120 bpm' : '< 50 bpm',
        recommendation: 'Consult your doctor immediately. Abnormal heart rate may indicate a serious condition.',
        priority: 8
      });
    }

    // WARNING ALERTS - Need attention soon

    if (avgGlucose > 140) {
      alerts.push({
        type: 'warning',
        metric: 'glucose',
        message: 'Blood sugar trending high',
        value: avgGlucose,
        threshold: 'Average > 140 mg/dL',
        recommendation: 'Review your diet and exercise routine. Schedule a check-up with your doctor.',
        priority: 6
      });
    } else if (avgGlucose > 100 && avgGlucose <= 140) {
      alerts.push({
        type: 'warning',
        metric: 'glucose',
        message: 'Pre-diabetic range detected',
        value: avgGlucose,
        threshold: '100-140 mg/dL',
        recommendation: 'Focus on diet and exercise. Consider consulting a nutritionist.',
        priority: 5
      });
    }

    if (avgBP > 140) {
      alerts.push({
        type: 'warning',
        metric: 'blood_pressure',
        message: 'Blood pressure consistently elevated',
        value: avgBP,
        threshold: 'Average > 140 mmHg',
        recommendation: 'Monitor daily and consult your doctor about blood pressure management.',
        priority: 7
      });
    } else if (avgBP > 130) {
      alerts.push({
        type: 'warning',
        metric: 'blood_pressure',
        message: 'Blood pressure in Stage 1 Hypertension',
        value: avgBP,
        threshold: '130-140 mmHg',
        recommendation: 'Consider lifestyle changes and discuss with your doctor.',
        priority: 5
      });
    }

    if (avgHR > 90) {
      alerts.push({
        type: 'warning',
        metric: 'heart_rate',
        message: 'Elevated resting heart rate',
        value: avgHR,
        threshold: 'Average > 90 bpm',
        recommendation: 'Practice stress management and ensure adequate sleep. Consider cardio fitness.',
        priority: 4
      });
    }

    // INFORMATIONAL ALERTS - Lifestyle improvements

    if (avgSteps < 5000) {
      alerts.push({
        type: 'info',
        metric: 'activity',
        message: 'Low physical activity detected',
        value: avgSteps,
        threshold: '< 5000 steps/day',
        recommendation: 'Aim to gradually increase to 8000-10000 steps daily for better health.',
        priority: 3
      });
    }

    // Trend analysis
    if (glucoseLevels.length >= 7) {
      const recentGlucose = glucoseLevels.slice(-7);
      const olderGlucose = glucoseLevels.slice(0, 7);
      const recentAvg = recentGlucose.reduce((a, b) => a + b, 0) / recentGlucose.length;
      const olderAvg = olderGlucose.reduce((a, b) => a + b, 0) / olderGlucose.length;
      
      if (recentAvg > olderAvg * 1.15) {
        alerts.push({
          type: 'warning',
          metric: 'glucose_trend',
          message: 'Blood sugar levels increasing',
          value: recentAvg,
          threshold: '15% increase trend',
          recommendation: 'Your glucose is trending upward. Review recent dietary changes with your doctor.',
          priority: 6
        });
      }
    }

    if (bpSystolic.length >= 7) {
      const recentBP = bpSystolic.slice(-7);
      const olderBP = bpSystolic.slice(0, 7);
      const recentAvg = recentBP.reduce((a, b) => a + b, 0) / recentBP.length;
      const olderAvg = olderBP.reduce((a, b) => a + b, 0) / olderBP.length;
      
      if (recentAvg > olderAvg + 10) {
        alerts.push({
          type: 'warning',
          metric: 'bp_trend',
          message: 'Blood pressure trending upward',
          value: recentAvg,
          threshold: '+10 mmHg trend',
          recommendation: 'Your blood pressure is rising. Monitor stress levels and salt intake.',
          priority: 5
        });
      }
    }

    // Sort by priority
    alerts.sort((a, b) => b.priority - a.priority);

    const criticalCount = alerts.filter(a => a.type === 'critical').length;
    const warningCount = alerts.filter(a => a.type === 'warning').length;

    console.log(`✅ Generated ${alerts.length} alerts (${criticalCount} critical, ${warningCount} warnings)`);

    return NextResponse.json({
      success: true,
      alerts,
      summary: {
        total: alerts.length,
        critical: criticalCount,
        warning: warningCount,
        info: alerts.length - criticalCount - warningCount
      },
      latestReadings: {
        heartRate: latest.heartRate || null,
        glucose: latest.glucose || null,
        bpSystolic: latest.bpSystolic || null,
        steps: latest.steps || null
      }
    });

  } catch (error: any) {
    console.error('❌ Alerts API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to analyze health alerts' },
      { status: 500 }
    );
  }
}

