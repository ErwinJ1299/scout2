'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { FirestoreService } from '@/lib/services/firestore.service';
import { Patient, Reading } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp } from 'lucide-react';
import { HealthChart } from '@/components/charts/HealthChart';

export default function ChartsPage() {
  const router = useRouter();
  const { user, userRole, loading } = useAuthStore();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);

  useEffect(() => {
    if (!loading && (!user || userRole !== 'patient')) {
      router.push('/login');
    }
  }, [user, userRole, loading, router]);

  useEffect(() => {
    if (!user) return;

    const unsubscribePatient = FirestoreService.subscribeToPatient(user.uid, setPatient);
    const unsubscribeReadings = FirestoreService.subscribeToReadings(user.uid, setReadings, 30);

    return () => {
      unsubscribePatient();
      unsubscribeReadings();
    };
  }, [user]);

  const sortedReadings = useMemo(() => {
    return [...readings].sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
      const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
      return dateA.getTime() - dateB.getTime();
    });
  }, [readings]);

  const formatDate = (date: Date | any) => {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const bpData = useMemo(() => {
    return sortedReadings
      .filter(r => r.bpSystolic && r.bpDiastolic)
      .map(r => ({
        date: formatDate(r.createdAt),
        value: r.bpSystolic!,
        value2: r.bpDiastolic!
      }));
  }, [sortedReadings]);

  const glucoseData = useMemo(() => {
    return sortedReadings
      .filter(r => r.glucose)
      .map(r => ({
        date: formatDate(r.createdAt),
        value: r.glucose!
      }));
  }, [sortedReadings]);

  const heartRateData = useMemo(() => {
    return sortedReadings
      .filter(r => r.heartRate)
      .map(r => ({
        date: formatDate(r.createdAt),
        value: r.heartRate!
      }));
  }, [sortedReadings]);

  const stepsData = useMemo(() => {
    return sortedReadings
      .filter(r => r.steps)
      .map(r => ({
        date: formatDate(r.createdAt),
        value: r.steps!
      }));
  }, [sortedReadings]);

  const weightData = useMemo(() => {
    return sortedReadings
      .filter(r => r.weight)
      .map(r => ({
        date: formatDate(r.createdAt),
        value: r.weight!
      }));
  }, [sortedReadings]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-teal-600" />
            Health Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your health metrics over time
          </p>
        </div>
        <Button
          onClick={() => router.push('/patient/add-reading')}
          className="bg-teal-600 hover:bg-teal-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Reading
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Readings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{readings.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Blood Pressure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {readings.filter((r) => r.bpSystolic).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Glucose Readings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {readings.filter((r) => r.glucose).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Heart Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {readings.filter((r) => r.heartRate).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Blood Pressure */}
        <HealthChart
          type="line"
          title="Blood Pressure"
          subtitle="Systolic & Diastolic Trends"
          dataset={bpData}
          twoLineMode={true}
          unit="mmHg"
          color={{ start: '#ff4d6d', end: '#ff1e42' }} // Systolic Red
          color2={{ start: '#ffa726', end: '#ff9800' }} // Diastolic Orange
        />

        {/* Glucose */}
        <HealthChart
          type="line"
          title="Blood Glucose"
          subtitle="Sugar Level Trends"
          dataset={glucoseData}
          unit="mg/dL"
          color={{ start: '#4285f4', end: '#7baaf7' }} // Blue
        />

        {/* Heart Rate */}
        <HealthChart
          type="line"
          title="Heart Rate"
          subtitle="BPM Trends"
          dataset={heartRateData}
          unit="bpm"
          color={{ start: '#e91e63', end: '#ff6090' }} // Pink
        />

        {/* Weight */}
        <HealthChart
          type="line"
          title="Weight"
          subtitle="Body Weight Trends"
          dataset={weightData}
          unit="kg"
          color={{ start: '#7e57c2', end: '#9575cd' }} // Purple
        />

        {/* Steps - Full Width */}
        <div className="lg:col-span-2">
          <HealthChart
            type="bar"
            title="Daily Steps"
            subtitle="Activity Progress"
            dataset={stepsData}
            unit="steps"
            color={{ start: '#26a69a', end: '#43a047' }} // Teal to Green
          />
        </div>
      </div>
    </div>
  );
}
