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
    <div className="space-y-4">
      {/* Daily Activity Goals */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Daily Activity Goals</h2>
          <button
            onClick={() => editing ? saveGoals() : setEditing(true)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${editing
              ? 'bg-teal-600 text-white hover:bg-teal-700'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
          >
            {editing ? 'Save' : 'Edit'}
          </button>
        </div>

        {/* Goals List */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {/* Steps Goal */}
          <div className="px-5 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900 dark:text-white">Steps</span>
              {editing ? (
                <Input
                  type="number"
                  value={tempGoals.steps}
                  onChange={(e) => setTempGoals({ ...tempGoals, steps: parseInt(e.target.value) || 0 })}
                  className="w-28 h-8 text-right text-sm"
                />
              ) : (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-semibold text-gray-900 dark:text-white">{progress.steps.toLocaleString()}</span> / {goals.steps.toLocaleString()}
                </span>
              )}
            </div>
            {!editing && (
              <>
                <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${getProgressPercentage(progress.steps, goals.steps)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-gray-500">{getProgressPercentage(progress.steps, goals.steps)}% complete</span>
                  {progress.steps >= goals.steps && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                      <Award className="h-3 w-3" /> Done
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Calories Goal */}
          <div className="px-5 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900 dark:text-white">Calories burned</span>
              {editing ? (
                <Input
                  type="number"
                  value={tempGoals.calories}
                  onChange={(e) => setTempGoals({ ...tempGoals, calories: parseInt(e.target.value) || 0 })}
                  className="w-28 h-8 text-right text-sm"
                />
              ) : (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-semibold text-gray-900 dark:text-white">{progress.calories.toLocaleString()}</span> / {goals.calories.toLocaleString()} kcal
                </span>
              )}
            </div>
            {!editing && (
              <>
                <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 rounded-full transition-all duration-300"
                    style={{ width: `${getProgressPercentage(progress.calories, goals.calories)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-gray-500">{getProgressPercentage(progress.calories, goals.calories)}% complete</span>
                  {progress.calories >= goals.calories && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                      <Award className="h-3 w-3" /> Done
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Sleep Goal */}
          <div className="px-5 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900 dark:text-white">Sleep</span>
              {editing ? (
                <Input
                  type="number"
                  step="0.5"
                  value={tempGoals.sleep}
                  onChange={(e) => setTempGoals({ ...tempGoals, sleep: parseFloat(e.target.value) || 0 })}
                  className="w-28 h-8 text-right text-sm"
                />
              ) : (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-semibold text-gray-900 dark:text-white">{progress.sleep.toFixed(1)}</span> / {goals.sleep} hours
                </span>
              )}
            </div>
            {!editing && (
              <>
                <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${getProgressPercentage(progress.sleep, goals.sleep)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-gray-500">{getProgressPercentage(progress.sleep, goals.sleep)}% complete</span>
                  {progress.sleep >= goals.sleep && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                      <Award className="h-3 w-3" /> Done
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Health Insights */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Health Insights</h2>
        </div>

        <div className="p-4 space-y-3">
          {progress.steps < goals.steps * 0.5 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200 dark:border-amber-800">
              <span className="text-base">💡</span>
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Keep Moving!</p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  You're at {getProgressPercentage(progress.steps, goals.steps)}% of your steps goal. Try walking!
                </p>
              </div>
            </div>
          )}
          {progress.calories < goals.calories * 0.5 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200 dark:border-amber-800">
              <span className="text-base">💡</span>
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Low Activity</p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Consider some exercise to reach your calorie goal.
                </p>
              </div>
            </div>
          )}
          {progress.sleep < 6 && progress.sleep > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border border-red-200 dark:border-red-800">
              <span className="text-base">⚠️</span>
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">Sleep Alert</p>
                <p className="text-xs text-red-700 dark:text-red-300">
                  Only {progress.sleep.toFixed(1)} hours of sleep. Aim for 7-8 hours.
                </p>
              </div>
            </div>
          )}
          {progress.steps >= goals.steps && progress.calories >= goals.calories && progress.sleep >= goals.sleep && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800">
              <span className="text-base">🌟</span>
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-200">All Goals Achieved!</p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Amazing! Keep up the great work!
                </p>
              </div>
            </div>
          )}
          {progress.steps === 0 && progress.calories === 0 && progress.sleep === 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <span className="text-base">📊</span>
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">No Data Yet</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Sync your wearable device to see progress.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
