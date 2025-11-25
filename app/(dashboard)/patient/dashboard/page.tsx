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
import { HealthAlertsCard } from '@/components/health-alerts-card';
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
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {patient?.name || 'Patient'}!
          </h1>
          <p className="text-muted-foreground">Let's stay healthy today 🌟</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRequestDialogOpen(true)}
            className="relative"
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

      {/* Health Alerts */}
      <div className="mb-6">
        <HealthAlertsCard />
      </div>

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/patient/charts')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-teal-600" />
                    View Charts
                  </CardTitle>
                  <CardDescription>Track your health trends over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {readings.length} readings logged
                  </p>
                  <Button variant="outline" className="mt-4 w-full">
                    View Analytics →
                  </Button>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/patient/progress')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-600" />
                    Your Progress
                  </CardTitle>
                  <CardDescription>Badges, streaks, and achievements</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Level {Math.floor(stats.totalPoints / 100) + 1} • {stats.totalPoints} points
                  </p>
                  <Button variant="outline" className="mt-4 w-full">
                    View Progress →
                  </Button>
                </CardContent>
              </Card>
            </div>

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

          {/* Clinical Notes Tab */}
          <TabsContent value="notes" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-500" />
                  Clinical Notes from Your Doctor
                </CardTitle>
                <CardDescription>
                  View medical notes, diagnoses, and recommendations from your healthcare provider
                </CardDescription>
              </CardHeader>
              <CardContent>
                {clinicalNotes.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium mb-2">No Clinical Notes Yet</p>
                    <p className="text-sm">Your doctor hasn't added any notes. They will appear here when available.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {clinicalNotes.map((note) => (
                      <div
                        key={note.id}
                        className={`p-6 border-2 rounded-lg transition-all hover:shadow-md ${
                          note.isPriority 
                            ? 'border-red-300 bg-red-50/50' 
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-lg text-gray-900">Dr. {note.doctorName}</p>
                              {note.isPriority && (
                                <Badge className="bg-red-600 text-white">
                                  <Bell className="h-3 w-3 mr-1" />
                                  Priority
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {format(note.createdAt, 'MMMM d, yyyy • h:mm a')}
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          {note.diagnosis && (
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                              <p className="text-xs font-bold text-blue-900 uppercase mb-2 flex items-center gap-1">
                                <Activity className="h-4 w-4" />
                                Diagnosis
                              </p>
                              <p className="text-gray-800 font-medium">{note.diagnosis}</p>
                            </div>
                          )}
                          
                          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                            <p className="text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-1">
                              <FileText className="h-4 w-4" />
                              Clinical Notes
                            </p>
                            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{note.note}</p>
                          </div>
                          
                          {note.recommendation && (
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                              <p className="text-xs font-bold text-green-900 uppercase mb-2 flex items-center gap-1">
                                <Heart className="h-4 w-4" />
                                Recommendations
                              </p>
                              <p className="text-gray-800">{note.recommendation}</p>
                            </div>
                          )}
                          
                          {note.medications && note.medications.length > 0 && (
                            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                              <p className="text-xs font-bold text-purple-900 uppercase mb-3 flex items-center gap-1">
                                <Trophy className="h-4 w-4" />
                                Medications
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {note.medications.map((med, idx) => (
                                  <Badge key={idx} variant="secondary" className="px-3 py-1">
                                    {med}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
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
