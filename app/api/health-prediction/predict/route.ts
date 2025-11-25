import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// Calculate mean of array
function mean(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

// Calculate standard deviation
function std(arr: number[]): number {
  if (arr.length === 0) return 0;
  const avg = mean(arr);
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

// Calculate linear trend (slope)
function computeTrend(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;
  return (n * sumXY - sumX * sumY) / denominator;
}

// Calculate risk score based on health metrics
function calculateRiskScore(features: any): number {
  let risk = 0.0;
  
  // Heart Rate Risk (0-25 points)
  const hr = features.heart_rate_mean;
  if (hr > 100) risk += 0.25;
  else if (hr > 90) risk += 0.20;
  else if (hr > 80) risk += 0.15;
  else if (hr < 50) risk += 0.20;
  else if (hr < 60) risk += 0.10;
  
  // Steps Risk (0-20 points)
  const steps = features.steps_mean;
  if (steps < 3000) risk += 0.20;
  else if (steps < 5000) risk += 0.15;
  else if (steps < 7000) risk += 0.10;
  
  // Glucose Risk (0-30 points) - Critical for diabetes
  const glucose = features.glucose_mean;
  if (glucose > 200) risk += 0.30; // Very high
  else if (glucose > 140) risk += 0.25; // High
  else if (glucose > 100) risk += 0.15; // Pre-diabetic
  else if (glucose < 70) risk += 0.20; // Hypoglycemia
  
  // Blood Pressure Risk (0-25 points)
  const bp = features.bp_systolic_mean;
  if (bp > 180) risk += 0.25; // Hypertensive crisis
  else if (bp > 140) risk += 0.20; // Stage 2 hypertension
  else if (bp > 130) risk += 0.15; // Stage 1 hypertension
  else if (bp > 120) risk += 0.10; // Elevated
  else if (bp < 90) risk += 0.15; // Low BP
  
  // Age Risk (0-10 points)
  const age = features.age || 35;
  if (age > 60) risk += 0.10;
  else if (age > 50) risk += 0.05;
  else if (age < 18) risk += 0.03;
  
  // Trend penalties (worsening conditions)
  if (features.trend_heart_rate > 0.5) risk += 0.05;
  if (features.trend_steps < -50) risk += 0.05;
  if (features.trend_glucose > 1) risk += 0.08;
  
  return Math.max(0.0, Math.min(1.0, risk));
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

    console.log('📊 Fetching REAL health data for user:', userId);

    // Fetch ALL readings for this user using Firebase Admin SDK
    const snapshot = await adminDb
      .collection('readings')
      .where('patientId', '==', userId)
      .get();
    
    if (snapshot.empty) {
      return NextResponse.json({
        success: false,
        error: 'No health data found. Please log some health metrics first.',
        needsData: true
      }, { status: 400 });
    }

    console.log(`✅ Found ${snapshot.size} health records`);

    // Filter to last 30 days and group metrics by type
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const heartRateData: number[] = [];
    const stepsData: number[] = [];
    const glucoseData: number[] = [];
    const bpSystolicData: number[] = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const timestamp = data.createdAt?.toDate();
      
      // Skip if older than 30 days
      if (timestamp && timestamp < thirtyDaysAgo) {
        return;
      }

      // Extract readings data
      if (data.heartRate) heartRateData.push(data.heartRate);
      if (data.steps) stepsData.push(data.steps);
      if (data.glucose) glucoseData.push(data.glucose);
      if (data.bpSystolic) bpSystolicData.push(data.bpSystolic);
    });

    console.log('🔍 Data extracted from readings collection');

    console.log('📈 Data summary:', {
      heartRate: heartRateData.length,
      steps: stepsData.length,
      glucose: glucoseData.length,
      bpSystolic: bpSystolicData.length
    });

    // Compute features
    const features = {
      heart_rate_mean: mean(heartRateData),
      heart_rate_std: std(heartRateData),
      heart_rate_max: heartRateData.length > 0 ? Math.max(...heartRateData) : 0,
      heart_rate_min: heartRateData.length > 0 ? Math.min(...heartRateData) : 0,
      steps_mean: mean(stepsData),
      steps_std: std(stepsData),
      steps_total: stepsData.reduce((a, b) => a + b, 0),
      glucose_mean: mean(glucoseData),
      glucose_std: std(glucoseData),
      bp_systolic_mean: mean(bpSystolicData),
      bp_systolic_std: std(bpSystolicData),
      age: 35,
      trend_heart_rate: computeTrend(heartRateData),
      trend_steps: computeTrend(stepsData),
      trend_glucose: computeTrend(glucoseData)
    };

    console.log('🧮 Computed features:', {
      hr_avg: features.heart_rate_mean.toFixed(1),
      steps_avg: features.steps_mean.toFixed(0),
      glucose_avg: features.glucose_mean.toFixed(1),
      bp_avg: features.bp_systolic_mean.toFixed(0)
    });

    // Calculate risk score
    const riskScore = calculateRiskScore(features);
    const riskLevel = riskScore < 0.3 ? 'low' : riskScore < 0.6 ? 'medium' : 'high';

    console.log(`🎯 Risk Score: ${(riskScore * 100).toFixed(1)}% (${riskLevel})`);

    // Analyze contributing factors
    const contributingFactors = [];
    
    const hrImpact = Math.abs(features.heart_rate_mean - 70) / 70;
    const hrStatus = features.heart_rate_mean > 80 || features.heart_rate_mean < 60 ? 'warning' : 'good';
    contributingFactors.push({ feature: 'heart_rate', impact: hrImpact, status: hrStatus });
    
    const stepsImpact = Math.abs(features.steps_mean - 8000) / 8000;
    const stepsStatus = features.steps_mean < 5000 ? 'critical' : features.steps_mean < 7000 ? 'warning' : 'good';
    contributingFactors.push({ feature: 'steps', impact: stepsImpact, status: stepsStatus });
    
    const glucoseImpact = Math.abs(features.glucose_mean - 90) / 90;
    const glucoseStatus = features.glucose_mean > 140 ? 'critical' : features.glucose_mean > 100 ? 'warning' : 'good';
    contributingFactors.push({ feature: 'glucose', impact: glucoseImpact, status: glucoseStatus });
    
    const bpImpact = Math.abs(features.bp_systolic_mean - 120) / 120;
    const bpStatus = features.bp_systolic_mean > 140 ? 'critical' : features.bp_systolic_mean > 130 ? 'warning' : 'good';
    contributingFactors.push({ feature: 'blood_pressure', impact: bpImpact, status: bpStatus });
    
    contributingFactors.sort((a, b) => b.impact - a.impact);

    // Generate recommendations
    const recommendations: string[] = [];
    if (features.heart_rate_mean > 80) {
      recommendations.push('Consider stress management techniques to lower resting heart rate');
    }
    if (features.steps_mean < 7000) {
      recommendations.push('Increase daily physical activity - aim for at least 8000 steps per day');
    }
    if (features.glucose_mean > 100) {
      recommendations.push('Monitor blood sugar levels and consider dietary adjustments to maintain healthy glucose');
    }
    if (features.bp_systolic_mean > 130) {
      recommendations.push('Monitor blood pressure regularly and consult with your doctor about management strategies');
    }
    if (recommendations.length === 0) {
      recommendations.push('Keep up the great work! Maintain your healthy lifestyle');
    }

    // Generate 7-day trend forecast
    const predictedTrend = [];
    for (let i = 1; i <= 7; i++) {
      const trendAdjustment = (
        features.trend_heart_rate * 0.3 +
        features.trend_steps * -0.0001 +
        features.trend_glucose * 0.01
      ) * i;
      
      const predictedRisk = Math.max(0, Math.min(1, riskScore + trendAdjustment * 0.01));
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      predictedTrend.push({
        date: date.toISOString().split('T')[0],
        predicted_risk: parseFloat(predictedRisk.toFixed(3)),
        confidence_lower: parseFloat(Math.max(0, predictedRisk - 0.1).toFixed(3)),
        confidence_upper: parseFloat(Math.min(1, predictedRisk + 0.1).toFixed(3))
      });
    }

    return NextResponse.json({
      success: true,
      prediction: {
        risk_score: parseFloat(riskScore.toFixed(3)),
        risk_level: riskLevel,
        confidence: 0.85,
        contributing_factors: contributingFactors,
        recommendations,
        predicted_trend: predictedTrend
      },
      dataSource: 'real_firestore_data',
      recordsAnalyzed: snapshot.size,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Prediction API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
