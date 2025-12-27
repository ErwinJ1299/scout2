'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/lib/store/auth.store';
import { Activity, Heart, Moon, Flame, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PatientMetrics {
  patientId: string;
  patientName: string;
  latestMetrics: {
    heart_rate?: { value: number; timestamp: Date; trend: 'up' | 'down' | 'stable' };
    steps?: { value: number; timestamp: Date; trend: 'up' | 'down' | 'stable' };
    sleep?: { value: number; timestamp: Date; trend: 'up' | 'down' | 'stable' };
    calories?: { value: number; timestamp: Date; trend: 'up' | 'down' | 'stable' };
  };
  alerts: string[];
}

export function DoctorPatientMetrics() {
  const { user } = useAuthStore();
  const [patients, setPatients] = useState<PatientMetrics[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPatientsMetrics();
    }
  }, [user]);

  const loadPatientsMetrics = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get doctor's assigned patients
      const patientsRef = collection(db, 'patients');
      const q = query(patientsRef, where('doctorId', '==', user.uid));
      const patientsSnapshot = await getDocs(q);

      const patientsData: PatientMetrics[] = [];

      for (const patientDoc of patientsSnapshot.docs) {
        const patientData = patientDoc.data();
        const patientId = patientDoc.id;

        try {
          // Get latest metrics for this patient
          const metricsRef = collection(db, 'healthMetrics');
          const metricsQuery = query(
            metricsRef,
            where('userId', '==', patientId),
            orderBy('timestamp', 'desc'),
            limit(50)
          );

          const metricsSnapshot = await getDocs(metricsQuery);
        const metrics = metricsSnapshot.docs.map(doc => ({
          ...doc.data(),
          timestamp: doc.data().timestamp.toDate()
        })) as any[];

        // Process metrics by type
        const latestMetrics: any = {};
        const alerts: string[] = [];

        ['heart_rate', 'steps', 'sleep', 'calories'].forEach(type => {
          const typeMetrics = metrics.filter((m: any) => m.metricType === type);
          if (typeMetrics.length > 0) {
            const latest = typeMetrics[0];
            const previous = typeMetrics[1];
            
            let trend: 'up' | 'down' | 'stable' = 'stable';
            if (previous) {
              const diff = latest.value - previous.value;
              const percentChange = Math.abs(diff / previous.value) * 100;
              if (percentChange > 10) {
                trend = diff > 0 ? 'up' : 'down';
              }
            }

            latestMetrics[type] = {
              value: latest.value,
              timestamp: latest.timestamp,
              trend
            };

            // Generate alerts
            if (type === 'heart_rate') {
              if (latest.value > 100) alerts.push(`High resting heart rate: ${latest.value} bpm`);
              if (latest.value < 50) alerts.push(`Low resting heart rate: ${latest.value} bpm`);
            }
            if (type === 'sleep' && latest.value < 6) {
              alerts.push(`Insufficient sleep: ${latest.value.toFixed(1)} hours`);
            }
            if (type === 'steps' && latest.value < 5000) {
              alerts.push(`Low activity: ${latest.value} steps`);
            }
          }
        });

        patientsData.push({
          patientId,
          patientName: patientData.name || 'Unknown Patient',
          latestMetrics,
          alerts
        });
        } catch (patientError: any) {
          // Skip this patient if index is building or permissions issue
          if (patientError?.code === 'failed-precondition' || patientError?.message?.includes('index')) {
            console.log(`⏳ Firestore index building for patient ${patientId}`);
          } else if (patientError?.code === 'permission-denied') {
            console.log(`⚠️ No permission to access metrics for patient ${patientId}`);
          } else {
            console.error(`Error loading metrics for patient ${patientId}:`, patientError);
          }
        }
      }

      setPatients(patientsData);
    } catch (error: any) {
      if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
        console.log('⏳ Firestore index is building, data will be available soon');
      } else {
        console.error('Error loading patients metrics:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const filteredPatients = selectedPatient === 'all' 
    ? patients 
    : patients.filter(p => p.patientId === selectedPatient);

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading patient metrics...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Patient Health Metrics</CardTitle>
              <CardDescription>Monitor your patients' wearable device data</CardDescription>
            </div>
            <Select value={selectedPatient} onValueChange={setSelectedPatient}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select patient" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Patients</SelectItem>
                {patients.map(p => (
                  <SelectItem key={p.patientId} value={p.patientId}>
                    {p.patientName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {filteredPatients.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No patient metrics available. Patients need to connect wearable devices.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredPatients.map(patient => (
            <Card key={patient.patientId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">{patient.patientName}</CardTitle>
                  {patient.alerts.length > 0 && (
                    <Badge variant="destructive">{patient.alerts.length} Alert{patient.alerts.length > 1 ? 's' : ''}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Alerts */}
                {patient.alerts.length > 0 && (
                  <div className="space-y-2">
                    {patient.alerts.map((alert, idx) => (
                      <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                        ⚠️ {alert}
                      </div>
                    ))}
                  </div>
                )}

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Heart Rate */}
                  {patient.latestMetrics.heart_rate && (
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Heart className="h-5 w-5 text-red-500" />
                        {getTrendIcon(patient.latestMetrics.heart_rate.trend)}
                      </div>
                      <div className="text-2xl font-bold">{patient.latestMetrics.heart_rate.value}</div>
                      <div className="text-xs text-muted-foreground">bpm</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {patient.latestMetrics.heart_rate.timestamp.toLocaleDateString()}
                      </div>
                    </div>
                  )}

                  {/* Steps */}
                  {patient.latestMetrics.steps && (
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Activity className="h-5 w-5 text-blue-500" />
                        {getTrendIcon(patient.latestMetrics.steps.trend)}
                      </div>
                      <div className="text-2xl font-bold">{patient.latestMetrics.steps.value.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">steps</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {patient.latestMetrics.steps.timestamp.toLocaleDateString()}
                      </div>
                    </div>
                  )}

                  {/* Sleep */}
                  {patient.latestMetrics.sleep && (
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Moon className="h-5 w-5 text-purple-500" />
                        {getTrendIcon(patient.latestMetrics.sleep.trend)}
                      </div>
                      <div className="text-2xl font-bold">{patient.latestMetrics.sleep.value.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">hours</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {patient.latestMetrics.sleep.timestamp.toLocaleDateString()}
                      </div>
                    </div>
                  )}

                  {/* Calories */}
                  {patient.latestMetrics.calories && (
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Flame className="h-5 w-5 text-orange-500" />
                        {getTrendIcon(patient.latestMetrics.calories.trend)}
                      </div>
                      <div className="text-2xl font-bold">{patient.latestMetrics.calories.value.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">kcal</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {patient.latestMetrics.calories.timestamp.toLocaleDateString()}
                      </div>
                    </div>
                  )}
                </div>

                {Object.keys(patient.latestMetrics).length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    No wearable data available for this patient.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
