'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/lib/store/auth.store';
import { Activity, Heart, Moon, Flame } from 'lucide-react';

interface MetricData {
  date: string;
  value: number;
}

export function HealthTrendsChart() {
  const { user } = useAuthStore();
  const [period, setPeriod] = useState<'7d' | '30d'>('7d');
  const [heartRateData, setHeartRateData] = useState<MetricData[]>([]);
  const [stepsData, setStepsData] = useState<MetricData[]>([]);
  const [sleepData, setSleepData] = useState<MetricData[]>([]);
  const [caloriesData, setCaloriesData] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadTrendsData();
    }
  }, [user, period]);

  const loadTrendsData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const days = period === '7d' ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const metricsRef = collection(db, 'healthMetrics');
      const q = query(
        metricsRef,
        where('userId', '==', user.uid),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        orderBy('timestamp', 'asc')
      );

      const snapshot = await getDocs(q);
      const metrics = snapshot.docs.map(doc => ({
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      }));

      // Group by metric type and date
      const heartRate = aggregateByDate(metrics.filter(m => m.metricType === 'heart_rate'));
      const steps = aggregateByDate(metrics.filter(m => m.metricType === 'steps'));
      const sleep = aggregateByDate(metrics.filter(m => m.metricType === 'sleep'));
      const calories = aggregateByDate(metrics.filter(m => m.metricType === 'calories'));

      setHeartRateData(heartRate);
      setStepsData(steps);
      setSleepData(sleep);
      setCaloriesData(calories);
    } catch (error: any) {
      // Handle index building or permission errors gracefully
      if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
        console.log('⏳ Firestore index is building, data will be available soon');
      } else if (error?.code === 'permission-denied') {
        console.log('⏳ Waiting for authentication to complete');
      } else {
        console.error('Error loading trends:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const aggregateByDate = (metrics: any[]): MetricData[] => {
    const grouped = metrics.reduce((acc, metric) => {
      const date = metric.timestamp.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(metric.value);
      return acc;
    }, {} as Record<string, number[]>);

    return Object.entries(grouped)
      .map(([date, values]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: Math.round(values.reduce((sum, val) => sum + val, 0) / values.length)
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading trends...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Health Trends</CardTitle>
            <CardDescription>Track your health metrics over time</CardDescription>
          </div>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as '7d' | '30d')}>
            <TabsList>
              <TabsTrigger value="7d">7 Days</TabsTrigger>
              <TabsTrigger value="30d">30 Days</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Heart Rate Chart */}
        {heartRateData.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              <h3 className="font-semibold">Heart Rate (bpm)</h3>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={heartRateData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Steps Chart */}
        {stepsData.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold">Steps</h3>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stepsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Sleep Chart */}
        {sleepData.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Moon className="h-5 w-5 text-purple-500" />
              <h3 className="font-semibold">Sleep (hours)</h3>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sleepData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#a855f7" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Calories Chart */}
        {caloriesData.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <h3 className="font-semibold">Calories Burned (kcal)</h3>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={caloriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {heartRateData.length === 0 && stepsData.length === 0 && sleepData.length === 0 && caloriesData.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No trend data available. Sync your devices to see historical trends.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
