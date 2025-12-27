/**
 * AWS Lambda Handler for Health Data Anomaly Detection
 * 
 * This Lambda function is triggered by Firestore events (via EventBridge or direct invocation)
 * when new health readings are written. It processes the data through the anomaly detection
 * engine and creates alerts in Firestore when anomalies are detected.
 * 
 * Architecture:
 * - Triggered by: API Gateway POST /anomaly-detection OR EventBridge Firestore triggers
 * - Processes: Health readings through 3-layer anomaly detection
 * - Outputs: Creates Firestore alerts, triggers SNS for CRITICAL alerts
 * 
 * Deployment: AWS Lambda with Node.js 18.x runtime
 * Environment Variables Required:
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_CLIENT_EMAIL
 * - FIREBASE_PRIVATE_KEY
 * - SNS_TOPIC_ARN (for critical alerts)
 * - AWS_REGION
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import * as admin from 'firebase-admin';

// ============================================================================
// TYPE DEFINITIONS (mirrored from main app types)
// ============================================================================

type AlertSeverity = 'NORMAL' | 'WATCH' | 'CRITICAL';
type AlertStatus = 'ACTIVE' | 'REVIEWED' | 'RESOLVED';
type DataSource = 'manual' | 'wearable' | 'clinical' | 'iot';
type AnomalyMetricType = 
  | 'heart_rate'
  | 'blood_pressure_systolic'
  | 'blood_pressure_diastolic'
  | 'glucose'
  | 'oxygen_saturation'
  | 'temperature'
  | 'steps'
  | 'weight';

interface MetricThreshold {
  metric: AnomalyMetricType;
  criticalLow?: number;
  warningLow?: number;
  normalLow: number;
  normalHigh: number;
  warningHigh?: number;
  criticalHigh?: number;
  unit: string;
}

interface MetricReading {
  metric: AnomalyMetricType;
  value: number;
  timestamp: Date;
  source: DataSource;
  deviceId?: string;
}

interface ConfidenceScore {
  overall: number;
  dataQuality: number;
  dataRecency: number;
  dataConsistency: number;
  factors: string[];
}

interface DetectedAnomaly {
  metric: AnomalyMetricType;
  currentValue: number;
  normalRange: { min: number; max: number };
  deviation: number;
  type: 'threshold_breach' | 'trend_anomaly' | 'sudden_change';
  description: string;
}

interface TrendAnalysis {
  metric: AnomalyMetricType;
  direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  slope: number;
  volatility: number;
  dataPoints: number;
  periodDays: number;
}

interface AnomalyDetectionResult {
  patientId: string;
  timestamp: Date;
  severity: AlertSeverity;
  confidence: ConfidenceScore;
  anomalies: DetectedAnomaly[];
  trendAnalysis: TrendAnalysis[];
  rawReadings: MetricReading[];
  recentHistory: MetricReading[];
  recommendations: string[];
  requiresNotification: boolean;
}

interface HealthAlert {
  id: string;
  patientId: string;
  patientName?: string;
  doctorId?: string;
  severity: AlertSeverity;
  status: AlertStatus;
  detectionResult: AnomalyDetectionResult;
  triggerMetric: AnomalyMetricType;
  triggerValue: number;
  createdAt: admin.firestore.Timestamp;
  notificationSent: boolean;
  notificationType?: 'email' | 'sms' | 'both';
  notificationSentAt?: admin.firestore.Timestamp;
}

// Lambda event types
interface LambdaEvent {
  body?: string;
  Records?: Array<{
    body: string;
    eventSource: string;
  }>;
  // Direct invocation payload
  patientId?: string;
  readingId?: string;
  reading?: FirestoreReading;
}

interface FirestoreReading {
  id: string;
  patientId: string;
  glucose?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  steps?: number;
  heartRate?: number;
  weight?: number;
  createdAt: string | { _seconds: number; _nanoseconds: number };
  source: 'manual' | 'iot' | 'wearable';
}

interface LambdaResponse {
  statusCode: number;
  body: string;
  headers: {
    'Content-Type': string;
    'Access-Control-Allow-Origin': string;
  };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// Initialize Firebase Admin (lazy initialization)
let firebaseInitialized = false;

function initializeFirebase(): void {
  if (firebaseInitialized) return;
  
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase configuration environment variables');
  }
  
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
  
  firebaseInitialized = true;
}

// SNS Client for notifications
const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Medical thresholds (same as main app)
const METRIC_THRESHOLDS: Record<AnomalyMetricType, MetricThreshold> = {
  heart_rate: {
    metric: 'heart_rate',
    criticalLow: 40,
    warningLow: 50,
    normalLow: 60,
    normalHigh: 100,
    warningHigh: 110,
    criticalHigh: 130,
    unit: 'bpm',
  },
  blood_pressure_systolic: {
    metric: 'blood_pressure_systolic',
    criticalLow: 80,
    warningLow: 90,
    normalLow: 90,
    normalHigh: 120,
    warningHigh: 140,
    criticalHigh: 180,
    unit: 'mmHg',
  },
  blood_pressure_diastolic: {
    metric: 'blood_pressure_diastolic',
    criticalLow: 50,
    warningLow: 60,
    normalLow: 60,
    normalHigh: 80,
    warningHigh: 90,
    criticalHigh: 120,
    unit: 'mmHg',
  },
  glucose: {
    metric: 'glucose',
    criticalLow: 54,
    warningLow: 70,
    normalLow: 70,
    normalHigh: 140,
    warningHigh: 180,
    criticalHigh: 250,
    unit: 'mg/dL',
  },
  oxygen_saturation: {
    metric: 'oxygen_saturation',
    criticalLow: 88,
    warningLow: 92,
    normalLow: 95,
    normalHigh: 100,
    unit: '%',
  },
  temperature: {
    metric: 'temperature',
    criticalLow: 35,
    warningLow: 36,
    normalLow: 36.1,
    normalHigh: 37.2,
    warningHigh: 38,
    criticalHigh: 39.5,
    unit: '°C',
  },
  steps: {
    metric: 'steps',
    normalLow: 0,
    normalHigh: 50000,
    unit: 'steps',
  },
  weight: {
    metric: 'weight',
    normalLow: 30,
    normalHigh: 300,
    unit: 'kg',
  },
};

const SOURCE_CONFIDENCE: Record<DataSource, number> = {
  clinical: 1.0,
  iot: 0.85,
  wearable: 0.7,
  manual: 0.5,
};

// ============================================================================
// ANOMALY DETECTION ENGINE (Embedded for Lambda)
// ============================================================================

function evaluateThreshold(
  reading: MetricReading,
  threshold: MetricThreshold
): DetectedAnomaly | null {
  const { value, metric } = reading;
  
  if (threshold.criticalLow !== undefined && value <= threshold.criticalLow) {
    return {
      metric,
      currentValue: value,
      normalRange: { min: threshold.normalLow, max: threshold.normalHigh },
      deviation: threshold.normalLow - value,
      type: 'threshold_breach',
      description: `CRITICAL: ${metric.replace(/_/g, ' ')} is dangerously low at ${value} ${threshold.unit}`,
    };
  }
  
  if (threshold.criticalHigh !== undefined && value >= threshold.criticalHigh) {
    return {
      metric,
      currentValue: value,
      normalRange: { min: threshold.normalLow, max: threshold.normalHigh },
      deviation: value - threshold.normalHigh,
      type: 'threshold_breach',
      description: `CRITICAL: ${metric.replace(/_/g, ' ')} is dangerously high at ${value} ${threshold.unit}`,
    };
  }
  
  if (threshold.warningLow !== undefined && value <= threshold.warningLow) {
    return {
      metric,
      currentValue: value,
      normalRange: { min: threshold.normalLow, max: threshold.normalHigh },
      deviation: threshold.normalLow - value,
      type: 'threshold_breach',
      description: `WARNING: ${metric.replace(/_/g, ' ')} is below normal at ${value} ${threshold.unit}`,
    };
  }
  
  if (threshold.warningHigh !== undefined && value >= threshold.warningHigh) {
    return {
      metric,
      currentValue: value,
      normalRange: { min: threshold.normalLow, max: threshold.normalHigh },
      deviation: value - threshold.normalHigh,
      type: 'threshold_breach',
      description: `WARNING: ${metric.replace(/_/g, ' ')} is above normal at ${value} ${threshold.unit}`,
    };
  }
  
  return null;
}

function analyzeTrend(
  readings: MetricReading[],
  metric: AnomalyMetricType,
  periodDays: number = 7
): TrendAnalysis {
  const metricReadings = readings
    .filter(r => r.metric === metric)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  const n = metricReadings.length;
  
  if (n < 3) {
    return { metric, direction: 'stable', slope: 0, volatility: 0, dataPoints: n, periodDays };
  }
  
  const values = metricReadings.map(r => r.value);
  const times = metricReadings.map(r => r.timestamp.getTime());
  
  const meanX = times.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (times[i] - meanX) * (values[i] - meanY);
    denominator += (times[i] - meanX) ** 2;
  }
  
  const slopePerMs = denominator !== 0 ? numerator / denominator : 0;
  const slopePerDay = slopePerMs * (24 * 60 * 60 * 1000);
  
  const variance = values.reduce((sum, v) => sum + (v - meanY) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const volatility = meanY !== 0 ? stdDev / Math.abs(meanY) : 0;
  
  const threshold = meanY * 0.01;
  let direction: TrendAnalysis['direction'];
  
  if (volatility > 0.3) {
    direction = 'volatile';
  } else if (slopePerDay > threshold) {
    direction = 'increasing';
  } else if (slopePerDay < -threshold) {
    direction = 'decreasing';
  } else {
    direction = 'stable';
  }
  
  return { metric, direction, slope: slopePerDay, volatility, dataPoints: n, periodDays };
}

function detectSuddenChange(
  currentReading: MetricReading,
  recentReadings: MetricReading[],
  threshold: MetricThreshold
): DetectedAnomaly | null {
  const metricReadings = recentReadings
    .filter(r => r.metric === currentReading.metric)
    .slice(-10);
  
  if (metricReadings.length < 3) return null;
  
  const values = metricReadings.map(r => r.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  );
  
  const zScore = stdDev !== 0 ? (currentReading.value - mean) / stdDev : 0;
  
  if (Math.abs(zScore) > 2.5) {
    const direction = zScore > 0 ? 'spike' : 'drop';
    return {
      metric: currentReading.metric,
      currentValue: currentReading.value,
      normalRange: { min: threshold.normalLow, max: threshold.normalHigh },
      deviation: Math.abs(currentReading.value - mean),
      type: 'sudden_change',
      description: `Sudden ${direction} detected: ${currentReading.metric.replace(/_/g, ' ')} changed from ${mean.toFixed(1)} to ${currentReading.value}`,
    };
  }
  
  return null;
}

function calculateConfidence(
  readings: MetricReading[],
  recentHistory: MetricReading[]
): ConfidenceScore {
  const factors: string[] = [];
  
  const sources = readings.map(r => r.source);
  const avgSourceScore = sources.length > 0 
    ? sources.reduce((sum, s) => sum + SOURCE_CONFIDENCE[s], 0) / sources.length 
    : 0.5;
  const dataQuality = avgSourceScore;
  
  if (dataQuality >= 0.8) {
    factors.push('High-quality data sources');
  } else if (dataQuality < 0.6) {
    factors.push('Lower confidence due to manual/wearable sources');
  }
  
  const now = Date.now();
  const latestReading = readings.reduce(
    (latest, r) => Math.max(latest, r.timestamp.getTime()),
    0
  );
  const hoursSinceLatest = (now - latestReading) / (1000 * 60 * 60);
  
  let dataRecency: number;
  if (hoursSinceLatest < 1) dataRecency = 1.0;
  else if (hoursSinceLatest < 4) dataRecency = 0.9;
  else if (hoursSinceLatest < 12) dataRecency = 0.7;
  else if (hoursSinceLatest < 24) dataRecency = 0.5;
  else {
    dataRecency = 0.3;
    factors.push('Data is more than 24 hours old');
  }
  
  const uniqueDays = new Set(
    recentHistory.map(r => r.timestamp.toDateString())
  ).size;
  const dataConsistency = Math.min(uniqueDays / 7, 1);
  
  if (dataConsistency < 0.5) {
    factors.push('Sparse data history');
  }
  
  const overall = dataQuality * 0.4 + dataRecency * 0.35 + dataConsistency * 0.25;
  
  return {
    overall: Math.round(overall * 100) / 100,
    dataQuality: Math.round(dataQuality * 100) / 100,
    dataRecency: Math.round(dataRecency * 100) / 100,
    dataConsistency: Math.round(dataConsistency * 100) / 100,
    factors,
  };
}

function classifySeverity(
  anomalies: DetectedAnomaly[],
  confidence: ConfidenceScore
): AlertSeverity {
  if (anomalies.length === 0) return 'NORMAL';
  
  const hasCriticalBreach = anomalies.some(
    a => a.type === 'threshold_breach' && a.description.startsWith('CRITICAL')
  );
  
  if (hasCriticalBreach) {
    if (confidence.overall < 0.3 && confidence.dataQuality < 0.4) {
      return 'WATCH';
    }
    return 'CRITICAL';
  }
  
  const hasWarning = anomalies.some(
    a => a.type === 'threshold_breach' && a.description.startsWith('WARNING')
  );
  
  if (hasWarning) return 'WATCH';
  
  const hasTrendAnomaly = anomalies.some(
    a => a.type === 'trend_anomaly' || a.type === 'sudden_change'
  );
  
  if (hasTrendAnomaly && confidence.overall >= 0.5) return 'WATCH';
  
  return 'NORMAL';
}

function generateRecommendations(
  anomalies: DetectedAnomaly[],
  severity: AlertSeverity
): string[] {
  const recommendations: string[] = [];
  
  if (severity === 'CRITICAL') {
    recommendations.push('⚠️ URGENT: Seek immediate medical attention');
    recommendations.push('Contact your healthcare provider or emergency services');
  }
  
  for (const anomaly of anomalies) {
    switch (anomaly.metric) {
      case 'heart_rate':
        if (anomaly.currentValue > 100) {
          recommendations.push('Rest and avoid strenuous activity');
        } else if (anomaly.currentValue < 60) {
          recommendations.push('Monitor for dizziness or fainting');
        }
        break;
      case 'glucose':
        if (anomaly.currentValue > 180) {
          recommendations.push('Check ketones, increase water intake');
        } else if (anomaly.currentValue < 70) {
          recommendations.push('Consume 15-20g fast-acting carbohydrates');
        }
        break;
    }
  }
  
  if (severity === 'WATCH') {
    recommendations.push('Continue monitoring and log symptoms');
    recommendations.push('Consult doctor within 24-48 hours if readings persist');
  }
  
  return [...new Set(recommendations)];
}

function detectAnomalies(
  patientId: string,
  newReadings: MetricReading[],
  historicalReadings: MetricReading[]
): AnomalyDetectionResult {
  const timestamp = new Date();
  const anomalies: DetectedAnomaly[] = [];
  const trendAnalyses: TrendAnalysis[] = [];
  
  const allReadings = [...historicalReadings, ...newReadings]
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  const metricsToEvaluate = [...new Set(newReadings.map(r => r.metric))];
  
  for (const metric of metricsToEvaluate) {
    const threshold = METRIC_THRESHOLDS[metric];
    if (!threshold) continue;
    
    const latestReading = newReadings
      .filter(r => r.metric === metric)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
    
    if (!latestReading) continue;
    
    const thresholdAnomaly = evaluateThreshold(latestReading, threshold);
    if (thresholdAnomaly) anomalies.push(thresholdAnomaly);
    
    const suddenChangeAnomaly = detectSuddenChange(latestReading, historicalReadings, threshold);
    if (suddenChangeAnomaly) anomalies.push(suddenChangeAnomaly);
    
    const trend = analyzeTrend(allReadings, metric);
    trendAnalyses.push(trend);
  }
  
  const confidence = calculateConfidence(newReadings, historicalReadings);
  const severity = classifySeverity(anomalies, confidence);
  const recommendations = generateRecommendations(anomalies, severity);
  
  return {
    patientId,
    timestamp,
    severity,
    confidence,
    anomalies,
    trendAnalysis: trendAnalyses,
    rawReadings: newReadings,
    recentHistory: historicalReadings.slice(-50),
    recommendations,
    requiresNotification: severity === 'CRITICAL',
  };
}

// ============================================================================
// DATA CONVERSION HELPERS
// ============================================================================

function convertReadingToMetrics(reading: FirestoreReading): MetricReading[] {
  const metrics: MetricReading[] = [];
  
  // Parse timestamp
  let timestamp: Date;
  if (typeof reading.createdAt === 'string') {
    timestamp = new Date(reading.createdAt);
  } else if (reading.createdAt && typeof reading.createdAt === 'object' && '_seconds' in reading.createdAt) {
    timestamp = new Date(reading.createdAt._seconds * 1000);
  } else {
    timestamp = new Date();
  }
  
  const source = reading.source as DataSource;
  
  if (reading.heartRate !== undefined) {
    metrics.push({ metric: 'heart_rate', value: reading.heartRate, timestamp, source });
  }
  if (reading.bpSystolic !== undefined) {
    metrics.push({ metric: 'blood_pressure_systolic', value: reading.bpSystolic, timestamp, source });
  }
  if (reading.bpDiastolic !== undefined) {
    metrics.push({ metric: 'blood_pressure_diastolic', value: reading.bpDiastolic, timestamp, source });
  }
  if (reading.glucose !== undefined) {
    metrics.push({ metric: 'glucose', value: reading.glucose, timestamp, source });
  }
  if (reading.steps !== undefined) {
    metrics.push({ metric: 'steps', value: reading.steps, timestamp, source });
  }
  if (reading.weight !== undefined) {
    metrics.push({ metric: 'weight', value: reading.weight, timestamp, source });
  }
  
  return metrics;
}

// ============================================================================
// FIRESTORE OPERATIONS
// ============================================================================

async function getPatientData(
  db: admin.firestore.Firestore,
  patientId: string
): Promise<{ name: string; doctorId?: string } | null> {
  const patientDoc = await db.collection('patients').doc(patientId).get();
  if (!patientDoc.exists) return null;
  
  const data = patientDoc.data();
  return {
    name: data?.name || 'Unknown Patient',
    doctorId: data?.doctorId,
  };
}

async function getHistoricalReadings(
  db: admin.firestore.Firestore,
  patientId: string,
  days: number = 30
): Promise<MetricReading[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const snapshot = await db.collection('readings')
    .where('patientId', '==', patientId)
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startDate))
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();
  
  const readings: MetricReading[] = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate?.() || new Date();
    const source = (data.source || 'manual') as DataSource;
    
    if (data.heartRate) {
      readings.push({ metric: 'heart_rate', value: data.heartRate, timestamp: createdAt, source });
    }
    if (data.bpSystolic) {
      readings.push({ metric: 'blood_pressure_systolic', value: data.bpSystolic, timestamp: createdAt, source });
    }
    if (data.bpDiastolic) {
      readings.push({ metric: 'blood_pressure_diastolic', value: data.bpDiastolic, timestamp: createdAt, source });
    }
    if (data.glucose) {
      readings.push({ metric: 'glucose', value: data.glucose, timestamp: createdAt, source });
    }
    if (data.steps) {
      readings.push({ metric: 'steps', value: data.steps, timestamp: createdAt, source });
    }
    if (data.weight) {
      readings.push({ metric: 'weight', value: data.weight, timestamp: createdAt, source });
    }
  });
  
  return readings;
}

async function createAlert(
  db: admin.firestore.Firestore,
  result: AnomalyDetectionResult,
  patientName: string,
  doctorId?: string
): Promise<string> {
  // Find the primary trigger metric
  const primaryAnomaly = result.anomalies[0];
  
  const alertRef = db.collection('healthAlerts').doc();
  
  const alertData: Omit<HealthAlert, 'id'> & { id: string } = {
    id: alertRef.id,
    patientId: result.patientId,
    patientName,
    doctorId,
    severity: result.severity,
    status: 'ACTIVE',
    detectionResult: {
      ...result,
      timestamp: admin.firestore.Timestamp.fromDate(result.timestamp) as any,
      rawReadings: result.rawReadings.map(r => ({
        ...r,
        timestamp: admin.firestore.Timestamp.fromDate(r.timestamp) as any,
      })),
      recentHistory: result.recentHistory.map(r => ({
        ...r,
        timestamp: admin.firestore.Timestamp.fromDate(r.timestamp) as any,
      })),
    } as any,
    triggerMetric: primaryAnomaly?.metric || 'heart_rate',
    triggerValue: primaryAnomaly?.currentValue || 0,
    createdAt: admin.firestore.Timestamp.now(),
    notificationSent: false,
  };
  
  await alertRef.set(alertData);
  
  console.log(`Created alert ${alertRef.id} for patient ${result.patientId} with severity ${result.severity}`);
  
  return alertRef.id;
}

// ============================================================================
// SNS NOTIFICATION
// ============================================================================

async function sendCriticalNotification(
  alertId: string,
  patientId: string,
  patientName: string,
  result: AnomalyDetectionResult
): Promise<void> {
  const topicArn = process.env.SNS_TOPIC_ARN;
  
  if (!topicArn) {
    console.warn('SNS_TOPIC_ARN not configured, skipping notification');
    return;
  }
  
  const primaryAnomaly = result.anomalies[0];
  const dashboardUrl = process.env.APP_URL 
    ? `${process.env.APP_URL}/doctor/patients/${patientId}`
    : `https://yourapp.com/doctor/patients/${patientId}`;
  
  const message = {
    default: `CRITICAL HEALTH ALERT for ${patientName}`,
    email: `
🚨 CRITICAL HEALTH ALERT

Patient: ${patientName}
Patient ID: ${patientId}
Alert ID: ${alertId}
Time: ${result.timestamp.toISOString()}

ANOMALY DETECTED:
${primaryAnomaly?.description || 'Critical health anomaly detected'}

Current Value: ${primaryAnomaly?.currentValue} 
Normal Range: ${primaryAnomaly?.normalRange.min} - ${primaryAnomaly?.normalRange.max}

Confidence Score: ${(result.confidence.overall * 100).toFixed(0)}%

RECOMMENDATIONS:
${result.recommendations.map(r => `• ${r}`).join('\n')}

View patient dashboard: ${dashboardUrl}

This is an automated alert from the Medical Safety System.
Please review and acknowledge in your dashboard.
    `,
    sms: `CRITICAL: ${patientName} - ${primaryAnomaly?.description || 'Health anomaly detected'}. View dashboard immediately.`,
  };
  
  try {
    await snsClient.send(new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(message),
      MessageStructure: 'json',
      Subject: `🚨 CRITICAL: Health Alert for ${patientName}`,
      MessageAttributes: {
        alertId: { DataType: 'String', StringValue: alertId },
        patientId: { DataType: 'String', StringValue: patientId },
        severity: { DataType: 'String', StringValue: 'CRITICAL' },
      },
    }));
    
    console.log(`Sent SNS notification for alert ${alertId}`);
    
    // Update alert with notification status
    const db = admin.firestore();
    await db.collection('healthAlerts').doc(alertId).update({
      notificationSent: true,
      notificationType: 'both',
      notificationSentAt: admin.firestore.Timestamp.now(),
    });
  } catch (error) {
    console.error('Failed to send SNS notification:', error);
    // Don't throw - alert was still created
  }
}

// ============================================================================
// MAIN LAMBDA HANDLER
// ============================================================================

export const handler = async (event: LambdaEvent): Promise<LambdaResponse> => {
  console.log('Anomaly Detection Lambda invoked', JSON.stringify(event, null, 2));
  
  try {
    // Initialize Firebase
    initializeFirebase();
    const db = admin.firestore();
    
    // Parse input (supports API Gateway, SQS, and direct invocation)
    let patientId: string;
    let reading: FirestoreReading | undefined;
    
    if (event.body) {
      // API Gateway request
      const body = JSON.parse(event.body);
      patientId = body.patientId;
      reading = body.reading;
    } else if (event.Records && event.Records.length > 0) {
      // SQS/EventBridge event
      const body = JSON.parse(event.Records[0].body);
      patientId = body.patientId;
      reading = body.reading;
    } else {
      // Direct invocation
      patientId = event.patientId!;
      reading = event.reading;
    }
    
    if (!patientId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'patientId is required' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      };
    }
    
    // Get patient data
    const patientData = await getPatientData(db, patientId);
    if (!patientData) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Patient not found' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      };
    }
    
    // Get historical readings
    const historicalReadings = await getHistoricalReadings(db, patientId);
    
    // Convert new reading to metrics (or get latest from history)
    let newMetrics: MetricReading[];
    if (reading) {
      newMetrics = convertReadingToMetrics(reading);
    } else if (historicalReadings.length > 0) {
      // Use most recent reading
      const latestTimestamp = Math.max(...historicalReadings.map(r => r.timestamp.getTime()));
      newMetrics = historicalReadings.filter(
        r => r.timestamp.getTime() === latestTimestamp
      );
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No reading data available' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      };
    }
    
    // Run anomaly detection
    const result = detectAnomalies(patientId, newMetrics, historicalReadings);
    
    console.log(`Anomaly detection result: severity=${result.severity}, anomalies=${result.anomalies.length}`);
    
    // Handle results based on severity
    let alertId: string | null = null;
    
    if (result.severity === 'WATCH' || result.severity === 'CRITICAL') {
      // Create alert in Firestore
      alertId = await createAlert(db, result, patientData.name, patientData.doctorId);
      
      // Send notification for CRITICAL alerts
      if (result.severity === 'CRITICAL') {
        await sendCriticalNotification(alertId, patientId, patientData.name, result);
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        patientId,
        severity: result.severity,
        anomaliesDetected: result.anomalies.length,
        alertId,
        confidence: result.confidence.overall,
        requiresNotification: result.requiresNotification,
        recommendations: result.recommendations,
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    };
    
  } catch (error) {
    console.error('Anomaly detection error:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    };
  }
};
