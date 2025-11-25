"use client";

import { WearableDevices } from '@/components/wearable-devices';
import { HealthMetricsDashboard } from '@/components/health-metrics-dashboard';
import { HealthTrendsChart } from '@/components/health-trends-chart';
import { ActivityGoals } from '@/components/activity-goals';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function WearablesPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Wearable Devices</h1>
          <p className="text-muted-foreground">
            Connect and manage your wearable devices to track your health
          </p>
        </div>
      </div>

      <Tabs defaultValue="devices" className="space-y-6">
        <TabsList>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="metrics">Health Metrics</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="goals">Goals & Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="devices">
          <WearableDevices />
        </TabsContent>

        <TabsContent value="metrics">
          <HealthMetricsDashboard />
        </TabsContent>

        <TabsContent value="trends">
          <HealthTrendsChart />
        </TabsContent>

        <TabsContent value="goals">
          <ActivityGoals />
        </TabsContent>
      </Tabs>
    </div>
  );
}
