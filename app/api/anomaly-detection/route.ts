/**
 * Anomaly Detection API Route
 * 
 * This endpoint is called when new health data is written to Firestore.
 * It runs the anomaly detection engine and creates alerts as needed.
 * 
 * Can be triggered by:
 * 1. Direct API call from client after adding a reading
 * 2. Firebase Cloud Function triggered by Firestore write
 * 3. Scheduled job for batch processing
 * 
 * POST /api/anomaly-detection
 * Body: { patientId: string, readingId?: string }
 */

import { NextRequest

export const dynamic = 'force-dynamic';
, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import {
  detectAnomalies,
  convertReadingToMetrics,
  getPrimaryTrigger,
  METRIC_THRESHOLDS,
} from '@/lib/services/anomaly-detection.service';
import { NotificationService } from '@/lib/services/notification.service';
import {
  MetricReading,
  AnomalyDetectionResult,
  DataSource,
  HealthAlert,
  AlertSeverity,
} from '@/types';

// ============================================================================
// SERVER-SIDE ALERT CREATION
// ============================================================================

/**
 * Create alert directly in Firestore using Admin SDK
 */
async function createAlertInFirestore(
  result: AnomalyDetectionResult,
  patientName: string,
  doctorId?: string
): Promise<string> {
  const alertRef = adminDb.collection('healthAlerts').doc();
  const trigger = getPrimaryTrigger(result.anomalies);
  
  const alertData: Partial<HealthAlert> = {
    id: alertRef.id,
    patientId: result.patientId,
    patientName,
    doctorId,
    severity: result.severity,
    status: 'ACTIVE',
    triggerMetric: trigger?.metric || result.anomalies[0]?.metric,
    triggerValue: trigger?.value || result.anomalies[0]?.currentValue || 0,
    createdAt: new Date(),
    notificationSent: false,
    detectionResult: result,
  };
  
  await alertRef.set(alertData);
  return alertRef.id;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Fetch patient data and assigned doctor from Firestore
 */
async function getPatientData(patientId: string): Promise<{
  name: string;
  doctorId?: string;
  phone?: string;
} | null> {
  try {
    const patientDoc = await adminDb.collection('patients').doc(patientId).get();
    
    if (!patientDoc.exists) {
      return null;
    }
    
    const data = patientDoc.data();
    
    // Get assigned doctor from doctorPatientRequests
    let doctorId: string | undefined;
    try {
      const requestsSnapshot = await adminDb
        .collection('doctorPatientRequests')
        .where('patientId', '==', patientId)
        .where('status', '==', 'accepted')
        .limit(1)
        .get();
      
      if (!requestsSnapshot.empty) {
        doctorId = requestsSnapshot.docs[0].data().doctorId;
      }
    } catch (error) {
      console.warn('[AnomalyDetection] Could not fetch assigned doctor:', error);
    }
    
    return {
      name: data?.name || 'Unknown Patient',
      doctorId: doctorId || data?.doctorId,
      phone: data?.phone,
    };
  } catch (error) {
    console.error('[AnomalyDetection] Error fetching patient:', error);
    return null;
  }
}

/**
 * Fetch historical readings from Firestore for trend analysis
 */
async function getHistoricalReadings(
  patientId: string,
  days: number = 30
): Promise<MetricReading[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const snapshot = await adminDb.collection('readings')
    .where('patientId', '==', patientId)
    .where('createdAt', '>=', startDate)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();
  
  const readings: MetricReading[] = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate?.() || new Date();
    const source = (data.source || 'manual') as DataSource;
    
    if (data.heartRate !== undefined) {
      readings.push({
        metric: 'heart_rate',
        value: data.heartRate,
        timestamp: createdAt,
        source,
      });
    }
    if (data.bpSystolic !== undefined) {
      readings.push({
        metric: 'blood_pressure_systolic',
        value: data.bpSystolic,
        timestamp: createdAt,
        source,
      });
    }
    if (data.bpDiastolic !== undefined) {
      readings.push({
        metric: 'blood_pressure_diastolic',
        value: data.bpDiastolic,
        timestamp: createdAt,
        source,
      });
    }
    if (data.glucose !== undefined) {
      readings.push({
        metric: 'glucose',
        value: data.glucose,
        timestamp: createdAt,
        source,
      });
    }
    if (data.steps !== undefined) {
      readings.push({
        metric: 'steps',
        value: data.steps,
        timestamp: createdAt,
        source,
      });
    }
    if (data.weight !== undefined) {
      readings.push({
        metric: 'weight',
        value: data.weight,
        timestamp: createdAt,
        source,
      });
    }
  });
  
  return readings;
}

/**
 * Fetch a specific reading by ID
 */
async function getReading(readingId: string): Promise<{
  heartRate?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  glucose?: number;
  steps?: number;
  weight?: number;
  createdAt: Date;
  source: 'manual' | 'iot' | 'wearable';
} | null> {
  try {
    const readingDoc = await adminDb.collection('readings').doc(readingId).get();
    
    if (!readingDoc.exists) {
      return null;
    }
    
    const data = readingDoc.data();
    return {
      heartRate: data?.heartRate,
      bpSystolic: data?.bpSystolic,
      bpDiastolic: data?.bpDiastolic,
      glucose: data?.glucose,
      steps: data?.steps,
      weight: data?.weight,
      createdAt: data?.createdAt?.toDate?.() || new Date(),
      source: data?.source || 'manual',
    };
  } catch (error) {
    console.error('[AnomalyDetection] Error fetching reading:', error);
    return null;
  }
}

