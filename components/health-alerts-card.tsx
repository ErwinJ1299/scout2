'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, AlertCircle, Info, Bell, BellOff, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';

interface HealthAlert {
  type: 'critical' | 'warning' | 'info';
  metric: string;
  message: string;
  value: number;
  threshold: string;
  recommendation: string;
  priority: number;
}

interface AlertsSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
}

export function HealthAlertsCard() {
  const { user } = useAuthStore();
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [summary, setSummary] = useState<AlertsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [enabled, setEnabled] = useState(true);

  const fetchAlerts = async () => {
    if (!user?.uid) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/health-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });

      const data = await response.json();
      if (data.success) {
        setAlerts(data.alerts || []);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch health alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (enabled) {
      fetchAlerts();
      // Refresh alerts every 5 minutes
      const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user, enabled]);

  if (!enabled) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BellOff className="h-4 w-4 text-muted-foreground" />
              Health Alerts Disabled
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEnabled(true)}
            >
              Enable
            </Button>
          </div>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bell className="h-4 w-4 animate-pulse" />
            Loading Health Alerts...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const displayedAlerts = showAll ? alerts : alerts.slice(0, 3);
  const hasMore = alerts.length > 3;

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-teal-600" />
            <CardTitle className="text-lg">Health Alerts</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={fetchAlerts}
              className="h-8 w-8"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setEnabled(false)}
              className="h-8 w-8"
            >
              <BellOff className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {summary && (
          <CardDescription className="flex items-center gap-3 mt-2">
            {summary.critical > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {summary.critical} Critical
              </Badge>
            )}
            {summary.warning > 0 && (
              <Badge variant="secondary" className="gap-1 bg-orange-100 text-orange-800">
                <AlertCircle className="h-3 w-3" />
                {summary.warning} Warning
              </Badge>
            )}
            {summary.info > 0 && (
              <Badge variant="outline" className="gap-1">
                <Info className="h-3 w-3" />
                {summary.info} Info
              </Badge>
            )}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.length === 0 ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No active health alerts. Keep up the great work! 🎉
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {displayedAlerts.map((alert, index) => (
              <Alert
                key={index}
                variant={alert.type === 'critical' ? 'destructive' : 'default'}
                className={`${
                  alert.type === 'warning'
                    ? 'border-orange-200 bg-orange-50'
                    : alert.type === 'info'
                    ? 'border-blue-200 bg-blue-50'
                    : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {getAlertIcon(alert.type)}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">{alert.message}</p>
                      <Badge variant={getAlertColor(alert.type) as any} className="text-xs">
                        {alert.metric}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Value: {alert.value}</span>
                      <span>•</span>
                      <span>Threshold: {alert.threshold}</span>
                    </div>
                    <AlertDescription className="text-sm mt-1">
                      {alert.recommendation}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            ))}
            {hasMore && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAll(!showAll)}
                className="w-full"
              >
                {showAll ? 'Show Less' : `Show ${alerts.length - 3} More Alerts`}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
