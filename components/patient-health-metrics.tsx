"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WearableService, HealthMetric } from '@/lib/services/wearable.service';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, Heart, Moon, Flame, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';

interface PatientHealthMetricsProps {
  patientId: string;
  patientName: string;
}

export function PatientHealthMetrics({ patientId, patientName }: PatientHealthMetricsProps) {
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, [patientId]);

  const loadMetrics = async () => {
    try {
      const data = await WearableService.getHealthMetrics(patientId, undefined, 7);
      setMetrics(data);
    } catch (error) {
      console.error('Failed to load patient metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLatestMetric = (metricType: string) => {
    const filtered = metrics.filter(m => m.metricType === metricType);
    return filtered.length > 0 ? filtered[0] : null;
  };

  const getMetricTrend = (metricType: string) => {
    const filtered = metrics
      .filter(m => m.metricType === metricType)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 2);

    if (filtered.length < 2) return null;

    const change = filtered[0].value - filtered[1].value;
    const percentage = ((change / filtered[1].value) * 100).toFixed(1);

    return {
      direction: change > 0 ? 'up' : 'down',
      percentage: Math.abs(parseFloat(percentage)),
      change: Math.abs(change)
    };
  };

  const getChartData = (metricType: string) => {
    return metrics
      .filter(m => m.metricType === metricType)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map(m => ({
        date: format(m.timestamp, 'MMM dd'),
        value: m.value
      }));
  };

  const getHealthStatus = (metricType: string, value: number) => {
    switch (metricType) {
      case 'heart_rate':
        if (value < 60) return { status: 'Low', color: 'text-yellow-500' };
        if (value > 100) return { status: 'High', color: 'text-red-500' };
        return { status: 'Normal', color: 'text-green-500' };
      case 'steps':
        if (value < 5000) return { status: 'Low Activity', color: 'text-yellow-500' };
        if (value >= 10000) return { status: 'Active', color: 'text-green-500' };
        return { status: 'Moderate', color: 'text-blue-500' };
      case 'sleep':
        if (value < 6) return { status: 'Insufficient', color: 'text-red-500' };
        if (value > 9) return { status: 'Oversleep', color: 'text-yellow-500' };
        return { status: 'Good', color: 'text-green-500' };
      default:
        return { status: 'Normal', color: 'text-gray-500' };
    }
  };

  const latestHeartRate = getLatestMetric('heart_rate');
  const latestSteps = getLatestMetric('steps');
  const latestSleep = getLatestMetric('sleep');
  const latestCalories = getLatestMetric('calories');

  const heartRateTrend = getMetricTrend('heart_rate');
  const stepsTrend = getMetricTrend('steps');

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading patient health data...</div>;
  }

  if (metrics.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">
            {patientName} hasn't connected any wearable devices yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{patientName}'s Health Metrics</h3>
        <Badge>Last 7 days</Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Heart Rate</CardTitle>
            <Heart className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestHeartRate ? `${latestHeartRate.value} bpm` : 'No data'}
            </div>
            {latestHeartRate && (
              <>
                <p className={`text-xs font-medium ${getHealthStatus('heart_rate', latestHeartRate.value).color}`}>
                  {getHealthStatus('heart_rate', latestHeartRate.value).status}
                </p>
                {heartRateTrend && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    {heartRateTrend.direction === 'up' ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span>{heartRateTrend.percentage}% from last reading</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Steps</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestSteps ? latestSteps.value.toLocaleString() : 'No data'}
            </div>
            {latestSteps && (
              <>
                <p className={`text-xs font-medium ${getHealthStatus('steps', latestSteps.value).color}`}>
                  {getHealthStatus('steps', latestSteps.value).status}
                </p>
                {stepsTrend && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    {stepsTrend.direction === 'up' ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span>{stepsTrend.change.toLocaleString()} steps from yesterday</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sleep</CardTitle>
            <Moon className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestSleep ? `${latestSleep.value.toFixed(1)} hrs` : 'No data'}
            </div>
            {latestSleep && (
              <p className={`text-xs font-medium ${getHealthStatus('sleep', latestSleep.value).color}`}>
                {getHealthStatus('sleep', latestSleep.value).status}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Calories</CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestCalories ? `${latestCalories.value.toLocaleString()} kcal` : 'No data'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {getChartData('heart_rate').length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Heart Rate Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={getChartData('heart_rate')}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#ef4444" name="BPM" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {getChartData('steps').length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Daily Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={getChartData('steps')}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#3b82f6" name="Steps" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
