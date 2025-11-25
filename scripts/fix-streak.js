// Run this to update longest streak: node scripts/fix-streak.js YOUR_USER_ID

const admin = require('firebase-admin');

// Initialize if not already done
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();
const userId = process.argv[2];

if (!userId) {
  console.error('❌ Please provide user ID: node scripts/fix-streak.js YOUR_USER_ID');
  process.exit(1);
}

async function fixStreak() {
  try {
    const progressRef = db.collection('GamificationProgress').doc(userId);
    
    await progressRef.update({
      longestStreak: 7
    });
    
    console.log('✅ Longest streak updated to 7!');
    console.log('Refresh the page to see the change.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixStreak();
