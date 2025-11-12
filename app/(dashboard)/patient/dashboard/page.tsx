'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { FirestoreService } from '@/lib/services/firestore.service';
import { Patient, Reminder, Reading, GamificationProgress } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  Heart,
  TrendingUp,
  Bell,
  Trophy,
  Plus,
  Flame,
  Target,
} from 'lucide-react';
import { format } from 'date-fns';
import { HealthCharts } from '@/components/health-charts';

export default function PatientDashboard() {
  const router = useRouter();
  const { user, userRole, loading } = useAuthStore();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [progress, setProgress] = useState<GamificationProgress | null>(null);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && (!user || userRole !== 'patient')) {
      router.push('/login');
    }
  }, [user, userRole, loading, router]);

  useEffect(() => {
    if (!user) return;

    const unsubscribePatient = FirestoreService.subscribeToPatient(user.uid, setPatient);
    const unsubscribeReminders = FirestoreService.subscribeToReminders(user.uid, setReminders);
    const unsubscribeReadings = FirestoreService.subscribeToReadings(user.uid, setReadings, 10);
    const unsubscribeProgress = FirestoreService.subscribeToGamificationProgress(
      user.uid,
      setProgress
    );

    return () => {
      unsubscribePatient();
      unsubscribeReminders();
      unsubscribeReadings();
      unsubscribeProgress();
    };
  }, [user]);

  const handleCompleteTask = async (reminderId: string, taskType: string) => {
    if (!user) return;

    // Add to completed set
    setCompletedTaskIds((prev) => new Set([...prev, reminderId]));

    // Award points (10-20 based on task type)
    const pointsMap: Record<string, number> = {
      medicine: 20,
      exercise: 15,
      checkup: 10,
      meal: 10,
      water: 10,
      other: 10,
    };
    const points = pointsMap[taskType] || 10;

    // Save task completion
    await FirestoreService.addTaskCompletion({
      id: '',
      patientId: user.uid,
      reminderId,
      completedAt: new Date(),
      taskType,
      pointsAwarded: points,
    });

    // Update patient points
    if (patient) {
      await FirestoreService.updatePatientGamification(
        user.uid,
        patient.points + points,
        patient.streak
      );
    }
  };

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

  const todayReminders = reminders.filter((r) => r.isActive);
  const latestReading = readings[0];

  return (
    <>
      {/* Welcome Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {patient?.name || 'Patient'}!
          </h1>
          <p className="text-muted-foreground">Let's stay healthy today 🌟</p>
        </div>
      </div>
      {/* Quick Actions */}
      <div className="flex gap-3 mb-6">
        <Button
          onClick={() => router.push('/patient/add-reading')}
          className="bg-teal-600 hover:bg-teal-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Log Health Data
        </Button>
        <Button onClick={() => router.push('/patient/add-reminder')} variant="outline">
          <Bell className="h-4 w-4 mr-2" />
          Add Reminder
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Points</CardTitle>
              <Trophy className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{patient?.points || 0}</div>
              <p className="text-xs text-gray-600 mt-1">Keep completing tasks!</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Streak</CardTitle>
              <Flame className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{patient?.streak || 0} days</div>
              <p className="text-xs text-gray-600 mt-1">Daily consistency</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Tasks Today</CardTitle>
              <Target className="h-4 w-4 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {completedTaskIds.size}/{todayReminders.length}
              </div>
              <p className="text-xs text-gray-600 mt-1">Tasks completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="reminders">Reminders</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Today's Tasks */}
            <Card>
              <CardHeader>
                <CardTitle>Today's Tasks</CardTitle>
                <CardDescription>Complete tasks to earn points and maintain your streak</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {todayReminders.length === 0 ? (
                  <p className="text-sm text-gray-600">No reminders for today</p>
                ) : (
                  todayReminders.map((reminder) => {
                    const isCompleted = completedTaskIds.has(reminder.id);
                    return (
                      <div
                        key={reminder.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">
                            {reminder.type === 'medicine' && '💊'}
                            {reminder.type === 'exercise' && '🏃'}
                            {reminder.type === 'checkup' && '🏥'}
                            {reminder.type === 'meal' && '🍽️'}
                            {reminder.type === 'water' && '💧'}
                            {reminder.type === 'other' && '📌'}
                          </div>
                          <div>
                            <p className="font-medium">{reminder.label}</p>
                            <p className="text-sm text-gray-600">{reminder.time}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleCompleteTask(reminder.id, reminder.type)}
                          disabled={isCompleted}
                          variant={isCompleted ? 'secondary' : 'default'}
                        >
                          {isCompleted ? '✓ Done' : 'Complete'}
                        </Button>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Latest Reading */}
            {latestReading && (
              <Card>
                <CardHeader>
                  <CardTitle>Latest Health Reading</CardTitle>
                  <CardDescription>
                    {format(latestReading.createdAt, 'MMM d, yyyy • h:mm a')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {latestReading.glucose && (
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-gray-600">Glucose</p>
                        <p className="text-xl font-bold">{latestReading.glucose} mg/dL</p>
                      </div>
                    )}
                    {latestReading.bpSystolic && latestReading.bpDiastolic && (
                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <p className="text-sm text-gray-600">Blood Pressure</p>
                        <p className="text-xl font-bold">
                          {latestReading.bpSystolic}/{latestReading.bpDiastolic}
                        </p>
                      </div>
                    )}
                    {latestReading.heartRate && (
                      <div className="text-center p-3 bg-pink-50 rounded-lg">
                        <p className="text-sm text-gray-600">Heart Rate</p>
                        <p className="text-xl font-bold">{latestReading.heartRate} bpm</p>
                      </div>
                    )}
                    {latestReading.steps && (
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <p className="text-sm text-gray-600">Steps</p>
                        <p className="text-xl font-bold">{latestReading.steps.toLocaleString()}</p>
                      </div>
                    )}
                    {latestReading.weight && (
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <p className="text-sm text-gray-600">Weight</p>
                        <p className="text-xl font-bold">{latestReading.weight} kg</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Button onClick={() => router.push('/patient/add-reading')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Health Reading
            </Button>
          </TabsContent>

          {/* Reminders Tab */}
          <TabsContent value="reminders" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>All Reminders</CardTitle>
                <CardDescription>Manage your daily health reminders</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {reminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">
                        {reminder.type === 'medicine' && '💊'}
                        {reminder.type === 'exercise' && '🏃'}
                        {reminder.type === 'checkup' && '🏥'}
                        {reminder.type === 'meal' && '🍽️'}
                        {reminder.type === 'water' && '💧'}
                        {reminder.type === 'other' && '📌'}
                      </div>
                      <div>
                        <p className="font-medium">{reminder.label}</p>
                        <p className="text-sm text-gray-600">{reminder.time}</p>
                        <p className="text-xs text-gray-500">
                          {reminder.daysOfWeek.length === 7 ? 'Daily' : 'Custom schedule'}
                        </p>
                      </div>
                    </div>
                    <Badge variant={reminder.isActive ? 'default' : 'secondary'}>
                      {reminder.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Button onClick={() => router.push('/patient/add-reminder')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Reminder
            </Button>
          </TabsContent>

          {/* Progress Tab */}
          <TabsContent value="progress" className="space-y-6">
            {/* Health Data Charts */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Health Trends</h3>
              <HealthCharts readings={readings} />
            </div>

            {/* Gamification Progress */}
            <h3 className="text-lg font-semibold mb-4">Achievement Progress</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Your Progress</CardTitle>
                  <CardDescription>Track your health journey</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Total Points</span>
                      <span className="text-sm font-bold">{progress?.totalPoints || 0}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-teal-600 h-2 rounded-full"
                        style={{ width: `${Math.min(((progress?.totalPoints || 0) / 1000) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Current Streak</span>
                      <span className="text-sm font-bold">{progress?.currentStreak || 0} days</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-orange-600 h-2 rounded-full"
                        style={{ width: `${Math.min(((progress?.currentStreak || 0) / 30) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm text-gray-600">Longest Streak</p>
                    <p className="text-2xl font-bold">{progress?.longestStreak || 0} days</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Badges</CardTitle>
                  <CardDescription>Achievements unlocked</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {(progress?.earnedBadges || []).length === 0 ? (
                      <p className="col-span-2 text-sm text-gray-600">
                        Complete tasks to earn badges!
                      </p>
                    ) : (
                      progress?.earnedBadges.map((badge) => (
                        <div
                          key={badge}
                          className="text-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                        >
                          <div className="text-3xl mb-2">🏆</div>
                          <p className="text-xs font-medium">{badge}</p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </>
  );
}
