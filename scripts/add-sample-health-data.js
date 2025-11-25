// Add Sample Health Data for Testing ML Predictions
// Run this in browser console at: http://localhost:3000

async function addSampleHealthData(userId, daysOfData = 30) {
  console.log(`🏥 Adding ${daysOfData} days of sample health data for user: ${userId}`);
  
  const metrics = [];
  const today = new Date();
  
  // Generate realistic health metrics for past 30 days
  for (let i = 0; i < daysOfData; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Morning reading (8 AM)
    const morning = new Date(date);
    morning.setHours(8, 0, 0);
    
    // Afternoon reading (2 PM)
    const afternoon = new Date(date);
    afternoon.setHours(14, 0, 0);
    
    // Evening reading (8 PM)
    const evening = new Date(date);
    evening.setHours(20, 0, 0);
    
    // Heart rate (70-85 bpm, with some variation)
    metrics.push({
      timestamp: morning,
      metricType: 'heart_rate',
      value: Math.round(70 + Math.random() * 15),
      source: 'manual'
    });
    
    // Daily steps (5000-10000)
    metrics.push({
      timestamp: evening,
      metricType: 'steps',
      value: Math.round(5000 + Math.random() * 5000),
      source: 'manual'
    });
    
    // Sleep hours (6-8 hours)
    metrics.push({
      timestamp: morning,
      metricType: 'sleep',
      value: Math.round((6 + Math.random() * 2) * 10) / 10,
      source: 'manual'
    });
    
    // Calories (1800-2600)
    metrics.push({
      timestamp: evening,
      metricType: 'calories',
      value: Math.round(1800 + Math.random() * 800),
      source: 'manual'
    });
  }
  
  // Add to Firestore
  const { addDoc, collection, Timestamp } = await import('firebase/firestore');
  const { db } = await import('@/lib/firebase');
  
  let count = 0;
  for (const metric of metrics) {
    await addDoc(collection(db, 'healthMetrics'), {
      userId,
      timestamp: Timestamp.fromDate(metric.timestamp),
      metricType: metric.metricType,
      value: metric.value,
      source: metric.source
    });
    count++;
    if (count % 10 === 0) {
      console.log(`  ✅ Added ${count}/${metrics.length} metrics...`);
    }
  }
  
  console.log(`✅ Successfully added ${metrics.length} health metrics!`);
  console.log('📊 Refresh the Health Prediction page to see updated charts');
  return { success: true, count: metrics.length };
}

// Auto-run for current logged-in user
(async () => {
  try {
    // Get current user from auth store
    const { useAuthStore } = await import('@/lib/store/auth.store');
    const { user } = useAuthStore.getState();
    
    if (!user) {
      console.error('❌ No user logged in. Please log in first.');
      return;
    }
    
    console.log('👤 Current user:', user.email);
    console.log('🆔 User ID:', user.uid);
    
    // Add 30 days of data
    await addSampleHealthData(user.uid, 30);
    
  } catch (error) {
    console.error('Error:', error);
    console.log('\n📖 Manual usage:');
    console.log('addSampleHealthData("your-user-id-here", 30)');
  }
})();
