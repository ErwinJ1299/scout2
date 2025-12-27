/**
 * Alert Service
 * 
 * Manages health alerts in Firestore:
 * - Create new alerts from anomaly detection results
 * - Fetch alerts for patients or doctors
 * - Acknowledge/resolve alerts
 * - Track alert history and statistics
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  onSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  HealthAlert,
  AlertSeverity,
  AlertStatus,
  AnomalyDetectionResult,
  AcknowledgeAlertRequest,
  FirestoreHealthAlert,
  AnomalyMetricType,
} from '@/types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert Firestore timestamp to Date
 */
const timestampToDate = (timestamp: any): Date => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (timestamp && typeof timestamp === 'object' && '_seconds' in timestamp) {
    return new Date(timestamp._seconds * 1000);
  }
  return new Date();
};

/**
 * Convert Firestore alert document to HealthAlert type
 */
function convertFirestoreAlert(data: DocumentData, id: string): HealthAlert {
  return {
    id,
    patientId: data.patientId,
    patientName: data.patientName,
    doctorId: data.doctorId,
    severity: data.severity as AlertSeverity,
    status: data.status as AlertStatus,
    detectionResult: {
      ...data.detectionResult,
      timestamp: timestampToDate(data.detectionResult?.timestamp),
      rawReadings: (data.detectionResult?.rawReadings || []).map((r: any) => ({
        ...r,
        timestamp: timestampToDate(r.timestamp),
      })),
      recentHistory: (data.detectionResult?.recentHistory || []).map((r: any) => ({
        ...r,
        timestamp: timestampToDate(r.timestamp),
      })),
    },
    triggerMetric: data.triggerMetric as AnomalyMetricType,
    triggerValue: data.triggerValue,
    createdAt: timestampToDate(data.createdAt),
    acknowledgedAt: data.acknowledgedAt ? timestampToDate(data.acknowledgedAt) : undefined,
    resolvedAt: data.resolvedAt ? timestampToDate(data.resolvedAt) : undefined,
    acknowledgedBy: data.acknowledgedBy,
    resolvedBy: data.resolvedBy,
    doctorNotes: data.doctorNotes,
    actionTaken: data.actionTaken,
    notificationSent: data.notificationSent || false,
    notificationType: data.notificationType,
    notificationSentAt: data.notificationSentAt ? timestampToDate(data.notificationSentAt) : undefined,
  };
}

// ============================================================================
// ALERT SERVICE CLASS
// ============================================================================

export class AlertService {
  
  // ==================== CREATE ====================
  
  /**
   * Create a new health alert from anomaly detection result
   */
  static async createAlert(
    result: AnomalyDetectionResult,
    patientName?: string,
    doctorId?: string
  ): Promise<string> {
    const alertRef = doc(collection(db, 'healthAlerts'));
    
    // Find primary trigger metric
    const primaryAnomaly = result.anomalies[0];
    
    const alertData = {
      id: alertRef.id,
      patientId: result.patientId,
      patientName: patientName || 'Unknown',
      doctorId: doctorId || null,
      severity: result.severity,
      status: 'ACTIVE' as AlertStatus,
      detectionResult: {
        ...result,
        timestamp: Timestamp.fromDate(result.timestamp),
        rawReadings: result.rawReadings.map(r => ({
          ...r,
          timestamp: Timestamp.fromDate(r.timestamp),
        })),
        recentHistory: result.recentHistory.map(r => ({
          ...r,
          timestamp: Timestamp.fromDate(r.timestamp),
        })),
      },
      triggerMetric: primaryAnomaly?.metric || 'heart_rate',
      triggerValue: primaryAnomaly?.currentValue || 0,
      createdAt: serverTimestamp(),
      notificationSent: false,
    };
    
    await setDoc(alertRef, alertData);
    
    console.log(`[AlertService] Created alert ${alertRef.id} for patient ${result.patientId}`);
    
    return alertRef.id;
  }
  
  // ==================== READ ====================
  
  /**
   * Get a single alert by ID
   */
  static async getAlert(alertId: string): Promise<HealthAlert | null> {
    const docSnap = await getDoc(doc(db, 'healthAlerts', alertId));
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return convertFirestoreAlert(docSnap.data(), alertId);
  }
  
