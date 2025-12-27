"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Target, Award, TrendingUp, Plus, Loader2, Calendar, Flame, Sparkles, Star, Zap, Crown, CheckCircle2, Coins } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth.store";
import { FirestoreService } from "@/lib/services/firestore.service";
import { GamificationProgress } from "@/types";
import { toast } from "@/hooks/use-toast";

// Types
interface Goal {
  id: string;
  userId: string;
  goalType: 'steps' | 'glucose' | 'weight' | 'bp' | 'heartRate';
  targetValue: number;
  currentValue?: number;
  progress?: number;
  title?: string;
  deadline?: string;
  completed?: boolean;
  createdAt: string;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  category: string;
  unlockCondition?: string;
}

interface UserStats {
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  achievementsCount: number;
  lastActivityDate?: string;
}

interface BadgeTier {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: number;
  color: string;
  unlocked: boolean;
  progress?: number;
}

interface BadgeCategory {
  category: string;
  description: string;
  icon: string;
  tiers: BadgeTier[];
}

interface OutcomeReward {
  id: string;
  userId: string;
  ruleId: string;
  ruleTitle: string;
  metric: string;
  improvementValue: number;
  currentAverage: number;
  previousAverage: number;
  hpAwarded: number;
  wcAwarded: number;
  grantedAt: any;
}

// Levels based on points with enhanced styling
const LEVELS = [
  { name: "Beginner", minPoints: 0, maxPoints: 99, color: "from-gray-400 to-gray-600", icon: "🌱", badge: "bg-gray-500" },
  { name: "Bronze", minPoints: 100, maxPoints: 299, color: "from-orange-400 to-orange-600", icon: "🥉", badge: "bg-orange-600" },
  { name: "Silver", minPoints: 300, maxPoints: 599, color: "from-gray-300 to-gray-500", icon: "🥈", badge: "bg-gray-400" },
  { name: "Gold", minPoints: 600, maxPoints: 999, color: "from-yellow-400 to-yellow-600", icon: "🥇", badge: "bg-yellow-500" },
  { name: "Platinum", minPoints: 1000, maxPoints: 1999, color: "from-cyan-400 to-cyan-600", icon: "💎", badge: "bg-cyan-500" },
  { name: "Diamond", minPoints: 2000, maxPoints: 4999, color: "from-blue-400 to-blue-600", icon: "💠", badge: "bg-blue-600" },
  { name: "Legend", minPoints: 5000, maxPoints: Infinity, color: "from-purple-400 to-purple-600", icon: "👑", badge: "bg-purple-600" },
];

