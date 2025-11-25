const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const equalsIndex = trimmed.indexOf('=');
      if (equalsIndex > 0) {
        const key = trimmed.substring(0, equalsIndex).trim();
        const value = trimmed.substring(equalsIndex + 1).trim();
        process.env[key] = value;
      }
    }
  }
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Achievement definitions
const ACHIEVEMENTS = {
  FIRST_STEPS: {
    id: 'first_steps',
    name: 'First Steps',
    description: 'Logged your first health reading',
    icon: '👣',
    points: 10,
    category: 'milestone'
  },
  WEEK_STREAK: {
    id: 'week_streak',
    name: 'Week Warrior',
    description: 'Logged health data for 7 consecutive days',
    icon: '🔥',
    points: 50,
    category: 'streak'
  },
  MONTH_STREAK: {
    id: 'month_streak',
    name: 'Monthly Master',
    description: '30-day logging streak',
    icon: '⭐',
    points: 150,
    category: 'streak'
  },
  STEPS_GOAL: {
    id: 'steps_goal',
    name: 'Step Champion',
    description: 'Reached your daily steps goal',
    icon: '🏃',
    points: 25,
    category: 'goal'
  },
  GLUCOSE_CONTROL: {
    id: 'glucose_control',
    name: 'Sugar Guardian',
    description: 'Maintained healthy glucose for 7 days',
    icon: '🎯',
    points: 100,
    category: 'health'
  },
  PERFECT_BP: {
    id: 'perfect_bp',
    name: 'BP Boss',
    description: 'Maintained ideal blood pressure for 7 days',
    icon: '💪',
    points: 100,
    category: 'health'
  },
  EARLY_BIRD: {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Logged data before 8 AM',
    icon: '🌅',
    points: 15,
    category: 'habit'
  },
  HEALTH_EXPLORER: {
    id: 'health_explorer',
    name: 'Health Explorer',
    description: 'Used all features: logs, charts, predictions, coach',
    icon: '🧭',
    points: 75,
    category: 'exploration'
  }
};

async function calculateStreaks(userId) {
  console.log(`\n📊 Calculating streaks for user: ${userId}`);
  
  // Get all readings without orderBy to avoid index requirement
  const readingsSnapshot = await db.collection('readings')
    .where('userId', '==', userId)
    .get();
  
  if (readingsSnapshot.empty) {
    console.log('❌ No readings found');
    return { currentStreak: 0, longestStreak: 0, totalReadings: 0 };
  }

  console.log(`✅ Found ${readingsSnapshot.size} readings`);

  // Get unique dates with readings and sort in memory
  const readingDates = new Set();
  readingsSnapshot.docs.forEach(doc => {
    const timestamp = doc.data().timestamp;
    if (timestamp) {
      const date = timestamp.toDate();
      const dateStr = date.toISOString().split('T')[0];
      readingDates.add(dateStr);
    }
  });

  const uniqueDates = Array.from(readingDates).sort();
  console.log(`📅 Unique days with readings: ${uniqueDates.length}`);

  // Calculate streaks
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < uniqueDates.length; i++) {
    if (i > 0) {
      const prevDate = new Date(uniqueDates[i - 1]);
      const currDate = new Date(uniqueDates[i]);
      const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }

    longestStreak = Math.max(longestStreak, tempStreak);
  }

  // Check if current streak is active (last reading within 1 day)
  const lastReadingDate = new Date(uniqueDates[uniqueDates.length - 1]);
  const daysSinceLastReading = Math.floor((today - lastReadingDate) / (1000 * 60 * 60 * 24));
  
  if (daysSinceLastReading <= 1) {
    currentStreak = tempStreak;
  }

  console.log(`🔥 Current Streak: ${currentStreak} days`);
  console.log(`🏆 Longest Streak: ${longestStreak} days`);

  return { currentStreak, longestStreak, totalReadings: readingsSnapshot.size };
}

async function awardAchievement(userId, achievementKey) {
  const achievement = ACHIEVEMENTS[achievementKey];
  
  // Check if already earned
  const existing = await db.collection('achievements')
    .where('userId', '==', userId)
    .where('achievementId', '==', achievement.id)
    .get();

  if (!existing.empty) {
    console.log(`  ⏭️  Already earned: ${achievement.name}`);
    return false;
  }

  // Award achievement
  await db.collection('achievements').add({
    userId,
    achievementId: achievement.id,
    name: achievement.name,
    description: achievement.description,
    icon: achievement.icon,
    points: achievement.points,
    category: achievement.category,
    earnedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`  ✅ Awarded: ${achievement.name} (+${achievement.points} points)`);
  return true;
}

async function initializeAchievements(userId) {
  console.log(`\n🎮 Initializing achievements for user: ${userId}\n`);

  try {
    // Calculate streaks
    const { currentStreak, longestStreak, totalReadings } = await calculateStreaks(userId);

    // Award achievements based on data
    let totalPoints = 0;
    let achievementsCount = 0;

    // First Steps
    if (totalReadings > 0) {
      if (await awardAchievement(userId, 'FIRST_STEPS')) {
        totalPoints += ACHIEVEMENTS.FIRST_STEPS.points;
        achievementsCount++;
      }
    }

    // Week Streak
    if (longestStreak >= 7) {
      if (await awardAchievement(userId, 'WEEK_STREAK')) {
        totalPoints += ACHIEVEMENTS.WEEK_STREAK.points;
        achievementsCount++;
      }
    }

    // Month Streak
    if (longestStreak >= 30) {
      if (await awardAchievement(userId, 'MONTH_STREAK')) {
        totalPoints += ACHIEVEMENTS.MONTH_STREAK.points;
        achievementsCount++;
      }
    }

    // Check for early morning readings
    const readingsSnapshot = await db.collection('readings')
      .where('userId', '==', userId)
      .get();

    const hasEarlyReading = readingsSnapshot.docs.some(doc => {
      const timestamp = doc.data().timestamp;
      if (timestamp) {
        const hour = timestamp.toDate().getHours();
        return hour < 8;
      }
      return false;
    });

    if (hasEarlyReading) {
      if (await awardAchievement(userId, 'EARLY_BIRD')) {
        totalPoints += ACHIEVEMENTS.EARLY_BIRD.points;
        achievementsCount++;
      }
    }

    // Update or create user stats
    const userStatsRef = db.collection('userStats').doc(userId);
    const userStats = await userStatsRef.get();

    if (userStats.exists) {
      const existingPoints = userStats.data().totalPoints || 0;
      await userStatsRef.update({
        totalPoints: existingPoints + totalPoints,
        achievementsCount: admin.firestore.FieldValue.increment(achievementsCount),
        currentStreak,
        longestStreak,
        lastCalculated: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      await userStatsRef.set({
        userId,
        totalPoints,
        achievementsCount,
        currentStreak,
        longestStreak,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastCalculated: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    console.log(`\n✨ Initialization complete!`);
    console.log(`📊 Stats Updated:`);
    console.log(`   - Total Points: ${totalPoints}`);
    console.log(`   - Achievements: ${achievementsCount}`);
    console.log(`   - Current Streak: ${currentStreak} days`);
    console.log(`   - Longest Streak: ${longestStreak} days`);

  } catch (error) {
    console.error('❌ Error initializing achievements:', error);
    throw error;
  }
}

// Main execution
const userId = process.argv[2];

if (!userId) {
  console.error('❌ Please provide a user ID as argument');
  console.log('Usage: node initialize-achievements.js <userId>');
  process.exit(1);
}

initializeAchievements(userId)
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
