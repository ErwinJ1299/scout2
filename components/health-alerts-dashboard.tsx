'use client';

/**
 * Health Alerts Dashboard Component
 * 
 * Displays health alerts for a doctor's patients with:
 * - Real-time updates via Firestore subscription
 * - Severity-based filtering and sorting
 * - Alert acknowledgement functionality
 * - Statistics overview
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Activity,
  Heart,
  Droplet,
  TrendingUp,
  Bell,
  BellOff,
  Filter,
  RefreshCw,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertSeverity, AlertStatus, AnomalyMetricType } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

interface AlertItem {
  id: string;
  patientId: string;
  patientName: string;
  doctorId?: string;
  severity: AlertSeverity;
  status: AlertStatus;
  triggerMetric: AnomalyMetricType;
  triggerValue: number;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  acknowledgedBy?: string;
  doctorNotes?: string;
  actionTaken?: string;
  notificationSent: boolean;
  detection: {
    confidence: number;
    anomalyCount: number;
    recommendations: string[];
    anomalies: Array<{
      metric: string;
      value: number;
      type: string;
      description: string;
      normalRange: { min: number; max: number };
    }>;
  };
}

interface AlertStats {
  total: number;
  active: number;
  reviewed: number;
  resolved: number;
  critical: number;
  criticalActive: number;
  watch: number;
  watchActive: number;
  resolvedToday: number;
  uniquePatients: number;
}

interface HealthAlertsDashboardProps {
  doctorId: string;
  patientId?: string; // Optional - if provided, show alerts for specific patient
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getMetricIcon(metric: AnomalyMetricType) {
  switch (metric) {
    case 'heart_rate':
      return <Heart className="h-4 w-4" />;
    case 'blood_pressure_systolic':
    case 'blood_pressure_diastolic':
      return <Activity className="h-4 w-4" />;
    case 'glucose':
      return <Droplet className="h-4 w-4" />;
    default:
      return <TrendingUp className="h-4 w-4" />;
  }
}

function getSeverityColor(severity: AlertSeverity) {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-red-500 text-white';
    case 'WATCH':
      return 'bg-yellow-500 text-white';
    default:
      return 'bg-green-500 text-white';
  }
}

function getStatusColor(status: AlertStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'REVIEWED':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'RESOLVED':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

  return date.toLocaleDateString();
}

function formatMetricName(metric: AnomalyMetricType): string {
  return metric.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function HealthAlertsDashboard({ doctorId, patientId }: HealthAlertsDashboardProps) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'ALL'>('ACTIVE');
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'ALL'>('ALL');

  // Acknowledgement dialog
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [acknowledgeNotes, setAcknowledgeNotes] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [acknowledging, setAcknowledging] = useState(false);

  // ==================== DATA FETCHING ====================

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (patientId) {
        params.set('patientId', patientId);
      } else {
        params.set('doctorId', doctorId);
      }
      if (statusFilter !== 'ALL') {
        params.set('status', statusFilter);
      }
      if (severityFilter !== 'ALL') {
        params.set('severity', severityFilter);
      }

      const response = await fetch(`/api/alerts?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch alerts');
      }

      const data = await response.json();
      setAlerts(data.alerts || []);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [doctorId, patientId, statusFilter, severityFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getStats',
          doctorId: patientId ? undefined : doctorId,
          patientId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, [doctorId, patientId]);

  useEffect(() => {
    fetchAlerts();
    fetchStats();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchAlerts();
      fetchStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchAlerts, fetchStats]);

  // ==================== ACTIONS ====================

  const handleAcknowledge = async (newStatus: 'REVIEWED' | 'RESOLVED') => {
    if (!selectedAlert) return;

    try {
      setAcknowledging(true);

      const response = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId: selectedAlert.id,
          doctorId,
          notes: acknowledgeNotes || undefined,
          actionTaken: actionTaken || undefined,
          newStatus,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to acknowledge alert');
      }

      // Refresh data
      await fetchAlerts();
      await fetchStats();

      // Reset state
      setSelectedAlert(null);
      setAcknowledgeNotes('');
      setActionTaken('');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to acknowledge');
    } finally {
      setAcknowledging(false);
    }
  };

  const handleBulkAcknowledge = async () => {
    const activeAlertIds = alerts
      .filter(a => a.status === 'ACTIVE')
      .map(a => a.id);

    if (activeAlertIds.length === 0) return;

    try {
      setLoading(true);

      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulkAcknowledge',
          alertIds: activeAlertIds,
          doctorId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to acknowledge alerts');
      }

      await fetchAlerts();
      await fetchStats();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to acknowledge');
    } finally {
      setLoading(false);
    }
  };

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/25">
              <Bell className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Health Alerts</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {patientId ? 'Patient health alerts' : 'Real-time alerts for your patients'}
              </p>
            </div>
          </div>

          {stats && (
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-semibold text-red-700 dark:text-red-300">{stats.criticalActive} Critical</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">{stats.watchActive} Watch</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-semibold text-green-700 dark:text-green-300">{stats.resolvedToday} Resolved</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Filters:</span>
          </div>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[140px] bg-slate-700 border-slate-600 text-white rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              <SelectItem value="ALL" className="text-white hover:bg-slate-700 focus:bg-slate-700">All Status</SelectItem>
              <SelectItem value="ACTIVE" className="text-white hover:bg-slate-700 focus:bg-slate-700">Active</SelectItem>
              <SelectItem value="REVIEWED" className="text-white hover:bg-slate-700 focus:bg-slate-700">Reviewed</SelectItem>
              <SelectItem value="RESOLVED" className="text-white hover:bg-slate-700 focus:bg-slate-700">Resolved</SelectItem>
            </SelectContent>
          </Select>

          <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as any)}>
            <SelectTrigger className="w-[140px] bg-slate-700 border-slate-600 text-white rounded-xl">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              <SelectItem value="ALL" className="text-white hover:bg-slate-700 focus:bg-slate-700">All Severity</SelectItem>
              <SelectItem value="CRITICAL" className="text-white hover:bg-slate-700 focus:bg-slate-700">Critical</SelectItem>
              <SelectItem value="WATCH" className="text-white hover:bg-slate-700 focus:bg-slate-700">Watch</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />

          <button
            onClick={() => { fetchAlerts(); fetchStats(); }}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {alerts.filter(a => a.status === 'ACTIVE').length > 0 && (
            <button
              onClick={handleBulkAcknowledge}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-500/25"
            >
              <CheckCircle2 className="h-4 w-4" />
              Acknowledge All
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Alerts List */}
      <div className="space-y-3">
        {loading && alerts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12">
            <div className="flex items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500 dark:text-gray-400">Loading alerts...</span>
            </div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                <BellOff className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">No alerts match your filters</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">All caught up! 🎉</p>
            </div>
          </div>
        ) : (
          alerts.map((alert) => (
            <Card
              key={alert.id}
              className={`cursor-pointer hover:shadow-md transition-shadow ${alert.severity === 'CRITICAL' && alert.status === 'ACTIVE'
                ? 'border-red-300 bg-red-50/50'
                : alert.severity === 'WATCH' && alert.status === 'ACTIVE'
                  ? 'border-yellow-300 bg-yellow-50/50'
                  : ''
                }`}
              onClick={() => setSelectedAlert(alert)}
            >
              <CardContent className="pt-4">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Left: Main Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={getSeverityColor(alert.severity)}>
                        {alert.severity === 'CRITICAL' ? (
                          <AlertTriangle className="h-3 w-3 mr-1" />
                        ) : (
                          <AlertCircle className="h-3 w-3 mr-1" />
                        )}
                        {alert.severity}
                      </Badge>
                      <Badge variant="outline" className={getStatusColor(alert.status)}>
                        {alert.status}
                      </Badge>
                      {alert.notificationSent && (
                        <Badge variant="outline" className="text-xs">
                          <Bell className="h-3 w-3 mr-1" />
                          Notified
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{alert.patientName}</span>
                    </div>

                    {alert.detection.anomalies[0] && (
                      <p className="text-sm text-muted-foreground">
                        {alert.detection.anomalies[0].description}
                      </p>
                    )}
                  </div>

                  {/* Right: Metric & Time */}
                  <div className="flex flex-col items-end gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      {getMetricIcon(alert.triggerMetric)}
                      <span className="font-medium">
                        {formatMetricName(alert.triggerMetric)}: {alert.triggerValue}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(alert.createdAt)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Confidence: {Math.round((alert.detection.confidence || 0) * 100)}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Alert Detail Dialog */}
      <Dialog open={!!selectedAlert} onOpenChange={(open) => !open && setSelectedAlert(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white text-slate-900 border border-slate-200 shadow-2xl">
          {selectedAlert && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Badge className={getSeverityColor(selectedAlert.severity)}>
                    {selectedAlert.severity}
                  </Badge>
                  Alert for {selectedAlert.patientName}
                </DialogTitle>
                <DialogDescription>
                  {formatTimestamp(selectedAlert.createdAt)} •
                  {formatMetricName(selectedAlert.triggerMetric)}: {selectedAlert.triggerValue}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="details" className="mt-4">
                <TabsList>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="action">Take Action</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  {/* Anomalies */}
                  <div>
                    <h4 className="font-medium mb-2">Detected Anomalies</h4>
                    <div className="space-y-2">
                      {selectedAlert.detection.anomalies.map((anomaly, i) => (
                        <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900">
                          <p className="font-medium text-slate-900">{anomaly.description}</p>
                          <p className="text-slate-700">
                            Normal range: {anomaly.normalRange.min} - {anomaly.normalRange.max}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div>
                    <h4 className="font-medium mb-2">Recommendations</h4>
                    <ul className="space-y-1 text-sm">
                      {selectedAlert.detection.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-muted-foreground">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Confidence */}
                  <div className="p-3 bg-muted rounded-lg">
                    <h4 className="font-medium mb-1">Detection Confidence</h4>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 rounded-full h-2 transition-all"
                          style={{ width: `${(selectedAlert.detection.confidence || 0) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {Math.round((selectedAlert.detection.confidence || 0) * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Previous Notes */}
                  {selectedAlert.doctorNotes && (
                    <div>
                      <h4 className="font-medium mb-2">Previous Notes</h4>
                      <p className="text-sm text-muted-foreground">{selectedAlert.doctorNotes}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="action" className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Notes (optional)</label>
                    <Textarea
                      placeholder="Add notes about this alert..."
                      value={acknowledgeNotes}
                      onChange={(e) => setAcknowledgeNotes(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Action Taken (optional)</label>
                    <Textarea
                      placeholder="Describe any action taken..."
                      value={actionTaken}
                      onChange={(e) => setActionTaken(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setSelectedAlert(null)}>
                  Cancel
                </Button>
                {selectedAlert.status === 'ACTIVE' && (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => handleAcknowledge('REVIEWED')}
                      disabled={acknowledging}
                    >
                      {acknowledging ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      Mark as Reviewed
                    </Button>
                    <Button
                      onClick={() => handleAcknowledge('RESOLVED')}
                      disabled={acknowledging}
                    >
                      Resolve Alert
                    </Button>
                  </>
                )}
                {selectedAlert.status === 'REVIEWED' && (
                  <Button
                    onClick={() => handleAcknowledge('RESOLVED')}
                    disabled={acknowledging}
                  >
                    Resolve Alert
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default HealthAlertsDashboard;
