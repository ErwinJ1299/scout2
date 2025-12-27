'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { FirestoreService } from '@/lib/services/firestore.service';
import { Patient, Reminder, Reading, GamificationProgress, DoctorPatientRequest, ClinicalNote } from '@/types';
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
  UserPlus,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { HealthCharts } from '@/components/health-charts';
import { DoctorRequestsDialog } from '@/components/doctor-requests-dialog';
import { HealthReportsCard } from '@/components/health-reports-card';

export default function PatientDashboard() {
  const router = useRouter();
  const { user, userRole, loading } = useAuthStore();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [progress, setProgress] = useState<GamificationProgress | null>(null);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const [requests, setRequests] = useState<DoctorPatientRequest[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNote[]>([]);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [stats, setStats] = useState({ totalPoints: 0, currentStreak: 0, longestStreak: 0, achievementsCount: 0 });

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
      (progressData) => {
        setProgress(progressData);
        // Update stats from gamification progress for consistency
        if (progressData) {
          setStats(prev => ({
            ...prev,
            totalPoints: progressData.totalPoints || 0,
            currentStreak: progressData.currentStreak || 0,
            longestStreak: progressData.longestStreak || 0,
          }));
        }
      }
    );
    const unsubscribeRequests = FirestoreService.subscribeToPatientRequests(user.uid, setRequests);
    const unsubscribeNotes = FirestoreService.subscribeToClinicalNotes(user.uid, setClinicalNotes);

    // Fetch achievements count only (not points/streaks)
    const fetchAchievements = async () => {
      const response = await fetch(`/api/achievements?userId=${user.uid}`);
      if (response.ok) {
        const data = await response.json();
        setStats(prev => ({
          ...prev,
          achievementsCount: data.stats?.achievementsCount || 0,
        }));
      }
    };
    fetchAchievements();

    return () => {
      unsubscribePatient();
      unsubscribeReminders();
      unsubscribeReadings();
      unsubscribeProgress();
      unsubscribeRequests();
      unsubscribeNotes();
    };
  }, [user]);

  const handleCompleteTask = async (reminderId: string, taskType: string) => {
    if (!user) return;

    // Check if already completed today
    if (completedTaskIds.has(reminderId)) {
      alert('You have already completed this task today!');
      return;
    }

    // Add to completed set
    setCompletedTaskIds((prev) => new Set([...prev, reminderId]));

    try {
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

      // Calculate new streak with proper logic
      let newStreak = 1;
      let updatedProgress = progress;
      const now = new Date();

      if (progress) {
        const lastCompleted = new Date(progress.lastTaskCompletedAt);

        // Get dates without time for comparison
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const lastDate = new Date(lastCompleted.getFullYear(), lastCompleted.getMonth(), lastCompleted.getDate());

        // Calculate days difference
        const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff === 0) {
          // Same day - keep current streak
          newStreak = progress.currentStreak || 1;
        } else if (daysDiff === 1) {
          // Next day - increment streak
          newStreak = (progress.currentStreak || 0) + 1;
        } else {
          // More than 1 day gap - reset streak to 1
          newStreak = 1;
        }

        updatedProgress = {
          ...progress,
          totalPoints: (progress.totalPoints || 0) + points,
          currentStreak: newStreak,
          longestStreak: Math.max(progress.longestStreak || 0, newStreak),
          lastTaskCompletedAt: now,
          tasksCompletedToday: daysDiff === 0 ? (progress.tasksCompletedToday || 0) + 1 : 1,
          lastUpdated: now,
        };

        await FirestoreService.saveGamificationProgress(updatedProgress);

        // Update local progress state immediately
        setProgress(updatedProgress);
      }

      // Update patient points and streak
      if (patient) {
        const newPoints = (patient.points || 0) + points;
        await FirestoreService.updatePatientGamification(
          user.uid,
          newPoints,
          newStreak
        );

        // Update local patient state immediately
        setPatient({
          ...patient,
          points: newPoints,
          streak: newStreak
        });
      }

      // Update stats state immediately with the new values
      if (updatedProgress) {
        setStats(prev => ({
          ...prev,
          totalPoints: updatedProgress.totalPoints,
          currentStreak: updatedProgress.currentStreak,
          longestStreak: updatedProgress.longestStreak
        }));
      }

      // Show success message
      alert(`Task completed! +${points} points earned!`);
    } catch (error) {
      console.error('Error completing task:', error);
      // Remove from completed set on error
      setCompletedTaskIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(reminderId);
        return newSet;
      });
      alert('Failed to complete task. Please try again.');
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
  const pendingRequestsCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <>
      {/* Welcome Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Welcome back, {patient?.name || 'Patient'}!
          </h1>
          <p className="text-gray-700 dark:text-gray-200">Let's stay healthy today 🌟</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRequestDialogOpen(true)}
            className="relative border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-700"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Doctor Requests
            {pendingRequestsCount > 0 && (
              <Badge className="ml-2 px-1.5 py-0.5 h-5 min-w-5 text-xs" variant="destructive">
                {pendingRequestsCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Alert for pending requests */}
      {pendingRequestsCount > 0 && (
        <Card className="mb-6 border-orange-300 bg-orange-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 p-2 rounded-full">
                  <UserPlus className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold">
                    {pendingRequestsCount} New Doctor {pendingRequestsCount === 1 ? 'Request' : 'Requests'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    You have pending connection requests from doctors
                  </p>
                </div>
              </div>
              <Button onClick={() => setIsRequestDialogOpen(true)} size="sm">
                Review Requests
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Button
          onClick={() => router.push('/patient/add-reading')}
          className="bg-teal-600 hover:bg-teal-700 text-white shadow-md"
        >
          <Plus className="h-4 w-4 mr-2" />
          Log Health Data
        </Button>
        <Button
          onClick={() => router.push('/patient/add-reminder')}
          className="bg-white border-2 border-teal-600 text-teal-700 hover:bg-teal-50 shadow-md"
        >
          <Bell className="h-4 w-4 mr-2" />
          Add Reminder
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="relative overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 border-yellow-200 hover:border-yellow-400 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30 dark:bg-gray-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
            <CardTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100">Points</CardTitle>
            <Trophy className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-4xl font-bold text-yellow-600 dark:text-yellow-500">{stats.totalPoints}</div>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">Keep completing tasks!</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 border-orange-200 hover:border-orange-400 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 dark:bg-gray-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
            <CardTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100">Streak</CardTitle>
            <Flame className="h-5 w-5 text-orange-600 dark:text-orange-500" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-4xl font-bold text-orange-600 dark:text-orange-500">{stats.currentStreak} days</div>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">Daily consistency</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 border-teal-200 hover:border-teal-400 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30 dark:bg-gray-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
            <CardTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100">Tasks Today</CardTitle>
            <Target className="h-5 w-5 text-teal-600 dark:text-teal-500" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-4xl font-bold text-teal-600 dark:text-teal-500">
              {completedTaskIds.size}/{todayReminders.length}
            </div>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">Tasks completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="notes">Clinical Notes</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* Quick Links to Charts and Progress */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card
              className="group cursor-pointer overflow-hidden border-2 border-teal-100 dark:border-teal-900/50 hover:border-teal-300 dark:hover:border-teal-700 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 relative"
              onClick={() => router.push('/patient/charts')}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-cyan-500/5 dark:from-teal-500/10 dark:to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              <CardHeader className="relative">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-900/50 dark:to-cyan-900/50 rounded-xl group-hover:scale-110 transition-transform duration-300">
                    <TrendingUp className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">View Charts</CardTitle>
                    <CardDescription className="mt-1">Track your health trends over time</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1 px-3 py-1 bg-teal-50 dark:bg-teal-950/50 rounded-full">
                    <Activity className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    <span className="font-medium text-teal-700 dark:text-teal-300">{readings.length} readings logged</span>
                  </div>
                </div>
                <button className="w-full py-3 px-4 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-medium rounded-xl shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 transition-all duration-300 flex items-center justify-center gap-2">
                  View Analytics
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </CardContent>
            </Card>

            <Card
              className="group cursor-pointer overflow-hidden border-2 border-amber-100 dark:border-amber-900/50 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 relative"
              onClick={() => router.push('/patient/progress')}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5 dark:from-amber-500/10 dark:to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              <CardHeader className="relative">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/50 dark:to-orange-900/50 rounded-xl group-hover:scale-110 transition-transform duration-300">
                    <Trophy className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">Your Progress</CardTitle>
                    <CardDescription className="mt-1">Badges, streaks, and achievements</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1 px-3 py-1 bg-amber-50 dark:bg-amber-950/50 rounded-full">
                    <span className="text-lg">⭐</span>
                    <span className="font-medium text-amber-700 dark:text-amber-300">Level {Math.floor(stats.totalPoints / 100) + 1} • {stats.totalPoints} points</span>
                  </div>
                </div>
                <button className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium rounded-xl shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-300 flex items-center justify-center gap-2">
                  View Progress
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </CardContent>
            </Card>
          </div>

          {/* Today's Tasks */}
          <Card className="overflow-hidden border-2 border-indigo-100 dark:border-indigo-900/50">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-b border-indigo-100 dark:border-indigo-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-full">
                  <Target className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Today's Tasks</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <span>Complete tasks to earn points and maintain your streak</span>
                    <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-full text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      {completedTaskIds.size}/{todayReminders.length}
                    </span>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              {todayReminders.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <Bell className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No reminders for today</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Add a reminder to get started</p>
                </div>
              ) : (
                todayReminders.map((reminder) => {
                  const isCompleted = completedTaskIds.has(reminder.id);
                  const typeColors: Record<string, string> = {
                    medicine: 'from-pink-50 to-rose-50 dark:from-pink-950/40 dark:to-rose-950/40 border-pink-200 dark:border-pink-800',
                    exercise: 'from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40 border-green-200 dark:border-green-800',
                    checkup: 'from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-blue-200 dark:border-blue-800',
                    meal: 'from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 border-orange-200 dark:border-orange-800',
                    water: 'from-cyan-50 to-sky-50 dark:from-cyan-950/40 dark:to-sky-950/40 border-cyan-200 dark:border-cyan-800',
                    other: 'from-gray-50 to-slate-50 dark:from-gray-950/40 dark:to-slate-950/40 border-gray-200 dark:border-gray-800',
                  };
                  return (
                    <div
                      key={reminder.id}
                      className={`group flex items-center justify-between p-4 bg-gradient-to-r ${typeColors[reminder.type] || typeColors.other} rounded-xl border transition-all duration-300 hover:shadow-md ${isCompleted ? 'opacity-60' : 'hover:-translate-x-1'}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                          <span className="text-2xl">
                            {reminder.type === 'medicine' && '💊'}
                            {reminder.type === 'exercise' && '🏃'}
                            {reminder.type === 'checkup' && '🏥'}
                            {reminder.type === 'meal' && '🍽️'}
                            {reminder.type === 'water' && '💧'}
                            {reminder.type === 'other' && '📌'}
                          </span>
                        </div>
                        <div>
                          <p className={`font-semibold text-gray-900 dark:text-gray-100 ${isCompleted ? 'line-through' : ''}`}>{reminder.label}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-500 dark:text-gray-400">{reminder.time}</span>
                            {isCompleted && (
                              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/50 rounded-full text-xs font-semibold text-green-600 dark:text-green-400">
                                ✓ Completed
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        className="complete-button"
                        onClick={(e) => { e.stopPropagation(); handleCompleteTask(reminder.id, reminder.type); }}
                        disabled={isCompleted}
                      >
                        {isCompleted ? '✓ Done' : 'Complete'}
                      </button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Latest Reading */}
          {latestReading && (
            <Card className="overflow-hidden border-2 border-teal-100 dark:border-teal-900/50">
              <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30 border-b border-teal-100 dark:border-teal-900/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-100 dark:bg-teal-900/50 rounded-full">
                      <Activity className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Latest Health Reading</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        {format(latestReading.createdAt, 'MMM d, yyyy • h:mm a')}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {latestReading.glucose && (
                    <div className="group relative overflow-hidden p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 rounded-xl border border-blue-200 dark:border-blue-800 hover:shadow-lg hover:scale-[1.02] transition-all duration-300">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-blue-200/30 dark:bg-blue-700/20 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">🩸</span>
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Glucose</p>
                      </div>
                      <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{latestReading.glucose}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">mg/dL</p>
                    </div>
                  )}
                  {latestReading.bpSystolic && latestReading.bpDiastolic && (
                    <div className="group relative overflow-hidden p-4 bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/40 dark:to-pink-950/40 rounded-xl border border-rose-200 dark:border-rose-800 hover:shadow-lg hover:scale-[1.02] transition-all duration-300">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-rose-200/30 dark:bg-rose-700/20 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">💓</span>
                        <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 uppercase tracking-wide">Blood Pressure</p>
                      </div>
                      <p className="text-2xl font-bold text-rose-900 dark:text-rose-100">{latestReading.bpSystolic}/{latestReading.bpDiastolic}</p>
                      <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">mmHg</p>
                    </div>
                  )}
                  {latestReading.heartRate && (
                    <div className="group relative overflow-hidden p-4 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/40 dark:to-orange-950/40 rounded-xl border border-red-200 dark:border-red-800 hover:shadow-lg hover:scale-[1.02] transition-all duration-300">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-red-200/30 dark:bg-red-700/20 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                      <div className="flex items-center gap-2 mb-2">
                        <Heart className="h-5 w-5 text-red-500" />
                        <p className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide">Heart Rate</p>
                      </div>
                      <p className="text-2xl font-bold text-red-900 dark:text-red-100">{latestReading.heartRate}</p>
                      <p className="text-xs text-red-600 dark:text-red-400 font-medium">bpm</p>
                    </div>
                  )}
                  {latestReading.steps && (
                    <div className="group relative overflow-hidden p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 hover:shadow-lg hover:scale-[1.02] transition-all duration-300">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-200/30 dark:bg-emerald-700/20 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">👟</span>
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">Steps</p>
                      </div>
                      <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{latestReading.steps.toLocaleString()}</p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">today</p>
                    </div>
                  )}
                  {latestReading.weight && (
                    <div className="group relative overflow-hidden p-4 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/40 rounded-xl border border-violet-200 dark:border-violet-800 hover:shadow-lg hover:scale-[1.02] transition-all duration-300">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-violet-200/30 dark:bg-violet-700/20 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">⚖️</span>
                        <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide">Weight</p>
                      </div>
                      <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">{latestReading.weight}</p>
                      <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">kg</p>
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

        {/* Clinical Notes Tab */}
        <TabsContent value="notes" className="space-y-6">
          <Card className="overflow-hidden border-2 border-indigo-100 dark:border-indigo-900/50">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-b border-indigo-100 dark:border-indigo-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-full">
                  <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Clinical Notes from Your Doctor</CardTitle>
                  <CardDescription>
                    View medical notes, diagnoses, and recommendations from your healthcare provider
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {clinicalNotes.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium mb-2">No Clinical Notes Yet</p>
                  <p className="text-sm">Your doctor hasn't added any notes. They will appear here when available.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {clinicalNotes.map((note) => (
                    <div key={note.id} className="clinical-note-card">
                      <div className="clinical-note-container">
                        <div className={`clinical-note-status ${note.isPriority ? 'priority' : ''}`}></div>
                        <div className="clinical-note-content">
                          <div className="clinical-note-header">
                            <div className="flex items-center gap-2">
                              <span className="clinical-note-doctor">Dr. {note.doctorName}</span>
                              {note.isPriority && (
                                <span className="clinical-note-priority-badge">
                                  <Bell className="h-3 w-3" />
                                  Priority
                                </span>
                              )}
                            </div>
                            <p className="clinical-note-time">
                              <FileText className="h-3 w-3" />
                              {format(note.createdAt, 'MMMM d, yyyy • h:mm a')}
                            </p>
                          </div>

                          <div className="clinical-note-sections">
                            {note.diagnosis && (
                              <div className="clinical-note-section diagnosis">
                                <p className="clinical-note-section-label text-blue-700 dark:text-blue-300">
                                  <Activity className="h-3 w-3" />
                                  Diagnosis
                                </p>
                                <p className="clinical-note-section-text">{note.diagnosis}</p>
                              </div>
                            )}

                            <div className="clinical-note-section notes">
                              <p className="clinical-note-section-label text-gray-600 dark:text-gray-300">
                                <FileText className="h-3 w-3" />
                                Clinical Notes
                              </p>
                              <p className="clinical-note-section-text">{note.note}</p>
                            </div>

                            {note.recommendation && (
                              <div className="clinical-note-section recommendation">
                                <p className="clinical-note-section-label text-green-700 dark:text-green-300">
                                  <Heart className="h-3 w-3" />
                                  Recommendations
                                </p>
                                <p className="clinical-note-section-text">{note.recommendation}</p>
                              </div>
                            )}

                            {note.medications && note.medications.length > 0 && (
                              <div className="clinical-note-section medications">
                                <p className="clinical-note-section-label text-purple-700 dark:text-purple-300">
                                  💊 Medications
                                </p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {note.medications.map((med, idx) => (
                                    <span key={idx} className="px-3 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium">
                                      {med}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="clinical-note-actions">
                            <button className="clinical-note-btn-primary">View Details</button>
                            <button className="clinical-note-btn-secondary">Mark as Read</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reminders Tab */}
        <TabsContent value="reminders" className="space-y-6">
          <Card className="overflow-hidden border-2 border-indigo-100 dark:border-indigo-900/50">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-b border-indigo-100 dark:border-indigo-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-full">
                  <Bell className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">All Reminders</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <span>Manage your daily health reminders</span>
                    <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-full text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      {reminders.filter(r => r.isActive).length} active
                    </span>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              {reminders.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <Bell className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No reminders yet</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Add a reminder to get started</p>
                </div>
              ) : (
                reminders.map((reminder) => {
                  const typeColors: Record<string, string> = {
                    medicine: 'from-pink-50 to-rose-50 dark:from-pink-950/40 dark:to-rose-950/40 border-pink-200 dark:border-pink-800',
                    exercise: 'from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40 border-green-200 dark:border-green-800',
                    checkup: 'from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-blue-200 dark:border-blue-800',
                    meal: 'from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 border-orange-200 dark:border-orange-800',
                    water: 'from-cyan-50 to-sky-50 dark:from-cyan-950/40 dark:to-sky-950/40 border-cyan-200 dark:border-cyan-800',
                    other: 'from-gray-50 to-slate-50 dark:from-gray-950/40 dark:to-slate-950/40 border-gray-200 dark:border-gray-800',
                  };
                  return (
                    <div
                      key={reminder.id}
                      className={`group flex items-center justify-between p-4 bg-gradient-to-r ${typeColors[reminder.type] || typeColors.other} rounded-xl border transition-all duration-300 hover:shadow-md hover:-translate-x-1`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                          <span className="text-2xl">
                            {reminder.type === 'medicine' && '💊'}
                            {reminder.type === 'exercise' && '🏃'}
                            {reminder.type === 'checkup' && '🏥'}
                            {reminder.type === 'meal' && '🍽️'}
                            {reminder.type === 'water' && '💧'}
                            {reminder.type === 'other' && '📌'}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{reminder.label}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-500 dark:text-gray-400">{reminder.time}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              • {reminder.daysOfWeek.length === 7 ? 'Daily' : 'Custom schedule'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${reminder.isActive
                          ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                        }`}>
                        {reminder.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Button onClick={() => router.push('/patient/add-reminder')} className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-lg shadow-indigo-500/25">
            <Plus className="h-4 w-4 mr-2" />
            Add Reminder
          </Button>
        </TabsContent>
      </Tabs>

      {/* Health Reports */}
      <div className="mt-6">
        <HealthReportsCard userId={user?.uid || ''} />
      </div>

      {/* Doctor Requests Dialog */}
      <DoctorRequestsDialog
        patientId={user?.uid || ''}
        open={isRequestDialogOpen}
        onOpenChange={setIsRequestDialogOpen}
      />
    </>
  );
}
