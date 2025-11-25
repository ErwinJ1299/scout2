// Quick fix: Update longest streak to 7
// This will manually set the longest streak in the GamificationProgress collection

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';

// Your Firebase config
const firebaseConfig = {
  // Add your config here or it will use the existing initialized app
};

async function updateLongestStreak() {
  try {
    const db = getFirestore();
    const userId = "YOUR_USER_ID"; // Replace with actual user ID
    
    const progressRef = doc(db, 'GamificationProgress', userId);
    const progressDoc = await getDoc(progressRef);
    
    if (progressDoc.exists()) {
      const currentData = progressDoc.data();
      console.log('Current longest streak:', currentData.longestStreak);
      
      // Update to 7
      await updateDoc(progressRef, {
        longestStreak: 7
      });
      
      console.log('✅ Longest streak updated to 7!');
    } else {
      console.log('❌ GamificationProgress document not found');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

updateLongestStreak();
