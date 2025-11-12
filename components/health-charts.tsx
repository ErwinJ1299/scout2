'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Reading } from '@/types';
import { format } from 'date-fns';

interface HealthChartsProps {
  readings: Reading[];
}

export function HealthCharts({ readings }: HealthChartsProps) {
  // Prepare data for blood pressure chart
  const bpData = readings
    .filter((r) => r.bpSystolic && r.bpDiastolic)
    .slice(0, 10)
    .reverse()
    .map((r) => ({
      date: format(r.createdAt, 'MMM d'),
      systolic: r.bpSystolic,
      diastolic: r.bpDiastolic,
    }));

  // Prepare data for glucose chart
  const glucoseData = readings
    .filter((r) => r.glucose)
    .slice(0, 10)
    .reverse()
    .map((r) => ({
      date: format(r.createdAt, 'MMM d'),
      glucose: r.glucose,
    }));

  // Prepare data for heart rate chart
  const heartRateData = readings
    .filter((r) => r.heartRate)
    .slice(0, 10)
    .reverse()
    .map((r) => ({
      date: format(r.createdAt, 'MMM d'),
      heartRate: r.heartRate,
    }));

  // Prepare data for steps chart
  const stepsData = readings
    .filter((r) => r.steps)
    .slice(0, 7)
    .reverse()
    .map((r) => ({
      date: format(r.createdAt, 'MMM d'),
      steps: r.steps,
    }));

  // Prepare data for weight chart
  const weightData = readings
    .filter((r) => r.weight)
    .slice(0, 10)
    .reverse()
    .map((r) => ({
      date: format(r.createdAt, 'MMM d'),
      weight: r.weight,
    }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Blood Pressure Chart */}
      {bpData.length > 0 && (
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Blood Pressure Trends</CardTitle>
            <CardDescription>Systolic and Diastolic readings over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={bpData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="systolic"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Systolic"
                />
                <Line
                  type="monotone"
                  dataKey="diastolic"
                  stroke="#f97316"
                  strokeWidth={2}
                  name="Diastolic"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Blood Glucose Chart */}
      {glucoseData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Blood Glucose</CardTitle>
            <CardDescription>Glucose levels (mg/dL)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={glucoseData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="glucose"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Glucose"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Heart Rate Chart */}
      {heartRateData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Heart Rate</CardTitle>
            <CardDescription>Beats per minute (bpm)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={heartRateData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="heartRate"
                  stroke="#ec4899"
                  strokeWidth={2}
                  name="Heart Rate"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Daily Steps Chart */}
      {stepsData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Steps</CardTitle>
            <CardDescription>Physical activity tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stepsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="steps" fill="#10b981" name="Steps" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Weight Chart */}
      {weightData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Weight Trends</CardTitle>
            <CardDescription>Body weight (kg)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={weightData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  name="Weight"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {readings.length === 0 && (
        <Card className="col-span-2">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No health data available yet. Start logging your health readings to see charts!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
