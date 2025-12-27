/**
 * Alerts Management API Route
 * 
 * Handles all operations related to health alerts:
 * - GET: Fetch alerts for a patient or doctor
 * - POST: Create new alert (usually done by anomaly detection)
 * - PATCH: Acknowledge/resolve alerts
 * 
 * Endpoints:
 * GET /api/alerts?patientId=xxx          - Get alerts for a patient
 * GET /api/alerts?doctorId=xxx           - Get alerts for doctor's patients
 * GET /api/alerts?doctorId=xxx&status=ACTIVE - Filter by status
 * GET /api/alerts/stats?doctorId=xxx     - Get alert statistics
 * PATCH /api/alerts                      - Acknowledge an alert
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { AlertStatus, AlertSeverity, AcknowledgeAlertRequest } from '@/types';

// ============================================================================
// GET - Fetch Alerts
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    const doctorId = searchParams.get('doctorId');
    const status = searchParams.get('status') as AlertStatus | null;
    const severity = searchParams.get('severity') as AlertSeverity | null;
    const limitParam = searchParams.get('limit');
    const limitCount = limitParam ? parseInt(limitParam, 10) : 50;
    
    // Validate that we have at least one filter
    if (!patientId && !doctorId) {
      return NextResponse.json(
        { success: false, error: 'Either patientId or doctorId is required' },
        { status: 400 }
      );
    }
    
    // Build query
    let query = adminDb.collection('healthAlerts')
      .orderBy('createdAt', 'desc')
      .limit(limitCount);
    
    if (patientId) {
      query = query.where('patientId', '==', patientId);
    }
    
    if (doctorId) {
      query = query.where('doctorId', '==', doctorId);
    }
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    if (severity) {
      query = query.where('severity', '==', severity);
    }
    
    const snapshot = await query.get();
    
    const alerts = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        patientId: data.patientId,
        patientName: data.patientName,
        doctorId: data.doctorId,
        severity: data.severity,
        status: data.status,
        triggerMetric: data.triggerMetric,
        triggerValue: data.triggerValue,
        createdAt: data.createdAt?.toDate?.().toISOString(),
        acknowledgedAt: data.acknowledgedAt?.toDate?.().toISOString(),
        resolvedAt: data.resolvedAt?.toDate?.().toISOString(),
        acknowledgedBy: data.acknowledgedBy,
        doctorNotes: data.doctorNotes,
        actionTaken: data.actionTaken,
        notificationSent: data.notificationSent,
        // Include summarized detection result
        detection: {
          confidence: data.detectionResult?.confidence?.overall,
          anomalyCount: data.detectionResult?.anomalies?.length || 0,
          recommendations: data.detectionResult?.recommendations || [],
          anomalies: (data.detectionResult?.anomalies || []).map((a: any) => ({
            metric: a.metric,
            value: a.currentValue,
            type: a.type,
            description: a.description,
            normalRange: a.normalRange,
          })),
        },
      };
    });
    
    return NextResponse.json({
      success: true,
      count: alerts.length,
      alerts,
    });
    
  } catch (error) {
    console.error('[Alerts API] GET error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch alerts',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Acknowledge/Resolve Alert
// ============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as AcknowledgeAlertRequest;
    const { alertId, doctorId, notes, newStatus, actionTaken } = body;
    
    // Validate required fields
    if (!alertId) {
      return NextResponse.json(
        { success: false, error: 'alertId is required' },
        { status: 400 }
      );
    }
    
    if (!doctorId) {
      return NextResponse.json(
        { success: false, error: 'doctorId is required' },
        { status: 400 }
      );
    }
    
    if (!newStatus || !['REVIEWED', 'RESOLVED'].includes(newStatus)) {
      return NextResponse.json(
        { success: false, error: 'newStatus must be REVIEWED or RESOLVED' },
        { status: 400 }
      );
    }
    
    // Check if alert exists
    const alertRef = adminDb.collection('healthAlerts').doc(alertId);
    const alertDoc = await alertRef.get();
    
    if (!alertDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }
    
    // Build update object
    const updateData: Record<string, any> = {
      status: newStatus,
      acknowledgedBy: doctorId,
      acknowledgedAt: new Date(),
    };
    
    if (notes) {
      updateData.doctorNotes = notes;
    }
    
    if (actionTaken) {
      updateData.actionTaken = actionTaken;
    }
    
    if (newStatus === 'RESOLVED') {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = doctorId;
    }
    
    // Update the alert
    await alertRef.update(updateData);
    
    console.log(`[Alerts API] Alert ${alertId} acknowledged by ${doctorId} with status ${newStatus}`);
    
    return NextResponse.json({
      success: true,
      alertId,
      newStatus,
      message: `Alert ${newStatus === 'RESOLVED' ? 'resolved' : 'acknowledged'} successfully`,
    });
    
  } catch (error) {
    console.error('[Alerts API] PATCH error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to acknowledge alert',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Bulk Acknowledge
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, alertIds, doctorId } = body;
    
    // Handle bulk acknowledge
    if (action === 'bulkAcknowledge') {
      if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
        return NextResponse.json(
          { success: false, error: 'alertIds array is required' },
          { status: 400 }
        );
      }
      
      if (!doctorId) {
        return NextResponse.json(
          { success: false, error: 'doctorId is required' },
          { status: 400 }
        );
      }
      
      const batch = adminDb.batch();
      
      for (const alertId of alertIds) {
        const alertRef = adminDb.collection('healthAlerts').doc(alertId);
        batch.update(alertRef, {
          status: 'REVIEWED',
          acknowledgedBy: doctorId,
          acknowledgedAt: new Date(),
        });
      }
      
      await batch.commit();
      
      console.log(`[Alerts API] Bulk acknowledged ${alertIds.length} alerts by ${doctorId}`);
      
      return NextResponse.json({
        success: true,
        acknowledgedCount: alertIds.length,
        message: `Successfully acknowledged ${alertIds.length} alerts`,
      });
    }
    
    // Handle statistics request
    if (action === 'getStats') {
      const { patientId, doctorId } = body;
      
      if (!patientId && !doctorId) {
        return NextResponse.json(
          { success: false, error: 'Either patientId or doctorId is required' },
          { status: 400 }
        );
      }
      
      let query = adminDb.collection('healthAlerts');
      
      if (patientId) {
        query = query.where('patientId', '==', patientId) as any;
      }
      
      if (doctorId) {
        query = query.where('doctorId', '==', doctorId) as any;
      }
      
      const snapshot = await query.get();
      
      const alerts = snapshot.docs.map(doc => doc.data());
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const stats = {
        total: alerts.length,
        active: alerts.filter(a => a.status === 'ACTIVE').length,
        reviewed: alerts.filter(a => a.status === 'REVIEWED').length,
        resolved: alerts.filter(a => a.status === 'RESOLVED').length,
        critical: alerts.filter(a => a.severity === 'CRITICAL').length,
        criticalActive: alerts.filter(a => a.severity === 'CRITICAL' && a.status === 'ACTIVE').length,
        watch: alerts.filter(a => a.severity === 'WATCH').length,
        watchActive: alerts.filter(a => a.severity === 'WATCH' && a.status === 'ACTIVE').length,
        resolvedToday: alerts.filter(a => {
          const resolvedAt = a.resolvedAt?.toDate?.();
          return a.status === 'RESOLVED' && resolvedAt && resolvedAt >= today;
        }).length,
        uniquePatients: new Set(alerts.filter(a => a.status === 'ACTIVE').map(a => a.patientId)).size,
      };
      
      return NextResponse.json({
        success: true,
        stats,
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('[Alerts API] POST error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