  /**
   * Get all active alerts for a specific patient
   */
  static async getPatientAlerts(
    patientId: string,
    status?: AlertStatus,
    limitCount: number = 50
  ): Promise<HealthAlert[]> {
    let q = query(
      collection(db, 'healthAlerts'),
      where('patientId', '==', patientId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    if (status) {
      q = query(
        collection(db, 'healthAlerts'),
        where('patientId', '==', patientId),
        where('status', '==', status),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
    }
    
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => convertFirestoreAlert(doc.data(), doc.id));
  }
  
  /**
   * Get all alerts for a doctor's patients
   */
  static async getDoctorAlerts(
    doctorId: string,
    status?: AlertStatus,
    limitCount: number = 100
  ): Promise<HealthAlert[]> {
    let q = query(
      collection(db, 'healthAlerts'),
      where('doctorId', '==', doctorId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    if (status) {
      q = query(
        collection(db, 'healthAlerts'),
        where('doctorId', '==', doctorId),
        where('status', '==', status),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
    }
    
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => convertFirestoreAlert(doc.data(), doc.id));
  }
  
  /**
   * Get all active CRITICAL alerts (for dashboard overview)
   */
  static async getCriticalAlerts(limitCount: number = 50): Promise<HealthAlert[]> {
    const q = query(
      collection(db, 'healthAlerts'),
      where('severity', '==', 'CRITICAL'),
      where('status', '==', 'ACTIVE'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => convertFirestoreAlert(doc.data(), doc.id));
  }
  
  /**
   * Subscribe to real-time alerts for a doctor
   */
  static subscribeToAlerts(
    doctorId: string,
    callback: (alerts: HealthAlert[]) => void,
    statusFilter?: AlertStatus
  ): () => void {
    let q = query(
      collection(db, 'healthAlerts'),
      where('doctorId', '==', doctorId),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    
    if (statusFilter) {
      q = query(
        collection(db, 'healthAlerts'),
        where('doctorId', '==', doctorId),
        where('status', '==', statusFilter),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
    }
    
    return onSnapshot(q, (snapshot) => {
      const alerts = snapshot.docs.map(doc => convertFirestoreAlert(doc.data(), doc.id));
      callback(alerts);
    });
  }
  
  /**
   * Subscribe to patient's alerts in real-time
   */
  static subscribeToPatientAlerts(
    patientId: string,
    callback: (alerts: HealthAlert[]) => void
  ): () => void {
    const q = query(
      collection(db, 'healthAlerts'),
      where('patientId', '==', patientId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    return onSnapshot(q, (snapshot) => {
      const alerts = snapshot.docs.map(doc => convertFirestoreAlert(doc.data(), doc.id));
      callback(alerts);
    });
  }
  
  // ==================== UPDATE ====================
  
  /**
   * Acknowledge an alert (doctor action)
   */
  static async acknowledgeAlert(request: AcknowledgeAlertRequest): Promise<void> {
    const { alertId, doctorId, notes, newStatus, actionTaken } = request;
    
    const updateData: Record<string, any> = {
      status: newStatus,
      acknowledgedBy: doctorId,
      acknowledgedAt: serverTimestamp(),
    };
    
    if (notes) {
      updateData.doctorNotes = notes;
    }
    
    if (actionTaken) {
      updateData.actionTaken = actionTaken;
    }
    
    if (newStatus === 'RESOLVED') {
      updateData.resolvedAt = serverTimestamp();
      updateData.resolvedBy = doctorId;
    }
    
    await updateDoc(doc(db, 'healthAlerts', alertId), updateData);
    
    console.log(`[AlertService] Alert ${alertId} acknowledged by ${doctorId} with status ${newStatus}`);
  }
  
  /**
   * Update notification status
   */
  static async updateNotificationStatus(
    alertId: string,
    notificationType: 'email' | 'sms' | 'both'
  ): Promise<void> {
    await updateDoc(doc(db, 'healthAlerts', alertId), {
      notificationSent: true,
      notificationType,
      notificationSentAt: serverTimestamp(),
    });
  }
  
  /**
   * Add doctor notes to an alert
   */
  static async addDoctorNotes(
    alertId: string,
    doctorId: string,
    notes: string
  ): Promise<void> {
    const alert = await this.getAlert(alertId);
    
    if (!alert) {
      throw new Error('Alert not found');
    }
    
    await updateDoc(doc(db, 'healthAlerts', alertId), {
      doctorNotes: notes,
      acknowledgedBy: doctorId,
      acknowledgedAt: serverTimestamp(),
    });
  }
  
  // ==================== STATISTICS ====================
  
  /**
   * Get alert statistics for a patient
   */
  static async getPatientAlertStats(patientId: string): Promise<{
    total: number;
    active: number;
    critical: number;
    watch: number;
    resolved: number;
  }> {
    const alerts = await this.getPatientAlerts(patientId, undefined, 500);
    
    return {
      total: alerts.length,
      active: alerts.filter(a => a.status === 'ACTIVE').length,
      critical: alerts.filter(a => a.severity === 'CRITICAL').length,
      watch: alerts.filter(a => a.severity === 'WATCH').length,
      resolved: alerts.filter(a => a.status === 'RESOLVED').length,
    };
  }
  
  /**
   * Get alert statistics for a doctor's patients
   */
  static async getDoctorAlertStats(doctorId: string): Promise<{
    total: number;
    activeAlerts: number;
    criticalActive: number;
    watchActive: number;
    resolvedToday: number;
    patientsWithAlerts: number;
  }> {
    const alerts = await this.getDoctorAlerts(doctorId, undefined, 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const uniquePatients = new Set(
      alerts.filter(a => a.status === 'ACTIVE').map(a => a.patientId)
    );
    
    return {
      total: alerts.length,
      activeAlerts: alerts.filter(a => a.status === 'ACTIVE').length,
      criticalActive: alerts.filter(a => a.severity === 'CRITICAL' && a.status === 'ACTIVE').length,
      watchActive: alerts.filter(a => a.severity === 'WATCH' && a.status === 'ACTIVE').length,
      resolvedToday: alerts.filter(a => 
        a.status === 'RESOLVED' && 
        a.resolvedAt && 
        a.resolvedAt >= today
      ).length,
      patientsWithAlerts: uniquePatients.size,
    };
  }
  
  // ==================== BULK OPERATIONS ====================
  
  /**
   * Mark multiple alerts as reviewed
   */
  static async bulkAcknowledge(
    alertIds: string[],
    doctorId: string
  ): Promise<void> {
    const batch = await Promise.all(
      alertIds.map(alertId => 
        updateDoc(doc(db, 'healthAlerts', alertId), {
          status: 'REVIEWED',
          acknowledgedBy: doctorId,
          acknowledgedAt: serverTimestamp(),
        })
      )
    );
    
    console.log(`[AlertService] Bulk acknowledged ${alertIds.length} alerts by ${doctorId}`);
  }
}
