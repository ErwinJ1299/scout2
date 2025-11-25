'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WearableService, HealthMetric } from '@/lib/services/wearable.service';
import { useAuthStore } from '@/lib/store/auth.store';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, Heart, Moon, Flame } from 'lucide-react';
import { format } from 'date-fns';

export function HealthMetricsDashboard() {
  const { user } = useAuthStore();
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadMetrics();
    }
  }, [user]);

  const loadMetrics = async () => {
    if (!user) return;
    
    try {
      const data = await WearableService.getHealthMetrics(user.uid, undefined, 7);
      setMetrics(data);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setLoading(false);
    }
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

  const getLatestMetric = (metricType: string) => {
    const filtered = metrics.filter(m => m.metricType === metricType);
    return filtered.length > 0 ? filtered[0] : null;
  };

  const latestHeartRate = getLatestMetric('heart_rate');
  const latestSteps = getLatestMetric('steps');
  const latestSleep = getLatestMetric('sleep');
  const latestCalories = getLatestMetric('calories');

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading health metrics...</div>;
  }

  return (
    <div className="space-y-6">
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
            <p className="text-xs text-muted-foreground">
              {latestHeartRate && format(latestHeartRate.timestamp, 'PPp')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Steps Today</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestSteps ? latestSteps.value.toLocaleString() : 'No data'}
            </div>
            <p className="text-xs text-muted-foreground">
              {latestSteps && format(latestSteps.timestamp, 'PPp')}
            </p>
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
            <p className="text-xs text-muted-foreground">
              {latestSleep && format(latestSleep.timestamp, 'PPp')}
            </p>
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
            <p className="text-xs text-muted-foreground">
              {latestCalories && format(latestCalories.timestamp, 'PPp')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {metrics.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">
              No health data available. Connect a wearable device and sync to see your metrics.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {getChartData('heart_rate').length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Heart Rate Trend</CardTitle>
                <CardDescription>Last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getChartData('heart_rate')}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke="#ef4444" name="Heart Rate (bpm)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {getChartData('steps').length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Daily Steps</CardTitle>
                <CardDescription>Last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getChartData('steps')}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke="#3b82f6" name="Steps" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {getChartData('sleep').length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Sleep Duration</CardTitle>
                <CardDescription>Last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getChartData('sleep')}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke="#a855f7" name="Sleep (hours)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {getChartData('calories').length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Calories Burned</CardTitle>
                <CardDescription>Last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getChartData('calories')}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke="#f97316" name="Calories (kcal)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
