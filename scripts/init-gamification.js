// Initialize GamificationProgress from patient data
// Run: node scripts/init-gamification.js

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function initGamification() {
  try {
    const userId = 'D5HDZTLdOxgyMdphwNj3DFirD0l1'; // Your user ID
    
    console.log('Initializing GamificationProgress for user:', userId);
    
    // Check if already exists
    const gamificationDoc = await db.collection('GamificationProgress').doc(userId).get();
    
    if (gamificationDoc.exists) {
      console.log('✅ GamificationProgress already exists:', gamificationDoc.data());
      process.exit(0);
    }
    
    // Get patient data
    const patientDoc = await db.collection('patients').doc(userId).get();
    const patientData = patientDoc.data();
    
    console.log('Patient data:', patientData);
    
    // Create GamificationProgress with current points
    const gamificationData = {
      userId: userId,
      totalPoints: patientData?.points || 370,
      currentStreak: patientData?.streak || 2,
      longestStreak: 7,
      tasksCompletedToday: 0,
      lastTaskCompletedAt: new Date(),
      lastUpdated: new Date(),
    };
    
    await db.collection('GamificationProgress').doc(userId).set(gamificationData);
    
    console.log('✅ GamificationProgress initialized successfully:', gamificationData);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

initGamification();
