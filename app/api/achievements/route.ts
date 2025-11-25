import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Achievement types and criteria
const ACHIEVEMENTS = {
  FIRST_STEPS: {
    id: 'first_steps',
    title: 'First Steps',
    description: 'Logged your first health reading',
    icon: '👣',
    points: 10,
    unlockCondition: '1 reading',
    category: 'milestone'
  },
  WEEK_STREAK: {
    id: 'week_streak',
    title: 'Week Warrior',
    description: 'Logged health data for 7 consecutive days',
    icon: '🔥',
    points: 50,
    unlockCondition: '7-day streak',
    category: 'streak'
  },
  MONTH_STREAK: {
    id: 'month_streak',
    title: 'Monthly Master',
    description: '30-day logging streak',
    icon: '⭐',
    points: 150,
    unlockCondition: '30-day streak',
    category: 'streak'
  },
  HUNDRED_STREAK: {
    id: 'hundred_streak',
    title: '100 Day Legend',
    description: 'Achieved 100 consecutive days of logging',
    icon: '💯',
    points: 500,
    unlockCondition: '100-day streak',
    category: 'streak'
  },
  STEPS_GOAL: {
    id: 'steps_goal',
    title: 'Step Champion',
    description: 'Reached your daily steps goal',
    icon: '🏃',
    points: 25,
    unlockCondition: 'Complete steps goal',
    category: 'goal'
  },
  MARATHON_WALKER: {
    id: 'marathon_walker',
    title: 'Marathon Walker',
    description: 'Walked 100,000 steps in total',
    icon: '🚶',
    points: 200,
    unlockCondition: '100k total steps',
    category: 'fitness'
  },
  GLUCOSE_CONTROL: {
    id: 'glucose_control',
    title: 'Sugar Guardian',
    description: 'Maintained healthy glucose for 7 days',
    icon: '🎯',
    points: 100,
    unlockCondition: 'Healthy glucose 7 days',
    category: 'health'
  },
  GLUCOSE_MASTER: {
    id: 'glucose_master',
    title: 'Glucose Master',
    description: 'Maintained perfect glucose levels for 30 days',
    icon: '💎',
    points: 300,
    unlockCondition: 'Perfect glucose 30 days',
    category: 'health'
  },
  PERFECT_BP: {
    id: 'perfect_bp',
    title: 'BP Boss',
    description: 'Maintained ideal blood pressure for 7 days',
    icon: '💪',
    points: 100,
    unlockCondition: 'Ideal BP 7 days',
    category: 'health'
  },
  HEART_HERO: {
    id: 'heart_hero',
    title: 'Heart Hero',
    description: 'Maintained optimal heart rate for 30 days',
    icon: '❤️',
    points: 250,
    unlockCondition: 'Optimal heart rate 30 days',
    category: 'health'
  },
  EARLY_BIRD: {
    id: 'early_bird',
    title: 'Early Bird',
    description: 'Logged data before 8 AM',
    icon: '🌅',
    points: 15,
    unlockCondition: 'Log before 8 AM',
    category: 'habit'
  },
  NIGHT_OWL: {
    id: 'night_owl',
    title: 'Night Owl',
    description: 'Logged data after 10 PM',
    icon: '🦉',
    points: 15,
    unlockCondition: 'Log after 10 PM',
    category: 'habit'
  },
  HEALTH_EXPLORER: {
    id: 'health_explorer',
    title: 'Health Explorer',
    description: 'Used all features: logs, charts, predictions, coach',
    icon: '🧭',
    points: 75,
    unlockCondition: 'Use all features',
    category: 'exploration'
  },
  GOAL_SETTER: {
    id: 'goal_setter',
    title: 'Goal Setter',
    description: 'Created your first health goal',
    icon: '🎯',
    points: 20,
    unlockCondition: 'Create 1 goal',
    category: 'milestone'
  },
  GOAL_CRUSHER: {
    id: 'goal_crusher',
    title: 'Goal Crusher',
    description: 'Completed 5 health goals',
    icon: '🏆',
    points: 150,
    unlockCondition: 'Complete 5 goals',
    category: 'milestone'
  },
  CONSISTENCY_KING: {
    id: 'consistency_king',
    title: 'Consistency King',
    description: 'Logged data at the same time for 14 days',
    icon: '👑',
    points: 120,
    unlockCondition: 'Same time 14 days',
    category: 'habit'
  },
  DATA_MASTER: {
    id: 'data_master',
    title: 'Data Master',
    description: 'Logged 100 health readings',
    icon: '📊',
    points: 200,
    unlockCondition: '100 readings',
    category: 'milestone'
  },
  WELLNESS_WARRIOR: {
    id: 'wellness_warrior',
    title: 'Wellness Warrior',
    description: 'Reached 1000 total points',
    icon: '⚔️',
    points: 0,
    unlockCondition: '1000 points',
    category: 'milestone'
  }
};

export async function POST(request: NextRequest) {
  try {
    const { userId, achievementType } = await request.json();

    if (!userId || !achievementType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const achievement = ACHIEVEMENTS[achievementType as keyof typeof ACHIEVEMENTS];
    if (!achievement) {
      return NextResponse.json(
        { success: false, error: 'Invalid achievement type' },
        { status: 400 }
      );
    }

    // Check if already earned
    const existing = await adminDb
      .collection('achievements')
      .where('userId', '==', userId)
      .where('achievementId', '==', achievement.id)
      .get();

    if (!existing.empty) {
      return NextResponse.json({
        success: true,
        message: 'Achievement already earned',
        alreadyEarned: true
      });
    }

    // Award achievement
    const newAchievement = {
      userId,
      achievementId: achievement.id,
      title: achievement.title,
      description: achievement.description,
      icon: achievement.icon,
      points: achievement.points,
      earnedAt: FieldValue.serverTimestamp()
    };

    await adminDb.collection('achievements').add(newAchievement);

    // Update user's total points
    const userStatsRef = adminDb.collection('userStats').doc(userId);
    const userStats = await userStatsRef.get();

    if (userStats.exists) {
      await userStatsRef.update({
        totalPoints: FieldValue.increment(achievement.points),
        achievementsCount: FieldValue.increment(1)
      });
    } else {
      await userStatsRef.set({
        userId,
        totalPoints: achievement.points,
        achievementsCount: 1,
        currentStreak: 0,
        longestStreak: 0,
        createdAt: FieldValue.serverTimestamp()
      });
    }

    return NextResponse.json({
      success: true,
      achievement: newAchievement,
      newAchievement: true
    });
  } catch (error) {
    console.error('Error awarding achievement:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to award achievement' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get earned achievements
    const achievementsSnapshot = await adminDb
      .collection('achievements')
      .where('userId', '==', userId)
      .get();

    const earned = achievementsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as any));

    // Get user stats
    const statsDoc = await adminDb.collection('userStats').doc(userId).get();
    const stats = statsDoc.exists ? statsDoc.data() : {
      totalPoints: 0,
      achievementsCount: 0,
      currentStreak: 0,
      longestStreak: 0
    };

    // Get all available achievements (exclude earned ones)
    const earnedIds = new Set(earned.map(e => e.achievementId));
    const available = Object.values(ACHIEVEMENTS).filter(
      achievement => !earnedIds.has(achievement.id)
    );

    return NextResponse.json({
      success: true,
      earnedAchievements: earned,
      availableAchievements: available,
      stats
    });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch achievements' },
      { status: 500 }
    );
  }
}
