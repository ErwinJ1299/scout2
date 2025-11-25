'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { collection, doc, setDoc, getDoc, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/lib/store/auth.store';
import { useToast } from '@/hooks/use-toast';
import { Target, TrendingUp, Award } from 'lucide-react';

interface Goals {
  steps: number;
  calories: number;
  sleep: number;
}

interface TodaysProgress {
  steps: number;
  calories: number;
  sleep: number;
}

export function ActivityGoals() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [goals, setGoals] = useState<Goals>({
    steps: 10000,
    calories: 2000,
    sleep: 8
  });
  const [progress, setProgress] = useState<TodaysProgress>({
    steps: 0,
    calories: 0,
    sleep: 0
  });
  const [editing, setEditing] = useState(false);
  const [tempGoals, setTempGoals] = useState<Goals>(goals);

  useEffect(() => {
    if (user) {
      loadGoals();
      loadTodaysProgress();
    }
  }, [user]);

  const loadGoals = async () => {
    if (!user) return;

    try {
      const goalsDoc = await getDoc(doc(db, 'activityGoals', user.uid));
      if (goalsDoc.exists()) {
        setGoals(goalsDoc.data() as Goals);
        setTempGoals(goalsDoc.data() as Goals);
      }
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  };

  const loadTodaysProgress = async () => {
    if (!user) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const metricsRef = collection(db, 'healthMetrics');
      const q = query(
        metricsRef,
        where('userId', '==', user.uid),
        where('timestamp', '>=', Timestamp.fromDate(today)),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await getDocs(q);
      const metrics = snapshot.docs.map(doc => doc.data());

      // Get latest value for each metric type today
      const todaysProgress: TodaysProgress = {
        steps: 0,
        calories: 0,
        sleep: 0
      };

      const stepsMetrics = metrics.filter(m => m.metricType === 'steps');
      const caloriesMetrics = metrics.filter(m => m.metricType === 'calories');
      const sleepMetrics = metrics.filter(m => m.metricType === 'sleep');

      if (stepsMetrics.length > 0) todaysProgress.steps = stepsMetrics[0].value;
      if (caloriesMetrics.length > 0) todaysProgress.calories = caloriesMetrics[0].value;
      if (sleepMetrics.length > 0) todaysProgress.sleep = sleepMetrics[0].value;

      setProgress(todaysProgress);

      // Check for achievements
      checkAchievements(todaysProgress);
    } catch (error: any) {
      // Handle index building or permission errors gracefully
      if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
        console.log('⏳ Firestore index is building, data will be available soon');
      } else if (error?.code === 'permission-denied') {
        console.log('⏳ Waiting for authentication to complete');
      } else {
        console.error('Error loading progress:', error);
      }
    }
  };

  const checkAchievements = (todaysProgress: TodaysProgress) => {
    if (todaysProgress.steps >= goals.steps) {
      toast({
        title: '🎉 Steps Goal Achieved!',
        description: `You reached your daily goal of ${goals.steps.toLocaleString()} steps!`
      });
    }
    if (todaysProgress.calories >= goals.calories) {
      toast({
        title: '🔥 Calories Goal Achieved!',
        description: `You burned your daily goal of ${goals.calories.toLocaleString()} calories!`
      });
    }
    if (todaysProgress.sleep >= goals.sleep) {
      toast({
        title: '😴 Sleep Goal Achieved!',
        description: `You got your target of ${goals.sleep} hours of sleep!`
      });
    }
  };

  const saveGoals = async () => {
    if (!user) return;

    try {
      await setDoc(doc(db, 'activityGoals', user.uid), {
        ...tempGoals,
        userId: user.uid,
        updatedAt: Timestamp.now()
      });

      setGoals(tempGoals);
      setEditing(false);

      toast({
        title: 'Success',
        description: 'Your activity goals have been updated!'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save goals',
        variant: 'destructive'
      });
    }
  };

  const getProgressPercentage = (current: number, goal: number) => {
    return Math.min(Math.round((current / goal) * 100), 100);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Daily Activity Goals
              </CardTitle>
              <CardDescription>Set and track your daily health goals</CardDescription>
            </div>
            <Button
              variant={editing ? 'default' : 'outline'}
              onClick={() => editing ? saveGoals() : setEditing(true)}
            >
              {editing ? 'Save Goals' : 'Edit Goals'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Steps Goal */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Steps Goal</Label>
              {!editing && (
                <span className="text-sm font-medium">
                  {progress.steps.toLocaleString()} / {goals.steps.toLocaleString()}
                </span>
              )}
            </div>
            {editing ? (
              <Input
                type="number"
                value={tempGoals.steps}
                onChange={(e) => setTempGoals({ ...tempGoals, steps: parseInt(e.target.value) || 0 })}
              />
            ) : (
              <>
                <Progress value={getProgressPercentage(progress.steps, goals.steps)} />
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{getProgressPercentage(progress.steps, goals.steps)}% complete</span>
                  {progress.steps >= goals.steps && (
                    <span className="flex items-center gap-1 text-green-600 font-medium">
                      <Award className="h-4 w-4" /> Goal achieved!
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Calories Goal */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Calories Burned Goal (kcal)</Label>
              {!editing && (
                <span className="text-sm font-medium">
                  {progress.calories.toLocaleString()} / {goals.calories.toLocaleString()}
                </span>
              )}
            </div>
            {editing ? (
              <Input
                type="number"
                value={tempGoals.calories}
                onChange={(e) => setTempGoals({ ...tempGoals, calories: parseInt(e.target.value) || 0 })}
              />
            ) : (
              <>
                <Progress value={getProgressPercentage(progress.calories, goals.calories)} />
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{getProgressPercentage(progress.calories, goals.calories)}% complete</span>
                  {progress.calories >= goals.calories && (
                    <span className="flex items-center gap-1 text-green-600 font-medium">
                      <Award className="h-4 w-4" /> Goal achieved!
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Sleep Goal */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Sleep Goal (hours)</Label>
              {!editing && (
                <span className="text-sm font-medium">
                  {progress.sleep.toFixed(1)} / {goals.sleep}
                </span>
              )}
            </div>
            {editing ? (
              <Input
                type="number"
                step="0.5"
                value={tempGoals.sleep}
                onChange={(e) => setTempGoals({ ...tempGoals, sleep: parseFloat(e.target.value) || 0 })}
              />
            ) : (
              <>
                <Progress value={getProgressPercentage(progress.sleep, goals.sleep)} />
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{getProgressPercentage(progress.sleep, goals.sleep)}% complete</span>
                  {progress.sleep >= goals.sleep && (
                    <span className="flex items-center gap-1 text-green-600 font-medium">
                      <Award className="h-4 w-4" /> Goal achieved!
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Health Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Health Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {progress.steps < goals.steps * 0.5 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
              💡 You're at {getProgressPercentage(progress.steps, goals.steps)}% of your steps goal. Try taking a walk!
            </div>
          )}
          {progress.calories < goals.calories * 0.5 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
              💡 Low activity today. Consider some exercise to reach your calorie goal.
            </div>
          )}
          {progress.sleep < 6 && progress.sleep > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
              ⚠️ You only got {progress.sleep.toFixed(1)} hours of sleep. Aim for at least 7-8 hours for optimal health.
            </div>
          )}
          {progress.steps >= goals.steps && progress.calories >= goals.calories && progress.sleep >= goals.sleep && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
              🌟 Amazing! You've achieved all your daily health goals. Keep up the great work!
            </div>
          )}
          {progress.steps === 0 && progress.calories === 0 && progress.sleep === 0 && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
              📊 No data recorded today. Sync your wearable device to see your progress.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