export default function ProgressPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [earnedAchievements, setEarnedAchievements] = useState<any[]>([]);
  const [badges, setBadges] = useState<BadgeCategory[]>([]);
  const [badgeStats, setBadgeStats] = useState({ totalUnlocked: 0, totalBadges: 0, completionPercentage: 0 });
  const [gamificationProgress, setGamificationProgress] = useState<GamificationProgress | null>(null);
  const [stats, setStats] = useState<UserStats>({
    totalPoints: 0,
    currentStreak: 0,
    longestStreak: 0,
    achievementsCount: 0,
  });
  const [outcomeRewards, setOutcomeRewards] = useState<OutcomeReward[]>([]);
  const [evaluating, setEvaluating] = useState(false);

  // Create Goal Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newGoal, setNewGoal] = useState<{
    goalType: 'steps' | 'glucose' | 'weight' | 'bp' | 'heartRate';
    targetValue: string;
    title: string;
    deadline: string;
  }>({
    goalType: 'steps',
    targetValue: '',
    title: '',
    deadline: '',
  });

  // Subscribe to gamification progress for real-time sync
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = FirestoreService.subscribeToGamificationProgress(
      user.uid,
      (progress) => {
        setGamificationProgress(progress);
        // Update stats with real-time data from Firestore
        if (progress) {
          setStats({
            totalPoints: progress.totalPoints || 0,
            currentStreak: progress.currentStreak || 0,
            longestStreak: Math.max(progress.longestStreak || 0, 7),
            achievementsCount: earnedAchievements.length,
          });
        }
      }
    );

    return () => unsubscribe();
  }, [user, earnedAchievements.length]);

  // Fetch data
  useEffect(() => {
    if (!user?.uid) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch goals, achievements, and badges in parallel
        const [goalsRes, achievementsRes, badgesRes] = await Promise.all([
          fetch(`/api/goals?userId=${user.uid}`),
          fetch(`/api/achievements?userId=${user.uid}`),
          fetch(`/api/badges?userId=${user.uid}`)
        ]);

        if (goalsRes.ok) {
          const goalsData = await goalsRes.json();
          setGoals(goalsData.goals || []);
        }

        if (achievementsRes.ok) {
          const achievementsData = await achievementsRes.json();
          setEarnedAchievements(achievementsData.earnedAchievements || []);
          setAchievements(achievementsData.availableAchievements || []);
          // Don't set stats from API, wait for real-time subscription
        }

        if (badgesRes.ok) {
          const badgesData = await badgesRes.json();
          setBadges(badgesData.badges || []);
          setBadgeStats(badgesData.stats || { totalUnlocked: 0, totalBadges: 0, completionPercentage: 0 });
        }

        // Fetch and evaluate outcome rewards
        await evaluateOutcomeRewards();
      } catch (error) {
        console.error("Error fetching progress data:", error);
        toast({
          title: "Error",
          description: "Failed to load progress data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Evaluate outcome rewards
  const evaluateOutcomeRewards = async () => {
    if (!user?.uid) return;
    
    try {
      setEvaluating(true);
      const response = await fetch('/api/outcomes/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.granted && data.granted.length > 0) {
          toast({
            title: "🎉 Outcome Rewards Earned!",
            description: `You earned ${data.granted.length} reward(s) for health improvements!`,
          });
          // Refresh stats after granting rewards
          const achievementsRes = await fetch(`/api/achievements?userId=${user.uid}`);
          if (achievementsRes.ok) {
            const achievementsData = await achievementsRes.json();
            setStats(achievementsData.stats || stats);
          }
        }

        // Fetch recent outcome rewards to display
        const rewardsRes = await fetch(`/api/outcomes/rewards?userId=${user.uid}`);
        if (rewardsRes.ok) {
          const rewardsData = await rewardsRes.json();
          setOutcomeRewards(rewardsData.rewards || []);
        }
      }
    } catch (error) {
      console.error("Error evaluating outcome rewards:", error);
    } finally {
      setEvaluating(false);
    }
  };

  // Calculate current level
  const currentLevel = LEVELS.find(
    (level) => stats.totalPoints >= level.minPoints && stats.totalPoints <= level.maxPoints
  ) || LEVELS[0];

  const nextLevel = LEVELS[LEVELS.indexOf(currentLevel) + 1];
  const levelProgress = nextLevel
    ? ((stats.totalPoints - currentLevel.minPoints) / (nextLevel.minPoints - currentLevel.minPoints)) * 100
    : 100;

  // Handle create goal
  const handleCreateGoal = async () => {
    if (!user?.uid || !newGoal.targetValue || creating) return;

    try {
      setCreating(true);
      
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          goalType: newGoal.goalType,
          targetValue: Number(newGoal.targetValue),
          title: newGoal.title || undefined,
          deadline: newGoal.deadline || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGoals([...goals, data.goal]);
        setDialogOpen(false);
        setNewGoal({ goalType: 'steps', targetValue: '', title: '', deadline: '' });
        toast({
          title: "Success",
          description: "Goal created successfully!",
        });
      } else {
        throw new Error('Failed to create goal');
      }
    } catch (error) {
      console.error("Error creating goal:", error);
      toast({
        title: "Error",
        description: "Failed to create goal",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const activeGoals = goals.filter(g => !g.completed);
  const completedGoals = goals.filter(g => g.completed);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Animated Header */}
      <div className="flex justify-between items-center animate-in fade-in slide-in-from-top duration-500">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent flex items-center gap-3">
            <Trophy className="h-10 w-10 text-yellow-500 animate-bounce" />
            Your Progress Journey
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">Track your health goals and unlock achievements</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 shadow-lg hover:shadow-xl transition-all duration-300">
              <Plus className="h-5 w-5 mr-2" />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-3xl border-0 shadow-2xl bg-white">
            {/* Header with gradient */}
            <div className="bg-gradient-to-br from-teal-500 via-teal-400 to-cyan-400 px-6 py-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
              <DialogHeader className="relative z-10">
                <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
                  <Target className="h-6 w-6" />
                  New Goal
                </DialogTitle>
                <DialogDescription className="text-teal-50 mt-1">
                  Set a target and track your progress
                </DialogDescription>
              </DialogHeader>
            </div>
            
            <div className="p-6 space-y-5 bg-gray-50/50">
              {/* Goal Type */}
              <div className="space-y-2">
                <Label htmlFor="goalType" className="text-sm font-semibold text-gray-700">Goal Type</Label>
                <Select
                  value={newGoal.goalType}
                  onValueChange={(value: any) => setNewGoal({ ...newGoal, goalType: value })}
                >
                  <SelectTrigger id="goalType" className="h-12 rounded-xl border-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 bg-white shadow-sm hover:shadow transition-shadow">
                    <SelectValue placeholder="Select a metric to track" className="text-gray-900" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl bg-white shadow-lg border-0">
                    <SelectItem value="steps" className="py-3 text-gray-900 rounded-lg cursor-pointer hover:bg-teal-50">Daily Steps</SelectItem>
                    <SelectItem value="glucose" className="py-3 text-gray-900 rounded-lg cursor-pointer hover:bg-teal-50">Blood Glucose</SelectItem>
                    <SelectItem value="weight" className="py-3 text-gray-900 rounded-lg cursor-pointer hover:bg-teal-50">Weight</SelectItem>
                    <SelectItem value="bp" className="py-3 text-gray-900 rounded-lg cursor-pointer hover:bg-teal-50">Blood Pressure</SelectItem>
                    <SelectItem value="heartRate" className="py-3 text-gray-900 rounded-lg cursor-pointer hover:bg-teal-50">Heart Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Target Value */}
              <div className="space-y-2">
                <Label htmlFor="targetValue" className="text-sm font-semibold text-gray-700">Target Value</Label>
                <Input
                  id="targetValue"
                  type="number"
                  className="h-12 rounded-xl border-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 bg-white shadow-sm hover:shadow transition-shadow"
                  placeholder={
                    newGoal.goalType === 'steps' ? '10000 steps' :
                    newGoal.goalType === 'glucose' ? '100 mg/dL' :
                    newGoal.goalType === 'weight' ? '70 kg' :
                    newGoal.goalType === 'bp' ? '120 mmHg' :
                    newGoal.goalType === 'heartRate' ? '75 bpm' : 'Enter your target'
                  }
                  value={newGoal.targetValue}
                  onChange={(e) => setNewGoal({ ...newGoal, targetValue: e.target.value })}
                />
              </div>

              {/* Goal Name (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-semibold text-gray-700">
                  Goal Name <span className="text-gray-400 font-normal text-xs">(optional)</span>
                </Label>
                <Input
                  id="title"
                  className="h-12 rounded-xl border-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 bg-white shadow-sm hover:shadow transition-shadow"
                  placeholder="e.g., Summer Fitness Challenge"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                />
              </div>

              {/* Deadline (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="deadline" className="text-sm font-semibold text-gray-700">
                  Deadline <span className="text-gray-400 font-normal text-xs">(optional)</span>
                </Label>
                <Input
                  id="deadline"
                  type="date"
                  className="h-12 rounded-xl border-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 bg-white shadow-sm hover:shadow transition-shadow"
                  value={newGoal.deadline}
                  onChange={(e) => setNewGoal({ ...newGoal, deadline: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div className="flex gap-3 p-6 pt-4 bg-white border-t border-gray-100">
              <Button 
                type="button"
                variant="outline" 
                onClick={() => setDialogOpen(false)}
                className="flex-1 h-12 rounded-xl border-2 border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 font-medium transition-all"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateGoal} 
                disabled={creating || !newGoal.targetValue || !newGoal.goalType}
                className="flex-1 h-12 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
              >
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Goal
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Animated Level Card with Particles Effect */}
      <Card className="relative overflow-hidden border-2 animate-in fade-in slide-in-from-bottom duration-700 delay-100">
        <div className={`absolute inset-0 bg-gradient-to-br ${currentLevel.color} opacity-10`}></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24 animate-pulse delay-700"></div>
        
        <CardHeader className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-6xl animate-bounce">
                {currentLevel.icon}
              </div>
              <div>
                <CardTitle className="text-3xl flex items-center gap-2">
                  <span className={`bg-gradient-to-r ${currentLevel.color} bg-clip-text text-transparent font-bold`}>
                    {currentLevel.name}
                  </span>
                  <Crown className="h-6 w-6 text-yellow-500" />
                </CardTitle>
                <CardDescription className="mt-2 text-lg font-semibold">
                  Level {LEVELS.indexOf(currentLevel) + 1} • {stats.totalPoints} Points
                  {nextLevel && ` • ${nextLevel.minPoints - stats.totalPoints} to next level`}
                </CardDescription>
              </div>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent animate-pulse">
                {stats.totalPoints}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Total Points</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className="space-y-3">
            <div className="flex justify-between text-sm font-medium">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-500" />
                Progress to {nextLevel ? nextLevel.name : 'Max Level'}
              </span>
              <span className="font-bold text-lg">{Math.round(levelProgress)}%</span>
            </div>
            <div className="relative">
              <Progress value={levelProgress} className="h-4 bg-gray-200 dark:bg-gray-800" />
              <div 
                className={`absolute top-0 left-0 h-4 bg-gradient-to-r ${currentLevel.color} rounded-full transition-all duration-1000 ease-out`}
                style={{ width: `${levelProgress}%` }}
              ></div>
            </div>
            {nextLevel && (
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Zap className="h-3 w-3 text-yellow-500" />
                {nextLevel.minPoints - stats.totalPoints} more points to reach {nextLevel.name}!
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Animated Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4 animate-in fade-in slide-in-from-bottom duration-700 delay-200">
        <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-yellow-400">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-orange-500/10 group-hover:from-yellow-400/20 group-hover:to-orange-500/20 transition-all"></div>
          <CardHeader className="pb-2 relative">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500 group-hover:animate-bounce" />
              Total Points
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-4xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
              {stats.totalPoints}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Keep earning!</p>
          </CardContent>
        </Card>
        
        <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-orange-400">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-400/10 to-red-500/10 group-hover:from-orange-400/20 group-hover:to-red-500/20 transition-all"></div>
          <CardHeader className="pb-2 relative">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500 group-hover:animate-pulse" />
              Current Streak
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-4xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
              {stats.currentStreak}
            </div>
            <p className="text-xs text-muted-foreground mt-1">days in a row 🔥</p>
          </CardContent>
        </Card>
        
        <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-purple-400">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-400/10 to-pink-500/10 group-hover:from-purple-400/20 group-hover:to-pink-500/20 transition-all"></div>
          <CardHeader className="pb-2 relative">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="h-5 w-5 text-purple-500 group-hover:animate-spin" />
              Longest Streak
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-4xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
              {stats.longestStreak}
            </div>
            <p className="text-xs text-muted-foreground mt-1">days record 🏆</p>
          </CardContent>
        </Card>
        
        <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-cyan-400">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 to-blue-500/10 group-hover:from-cyan-400/20 group-hover:to-blue-500/20 transition-all"></div>
          <CardHeader className="pb-2 relative">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="h-5 w-5 text-cyan-500 group-hover:animate-bounce" />
              Achievements
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-4xl font-bold bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
              {stats.achievementsCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">badges earned 🎖️</p>
          </CardContent>
        </Card>
      </div>

      {/* Outcome-Based Rewards Section */}
      <Card className="animate-in fade-in slide-in-from-bottom duration-700 delay-250 border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <TrendingUp className="h-7 w-7 text-green-500" />
                <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  Outcome-Based Rewards
                </span>
              </CardTitle>
              <CardDescription className="text-base mt-1">
                Earn bonus HP & Wellness Coins for actual health improvements 📈
              </CardDescription>
            </div>
            <Button
              onClick={evaluateOutcomeRewards}
              disabled={evaluating}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              {evaluating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Check for Rewards
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {outcomeRewards.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="text-6xl">🎯</div>
              <p className="text-lg font-medium text-gray-600 dark:text-gray-400">
                No outcome rewards yet
              </p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Keep logging your health data consistently. When your metrics improve over time, you'll automatically earn bonus rewards!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  Showing your {outcomeRewards.length > 3 ? 'latest 3' : outcomeRewards.length} outcome reward{outcomeRewards.length !== 1 ? 's' : ''}
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="font-bold">{outcomeRewards.reduce((sum, r) => sum + r.hpAwarded, 0)} HP</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Coins className="h-4 w-4 text-teal-500" />
                    <span className="font-bold">{outcomeRewards.reduce((sum, r) => sum + r.wcAwarded, 0)} WC</span>
                  </div>
                </div>
              </div>
              {outcomeRewards.slice(0, 3).map((reward) => (
                <Card key={reward.id} className="border-green-200 bg-white/50 dark:bg-gray-900/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          <h4 className="font-semibold text-green-700 dark:text-green-400">{reward.ruleTitle}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground capitalize">
                          {reward.metric}: {reward.previousAverage.toFixed(1)} → {reward.currentAverage.toFixed(1)}
                          <span className="text-green-600 dark:text-green-400 font-medium ml-2">
                            ({reward.improvementValue > 0 ? '+' : ''}{reward.improvementValue.toFixed(1)} improvement)
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Earned {new Date(reward.grantedAt?.seconds * 1000 || reward.grantedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">
                          +{reward.hpAwarded} HP
                        </Badge>
                        <Badge className="bg-teal-100 text-teal-700 border-teal-300">
                          +{reward.wcAwarded} WC
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Goals Section with Enhanced Design */}
      <Card className="animate-in fade-in slide-in-from-bottom duration-700 delay-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl">
            <Target className="h-7 w-7 text-teal-500 animate-pulse" />
            <span className="bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
              Health Goals
            </span>
          </CardTitle>
          <CardDescription className="text-base">
            Set targets and track your progress towards better health 🎯
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active" className="text-base">
                <Zap className="h-4 w-4 mr-2" />
                Active ({activeGoals.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-base">
                <Trophy className="h-4 w-4 mr-2" />
                Completed ({completedGoals.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="active" className="space-y-4 mt-6">
              {activeGoals.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="h-16 w-16 mx-auto text-gray-400 mb-4 animate-pulse" />
                  <p className="text-muted-foreground text-lg">No active goals.</p>
                  <p className="text-sm text-muted-foreground mt-2">Click "New Goal" to create one! 🎯</p>
                </div>
              ) : (
                activeGoals.map((goal, index) => (
                  <Card 
                    key={goal.id} 
                    className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-teal-400 animate-in fade-in slide-in-from-left duration-500"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-teal-50/50 to-cyan-50/50 dark:from-teal-950/30 dark:to-cyan-950/30"></div>
                    <CardContent className="pt-6 pb-6 relative">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="text-4xl group-hover:scale-110 transition-transform duration-300">
                              {goal.goalType === 'steps' ? '👟' :
                               goal.goalType === 'glucose' ? '🩸' :
                               goal.goalType === 'weight' ? '⚖️' :
                               goal.goalType === 'bp' ? '❤️' : '💓'}
                            </div>
                            <div>
                              <h4 className="font-bold text-lg">
                                {goal.title || `${goal.goalType.charAt(0).toUpperCase() + goal.goalType.slice(1)} Goal`}
                              </h4>
                              <p className="text-sm text-muted-foreground font-medium">
                                Target: <span className="font-bold text-teal-600 dark:text-teal-400">{goal.targetValue}</span>{' '}
                                {goal.goalType === 'steps' ? 'steps' : 
                                 goal.goalType === 'glucose' ? 'mg/dL' :
                                 goal.goalType === 'weight' ? 'kg' :
                                 goal.goalType === 'bp' ? 'mmHg' : 'bpm'}
                              </p>
                            </div>
                          </div>
                          {goal.deadline && (
                            <Badge variant="outline" className="flex items-center gap-1 bg-white/50 dark:bg-gray-900/50">
                              <Calendar className="h-3 w-3" />
                              {new Date(goal.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm font-medium">
                            <span className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-teal-500" />
                              Progress
                            </span>
                            <span className="text-lg font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                              {goal.progress?.toFixed(1) || 0}%
                            </span>
                          </div>
                          <div className="relative h-3 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div 
                              className="absolute top-0 left-0 h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full transition-all duration-1000 ease-out"
                              style={{ width: `${Math.min(goal.progress || 0, 100)}%` }}
                            >
                              <div className="absolute inset-0 animate-shimmer"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
            
            <TabsContent value="completed" className="space-y-4 mt-6">
              {completedGoals.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  <p className="text-muted-foreground text-lg">No completed goals yet.</p>
                  <p className="text-sm text-muted-foreground mt-2">Keep working on your active goals! 💪</p>
                </div>
              ) : (
                completedGoals.map((goal, index) => (
                  <Card 
                    key={goal.id} 
                    className="relative overflow-hidden border-2 border-green-400 animate-in fade-in zoom-in duration-500"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50"></div>
                    <CardContent className="pt-6 pb-6 relative">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="text-4xl animate-bounce">🏆</div>
                          <div>
                            <h4 className="font-bold text-lg text-green-700 dark:text-green-400">
                              {goal.title || `${goal.goalType.charAt(0).toUpperCase() + goal.goalType.slice(1)} Goal`}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              Target: {goal.targetValue} • Achieved: {goal.currentValue}
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 shadow-lg">
                          <TrendingUp className="h-4 w-4 mr-1" />
                          Completed!
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Achievements Section with Beautiful Badges */}
      <Card className="animate-in fade-in slide-in-from-bottom duration-700 delay-400">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl">
            <Award className="h-7 w-7 text-yellow-500 animate-pulse" />
            <span className="bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
              Achievements
            </span>
          </CardTitle>
          <CardDescription className="text-base">
            Unlock beautiful badges by reaching health milestones ✨
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="earned">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="earned" className="text-base">
                <Sparkles className="h-4 w-4 mr-2" />
                Earned ({earnedAchievements.length})
              </TabsTrigger>
              <TabsTrigger value="available" className="text-base">
                <Target className="h-4 w-4 mr-2" />
                Available ({achievements.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="earned" className="mt-6">
              {earnedAchievements.length === 0 ? (
                <div className="text-center py-12">
                  <Award className="h-16 w-16 mx-auto text-gray-400 mb-4 animate-pulse" />
                  <p className="text-muted-foreground text-lg">No achievements earned yet.</p>
                  <p className="text-sm text-muted-foreground mt-2">Keep tracking your health to unlock badges! 🎯</p>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {earnedAchievements.map((achievement, index) => (
                    <Card 
                      key={achievement.achievementId} 
                      className="relative overflow-hidden group hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border-2 border-yellow-400/50 animate-in fade-in zoom-in duration-500"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 via-orange-400/20 to-amber-500/20"></div>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-300/20 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-300/20 rounded-full -ml-12 -mb-12 group-hover:scale-150 transition-transform duration-500"></div>
                      
                      <CardContent className="pt-8 pb-6 relative">
                        <div className="flex flex-col items-center text-center space-y-4">
                          <div className="relative">
                            <div className="absolute inset-0 bg-yellow-400/30 rounded-full animate-ping"></div>
                            <div className="relative text-7xl group-hover:scale-125 transition-transform duration-300 filter drop-shadow-lg">
                              {achievement.icon}
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <h4 className="font-bold text-xl bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
                              {achievement.name}
                            </h4>
                            <p className="text-sm text-muted-foreground px-2">
                              {achievement.description}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-3 pt-2">
                            <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-4 py-1 text-base font-bold shadow-lg">
                              <Trophy className="h-4 w-4 mr-1" />
                              {achievement.points} pts
                            </Badge>
                            <span className="text-xs text-muted-foreground font-medium">
                              {new Date(achievement.earnedAt).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="available" className="mt-6">
              {achievements.length === 0 ? (
                <div className="text-center py-12">
                  <Crown className="h-16 w-16 mx-auto text-yellow-500 mb-4 animate-bounce" />
                  <p className="text-xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
                    All achievements unlocked!
                  </p>
                  <p className="text-muted-foreground mt-2">You're a health champion! 🏆</p>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {achievements.map((achievement, index) => (
                    <Card 
                      key={achievement.id} 
                      className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 opacity-70 hover:opacity-100 border-2 border-gray-300 dark:border-gray-700 animate-in fade-in duration-500"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900"></div>
                      
                      <CardContent className="pt-8 pb-6 relative">
                        <div className="flex flex-col items-center text-center space-y-4">
                          <div className="relative">
                            <div className="text-7xl grayscale group-hover:grayscale-0 transition-all duration-300 filter blur-[1px] group-hover:blur-0">
                              {achievement.icon}
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-16 h-16 border-4 border-dashed border-gray-400 dark:border-gray-600 rounded-full animate-spin-slow"></div>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <h4 className="font-bold text-lg text-gray-700 dark:text-gray-300">
                              {achievement.name}
                            </h4>
                            <p className="text-sm text-muted-foreground px-2">
                              {achievement.description}
                            </p>
                          </div>
                          
                          <Badge variant="outline" className="text-base font-bold px-4 py-1">
                            <Zap className="h-4 w-4 mr-1" />
                            {achievement.points} points
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-2 font-medium">
                            🔒 {achievement.unlockCondition}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Badges Section - Tiered Badge System */}
      <Card className="animate-in fade-in slide-in-from-bottom duration-700 delay-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <div className="relative">
                  <Crown className="h-8 w-8 text-yellow-500 animate-pulse" />
                  <Sparkles className="h-4 w-4 text-yellow-400 absolute -top-1 -right-1 animate-bounce" />
                </div>
                <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Badge Collection
                </span>
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Unlock tiered badges by reaching milestones in each category 🏅
              </CardDescription>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {badgeStats.totalUnlocked}/{badgeStats.totalBadges}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {badgeStats.completionPercentage}% Complete
              </p>
              <Progress value={badgeStats.completionPercentage} className="h-2 w-32 mt-2" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {badges.map((badgeCategory, categoryIndex) => (
            <div 
              key={categoryIndex} 
              className="space-y-4 animate-in fade-in slide-in-from-left duration-500"
              style={{ animationDelay: `${categoryIndex * 150}ms` }}
            >
              <div className="flex items-center gap-3 pb-2 border-b-2 border-gray-200 dark:border-gray-800">
                <div className="text-3xl">{badgeCategory.icon}</div>
                <div>
                  <h3 className="font-bold text-xl">{badgeCategory.category}</h3>
                  <p className="text-sm text-muted-foreground">{badgeCategory.description}</p>
                </div>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {badgeCategory.tiers.map((tier, tierIndex) => (
                  <Card 
                    key={tier.id}
                    className={`relative overflow-hidden group transition-all duration-500 hover:-translate-y-2 ${
                      tier.unlocked 
                        ? 'border-2 border-yellow-400 shadow-lg hover:shadow-2xl' 
                        : 'opacity-60 hover:opacity-80 border-2 border-gray-300 dark:border-gray-700'
                    } animate-in zoom-in duration-500`}
                    style={{ animationDelay: `${(categoryIndex * 150) + (tierIndex * 100)}ms` }}
                  >
                    {/* Background Effects */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${tier.unlocked ? `${tier.color} opacity-20` : 'from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900'}`}></div>
                    
                    {tier.unlocked && (
                      <>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-300/20 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-yellow-400/20 rounded-full -ml-12 -mb-12 group-hover:scale-150 transition-transform duration-500"></div>
                      </>
                    )}

                    <CardContent className="pt-6 pb-6 relative">
                      <div className="flex flex-col items-center text-center space-y-3">
                        {/* Badge Icon */}
                        <div className="relative">
                          {tier.unlocked ? (
                            <React.Fragment key="unlocked">
                              <div className="absolute inset-0 bg-yellow-400/30 rounded-full animate-ping"></div>
                              <div className="relative text-6xl group-hover:scale-125 transition-transform duration-300 filter drop-shadow-2xl">
                                {tier.icon}
                              </div>
                              <div className="absolute -top-2 -right-2">
                                <div className="bg-green-500 rounded-full p-1 animate-bounce">
                                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              </div>
                            </React.Fragment>
                          ) : (
                            <React.Fragment key="locked">
                              <div className="text-6xl grayscale filter blur-[2px]">
                                {tier.icon}
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-4xl">🔒</div>
                              </div>
                            </React.Fragment>
                          )}
                        </div>

                        {/* Badge Info */}
                        <div className="space-y-1">
                          <h4 className={`font-bold text-base ${tier.unlocked ? `bg-gradient-to-r ${tier.color} bg-clip-text text-transparent` : 'text-gray-600 dark:text-gray-400'}`}>
                            {tier.name}
                          </h4>
                          <p className="text-xs text-muted-foreground px-1">
                            {tier.description}
                          </p>
                        </div>

                        {/* Progress or Unlock Status */}
                        {tier.unlocked ? (
                          <Badge className={`bg-gradient-to-r ${tier.color} text-white px-3 py-1 text-xs font-bold shadow-lg`}>
                            <Star className="h-3 w-3 mr-1" />
                            UNLOCKED
                          </Badge>
                        ) : (
                          <div className="w-full space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-bold">{tier.progress || 0}/{tier.requirement}</span>
                            </div>
                            <Progress 
                              value={((tier.progress || 0) / tier.requirement) * 100} 
                              className="h-1.5"
                            />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
