import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// Badge tiers with unlock conditions
const BADGE_TIERS = {
  STREAK_BADGES: {
    category: 'Streak Master',
    description: 'Earn by maintaining daily logging streaks',
    icon: '🔥',
    tiers: [
      {
        id: 'streak_bronze',
        name: 'Bronze Flame',
        description: 'Maintain a 7-day streak',
        icon: '🥉',
        requirement: 7,
        color: 'from-orange-400 to-orange-600',
        unlocked: false
      },
      {
        id: 'streak_silver',
        name: 'Silver Flame',
        description: 'Maintain a 30-day streak',
        icon: '🥈',
        requirement: 30,
        color: 'from-gray-300 to-gray-500',
        unlocked: false
      },
      {
        id: 'streak_gold',
        name: 'Gold Flame',
        description: 'Maintain a 100-day streak',
        icon: '🥇',
        requirement: 100,
        color: 'from-yellow-400 to-yellow-600',
        unlocked: false
      },
      {
        id: 'streak_platinum',
        name: 'Platinum Flame',
        description: 'Maintain a 365-day streak',
        icon: '💎',
        requirement: 365,
        color: 'from-cyan-400 to-cyan-600',
        unlocked: false
      }
    ]
  },
  POINTS_BADGES: {
    category: 'Point Collector',
    description: 'Earn by accumulating points',
    icon: '⭐',
    tiers: [
      {
        id: 'points_bronze',
        name: 'Bronze Star',
        description: 'Earn 100 points',
        icon: '🥉',
        requirement: 100,
        color: 'from-orange-400 to-orange-600',
        unlocked: false
      },
      {
        id: 'points_silver',
        name: 'Silver Star',
        description: 'Earn 500 points',
        icon: '🥈',
        requirement: 500,
        color: 'from-gray-300 to-gray-500',
        unlocked: false
      },
      {
        id: 'points_gold',
        name: 'Gold Star',
        description: 'Earn 1,000 points',
        icon: '🥇',
        requirement: 1000,
        color: 'from-yellow-400 to-yellow-600',
        unlocked: false
      },
      {
        id: 'points_platinum',
        name: 'Platinum Star',
        description: 'Earn 5,000 points',
        icon: '💎',
        requirement: 5000,
        color: 'from-cyan-400 to-cyan-600',
        unlocked: false
      }
    ]
  },
  ACHIEVEMENT_BADGES: {
    category: 'Achievement Hunter',
    description: 'Earn by unlocking achievements',
    icon: '🏆',
    tiers: [
      {
        id: 'achievement_bronze',
        name: 'Bronze Trophy',
        description: 'Unlock 5 achievements',
        icon: '🥉',
        requirement: 5,
        color: 'from-orange-400 to-orange-600',
        unlocked: false
      },
      {
        id: 'achievement_silver',
        name: 'Silver Trophy',
        description: 'Unlock 10 achievements',
        icon: '🥈',
        requirement: 10,
        color: 'from-gray-300 to-gray-500',
        unlocked: false
      },
      {
        id: 'achievement_gold',
        name: 'Gold Trophy',
        description: 'Unlock 15 achievements',
        icon: '🥇',
        requirement: 15,
        color: 'from-yellow-400 to-yellow-600',
        unlocked: false
      },
      {
        id: 'achievement_platinum',
        name: 'Platinum Trophy',
        description: 'Unlock all achievements',
        icon: '💎',
        requirement: 18,
        color: 'from-cyan-400 to-cyan-600',
        unlocked: false
      }
    ]
  },
  GOAL_BADGES: {
    category: 'Goal Achiever',
    description: 'Earn by completing health goals',
    icon: '🎯',
    tiers: [
      {
        id: 'goal_bronze',
        name: 'Bronze Target',
        description: 'Complete 3 goals',
        icon: '🥉',
        requirement: 3,
        color: 'from-orange-400 to-orange-600',
        unlocked: false
      },
      {
        id: 'goal_silver',
        name: 'Silver Target',
        description: 'Complete 10 goals',
        icon: '🥈',
        requirement: 10,
        color: 'from-gray-300 to-gray-500',
        unlocked: false
      },
      {
        id: 'goal_gold',
        name: 'Gold Target',
        description: 'Complete 25 goals',
        icon: '🥇',
        requirement: 25,
        color: 'from-yellow-400 to-yellow-600',
        unlocked: false
      },
      {
        id: 'goal_platinum',
        name: 'Platinum Target',
        description: 'Complete 50 goals',
        icon: '💎',
        requirement: 50,
        color: 'from-cyan-400 to-cyan-600',
        unlocked: false
      }
    ]
  },
  FITNESS_BADGES: {
    category: 'Fitness Champion',
    description: 'Earn by hitting step milestones',
    icon: '👟',
    tiers: [
      {
        id: 'fitness_bronze',
        name: 'Bronze Runner',
        description: 'Walk 50,000 total steps',
        icon: '🥉',
        requirement: 50000,
        color: 'from-orange-400 to-orange-600',
        unlocked: false
      },
      {
        id: 'fitness_silver',
        name: 'Silver Runner',
        description: 'Walk 250,000 total steps',
        icon: '🥈',
        requirement: 250000,
        color: 'from-gray-300 to-gray-500',
        unlocked: false
      },
      {
        id: 'fitness_gold',
        name: 'Gold Runner',
        description: 'Walk 1,000,000 total steps',
        icon: '🥇',
        requirement: 1000000,
        color: 'from-yellow-400 to-yellow-600',
        unlocked: false
      },
      {
        id: 'fitness_platinum',
        name: 'Platinum Runner',
        description: 'Walk 5,000,000 total steps',
        icon: '💎',
        requirement: 5000000,
        color: 'from-cyan-400 to-cyan-600',
        unlocked: false
      }
    ]
  },
  WELLNESS_BADGES: {
    category: 'Wellness Guardian',
    description: 'Earn by maintaining healthy metrics',
    icon: '💚',
    tiers: [
      {
        id: 'wellness_bronze',
        name: 'Bronze Heart',
        description: 'Maintain healthy metrics for 7 days',
        icon: '🥉',
        requirement: 7,
        color: 'from-orange-400 to-orange-600',
        unlocked: false
      },
      {
        id: 'wellness_silver',
        name: 'Silver Heart',
        description: 'Maintain healthy metrics for 30 days',
        icon: '🥈',
        requirement: 30,
        color: 'from-gray-300 to-gray-500',
        unlocked: false
      },
      {
        id: 'wellness_gold',
        name: 'Gold Heart',
        description: 'Maintain healthy metrics for 90 days',
        icon: '🥇',
        requirement: 90,
        color: 'from-yellow-400 to-yellow-600',
        unlocked: false
      },
      {
        id: 'wellness_platinum',
        name: 'Platinum Heart',
        description: 'Maintain healthy metrics for 365 days',
        icon: '💎',
        requirement: 365,
        color: 'from-cyan-400 to-cyan-600',
        unlocked: false
      }
    ]
  }
};

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

    // Get user stats
    const statsDoc = await adminDb.collection('userStats').doc(userId).get();
    const stats = statsDoc.exists ? statsDoc.data() : {
      totalPoints: 0,
      achievementsCount: 0,
      currentStreak: 0,
      longestStreak: 0
    };

    // Get completed goals count
    const goalsSnapshot = await adminDb
      .collection('healthGoals')
      .where('userId', '==', userId)
      .where('completed', '==', true)
      .get();
    const completedGoalsCount = goalsSnapshot.size;

    // Get total steps (you'll need to implement this based on your data structure)
    const readingsSnapshot = await adminDb
      .collection('readings')
      .where('userId', '==', userId)
      .get();
    
    let totalSteps = 0;
    let healthyDaysCount = 0;
    
    readingsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.steps) {
        totalSteps += data.steps;
      }
      // Simple healthy metrics check (you can enhance this)
      if (data.glucose && data.glucose >= 70 && data.glucose <= 130 &&
          data.bpSystolic && data.bpSystolic >= 90 && data.bpSystolic <= 120) {
        healthyDaysCount++;
      }
    });

    // Calculate badge unlocks for each category
    const badgeCategories = Object.entries(BADGE_TIERS).map(([key, category]) => {
      const unlockedTiers = category.tiers.map(tier => {
        let isUnlocked = false;
        
        switch (key) {
          case 'STREAK_BADGES':
            isUnlocked = (stats?.longestStreak || 0) >= tier.requirement;
            break;
          case 'POINTS_BADGES':
            isUnlocked = (stats?.totalPoints || 0) >= tier.requirement;
            break;
          case 'ACHIEVEMENT_BADGES':
            isUnlocked = (stats?.achievementsCount || 0) >= tier.requirement;
            break;
          case 'GOAL_BADGES':
            isUnlocked = completedGoalsCount >= tier.requirement;
            break;
          case 'FITNESS_BADGES':
            isUnlocked = totalSteps >= tier.requirement;
            break;
          case 'WELLNESS_BADGES':
            isUnlocked = healthyDaysCount >= tier.requirement;
            break;
        }

        return {
          ...tier,
          unlocked: isUnlocked,
          progress: key === 'STREAK_BADGES' ? stats?.longestStreak || 0 :
                   key === 'POINTS_BADGES' ? stats?.totalPoints || 0 :
                   key === 'ACHIEVEMENT_BADGES' ? stats?.achievementsCount || 0 :
                   key === 'GOAL_BADGES' ? completedGoalsCount :
                   key === 'FITNESS_BADGES' ? totalSteps :
                   healthyDaysCount
        };
      });

      return {
        category: category.category,
        description: category.description,
        icon: category.icon,
        tiers: unlockedTiers
      };
    });

    // Calculate total unlocked badges
    const totalUnlocked = badgeCategories.reduce((sum, cat) => 
      sum + cat.tiers.filter(t => t.unlocked).length, 0
    );
    const totalBadges = badgeCategories.reduce((sum, cat) => 
      sum + cat.tiers.length, 0
    );

    return NextResponse.json({
      success: true,
      badges: badgeCategories,
      stats: {
        totalUnlocked,
        totalBadges,
        completionPercentage: Math.round((totalUnlocked / totalBadges) * 100)
      }
    });
  } catch (error) {
    console.error('Error fetching badges:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch badges' },
      { status: 500 }
    );
  }
}