/**
 * Get most recent reading for a patient
 */
async function getLatestReading(patientId: string): Promise<{
  heartRate?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  glucose?: number;
  steps?: number;
  weight?: number;
  createdAt: Date;
  source: 'manual' | 'iot' | 'wearable';
} | null> {
  try {
    const snapshot = await adminDb.collection('readings')
      .where('patientId', '==', patientId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    const data = snapshot.docs[0].data();
    return {
      heartRate: data?.heartRate,
      bpSystolic: data?.bpSystolic,
      bpDiastolic: data?.bpDiastolic,
      glucose: data?.glucose,
      steps: data?.steps,
      weight: data?.weight,
      createdAt: data?.createdAt?.toDate?.() || new Date(),
      source: data?.source || 'manual',
    };
  } catch (error) {
    console.error('[AnomalyDetection] Error fetching latest reading:', error);
    return null;
  }
}

// ============================================================================
// API ROUTE HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patientId, readingId, doctorId: providedDoctorId } = body;
    
    // Validate input
    if (!patientId) {
      return NextResponse.json(
        { success: false, error: 'patientId is required' },
        { status: 400 }
      );
    }
    
    console.log(`[AnomalyDetection] Processing for patient: ${patientId}, readingId: ${readingId || 'latest'}`);
    
    // 1. Get patient data
    const patientData = await getPatientData(patientId);
    if (!patientData) {
      return NextResponse.json(
        { success: false, error: 'Patient not found' },
        { status: 404 }
      );
    }
    
    // Use provided doctorId or fallback to patient's assigned doctor
    const doctorId = providedDoctorId || patientData.doctorId;
    
    if (!doctorId) {
      console.log('[AnomalyDetection] Warning: No doctor assigned to patient');
    }
    
    // 2. Get the reading to evaluate
    let reading;
    if (readingId) {
      reading = await getReading(readingId);
    } else {
      reading = await getLatestReading(patientId);
    }
    
    if (!reading) {
      return NextResponse.json(
        { success: false, error: 'No reading data available' },
        { status: 400 }
      );
    }
    
    // 3. Get historical readings for trend analysis
    const historicalReadings = await getHistoricalReadings(patientId);
    
    // 4. Convert reading to metric format
    const newMetrics = convertReadingToMetrics(reading);
    
    if (newMetrics.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No metrics to evaluate in this reading',
        severity: 'NORMAL',
        anomaliesDetected: 0,
      });
    }
    
    // 5. Run anomaly detection
    const result = detectAnomalies(patientId, newMetrics, historicalReadings);
    
    console.log(`[AnomalyDetection] Result: severity=${result.severity}, anomalies=${result.anomalies.length}`);
    
    // 6. Create alert if needed
    let alertId: string | null = null;
    let notificationSent = false;
    
    if (result.severity === 'WATCH' || result.severity === 'CRITICAL') {
      // Create alert in Firestore using Admin SDK
      alertId = await createAlertInFirestore(
        result,
        patientData.name,
        doctorId
      );
      
      // 7. Send notification for CRITICAL alerts
      if (result.severity === 'CRITICAL' && doctorId) {
        // Get the alert we just created
        const alertDoc = await adminDb.collection('healthAlerts').doc(alertId).get();
        
        if (alertDoc.exists) {
          const alert = { id: alertDoc.id, ...alertDoc.data() } as HealthAlert;
          const notificationResult = await NotificationService.sendCriticalAlert(alert);
          notificationSent = notificationResult.success;
          
          if (notificationResult.success) {
            await adminDb.collection('healthAlerts').doc(alertId).update({
              notificationSent: true,
              notificationType: 'both',
              notificationSentAt: new Date(),
            });
          }
        }
      }
    }
    
    // 8. Return result
    return NextResponse.json({
      success: true,
      patientId,
      doctorId,
      severity: result.severity,
      anomaliesDetected: result.anomalies.length,
      anomalies: result.anomalies.map(a => ({
        metric: a.metric,
        value: a.currentValue,
        type: a.type,
        description: a.description,
      })),
      alerts: {
        created: alertId ? 1 : 0,
        alertId,
      },
      notificationSent,
      confidence: result.confidence.overall,
      recommendations: result.recommendations,
      detectionResult: result,
      trendSummary: result.trendAnalysis.map(t => ({
        metric: t.metric,
        direction: t.direction,
        dataPoints: t.dataPoints,
      })),
    });
    
  } catch (error) {
    console.error('[AnomalyDetection] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for checking service status
 */
export async function GET() {
  const notificationConfigured = NotificationService.isConfigured();
  const configStatus = NotificationService.getConfigurationStatus();
  
  return NextResponse.json({
    service: 'anomaly-detection',
    status: 'operational',
    version: '1.0.0',
    thresholds: Object.keys(METRIC_THRESHOLDS),
    notifications: configStatus,
  });
}

