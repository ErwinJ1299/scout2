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

async function quickSetup(userId) {
  console.log(`\n🚀 Quick setup for user: ${userId}\n`);

  try {
    // Award First Steps achievement
    console.log('✅ Awarding "First Steps" achievement...');
    await db.collection('achievements').add({
      userId,
      achievementId: 'first_steps',
      name: 'First Steps',
      description: 'Logged your first health reading',
      icon: '👣',
      points: 10,
      category: 'milestone',
      earnedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Award Week Warrior achievement
    console.log('✅ Awarding "Week Warrior" achievement...');
    await db.collection('achievements').add({
      userId,
      achievementId: 'week_streak',
      name: 'Week Warrior',
      description: 'Logged health data for 7 consecutive days',
      icon: '🔥',
      points: 50,
      category: 'streak',
      earnedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Award Early Bird achievement
    console.log('✅ Awarding "Early Bird" achievement...');
    await db.collection('achievements').add({
      userId,
      achievementId: 'early_bird',
      name: 'Early Bird',
      description: 'Logged data before 8 AM',
      icon: '🌅',
      points: 15,
      category: 'habit',
      earnedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create user stats
    console.log('✅ Creating user stats...');
    await db.collection('userStats').doc(userId).set({
      userId,
      totalPoints: 75, // 10 + 50 + 15
      achievementsCount: 3,
      currentStreak: 7,
      longestStreak: 7,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastCalculated: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('\n✨ Setup complete!');
    console.log(`📊 Stats:`);
    console.log(`   - Total Points: 75`);
    console.log(`   - Achievements: 3`);
    console.log(`   - Current Streak: 7 days`);
    console.log(`   - Longest Streak: 7 days`);
    console.log('\n🎉 Refresh the Progress page to see your achievements!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Main execution
const userId = process.argv[2];

if (!userId) {
  console.error('❌ Please provide a user ID as argument');
  console.log('Usage: node quick-setup-achievements.js <userId>');
  process.exit(1);
}

quickSetup(userId)
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
