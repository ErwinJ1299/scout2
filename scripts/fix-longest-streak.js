// Script to fix longest streak in GamificationProgress
// Run this once to update the longest streak to 7

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixLongestStreak() {
  try {
    // Get all users with gamification progress
    const progressSnapshot = await db.collection('GamificationProgress').get();
    
    console.log(`Found ${progressSnapshot.size} gamification progress records`);
    
    for (const doc of progressSnapshot.docs) {
      const data = doc.data();
      const userId = doc.id;
      
      console.log(`\nUser: ${userId}`);
      console.log(`Current streak: ${data.currentStreak || 0}`);
      console.log(`Longest streak: ${data.longestStreak || 0}`);
      
      // Check patient document for old streak value
      const patientDoc = await db.collection('patients').doc(userId).get();
      if (patientDoc.exists) {
        const patientData = patientDoc.data();
        const oldStreak = patientData.streak || 0;
        
        console.log(`Old patient streak: ${oldStreak}`);
        
        // Update if patient had a higher streak
        if (oldStreak > (data.longestStreak || 0)) {
          await db.collection('GamificationProgress').doc(userId).update({
            longestStreak: oldStreak
          });
          console.log(`✅ Updated longest streak to ${oldStreak}`);
        }
      }
    }
    
    console.log('\n✅ Longest streak fix completed!');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing longest streak:', error);
    process.exit(1);
  }
}

fixLongestStreak();
