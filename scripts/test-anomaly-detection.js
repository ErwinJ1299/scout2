// Quick script to trigger anomaly detection for testing
// Replace with your actual patient and doctor IDs

async function testAnomalyDetection() {
  console.log('🧪 Testing Anomaly Detection System\n');
  
  // INSTRUCTIONS:
  // 1. Get your doctor ID and patient ID from Firebase Console
  // 2. Replace the IDs below
  // 3. Run: node scripts/test-anomaly-detection.js
  
  const PATIENT_ID = 'D5HDZTLdOxgyMdphwNj3DFirD0l1';  // Replace with real patient ID
  const DOCTOR_ID = 'XtPIosz8jrMLLxsQhU67RBGa8bS2';   // Replace with real doctor ID
  
  try {
    console.log(`📋 Patient ID: ${PATIENT_ID}`);
    console.log(`👨‍⚕️ Doctor ID: ${DOCTOR_ID}\n`);
    console.log('🔄 Triggering anomaly detection...\n');
    
    // Try multiple ports as Next.js might be running on 3000 or 3001
    const ports = [3000, 3001];
    let result = null;
    let successPort = null;
    
    for (const port of ports) {
      try {
        const response = await fetch(`http://localhost:${port}/api/anomaly-detection`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            patientId: PATIENT_ID,
            doctorId: DOCTOR_ID
          }),
        });
        
        result = await response.json();
        successPort = port;
        break;
      } catch (error) {
        if (port === ports[ports.length - 1]) {
          throw error;
        }
        continue;
      }
    }
    
    if (!result) {
      throw new Error('Could not connect to API on any port');
    }
    
    console.log(`   ✅ Connected to API on port ${successPort}\n`);
    
    if (result.success) {
      console.log('✅ Detection completed successfully!\n');
      console.log('📊 Results:');
      console.log(`   Severity: ${result.severity}`);
      console.log(`   Alerts created: ${result.alerts?.created || 0}`);
      console.log(`   Analysis timestamp: ${new Date().toLocaleString()}\n`);
      
      if (result.detectionResult) {
        const dr = result.detectionResult;
        console.log('🔍 Detection Details:');
        console.log(`   Overall confidence: ${(dr.confidence?.overall * 100).toFixed(0)}%`);
        console.log(`   Anomalies found: ${dr.anomalies?.length || 0}`);
        console.log(`   Trend analyses: ${dr.trendAnalysis?.length || 0}\n`);
        
        if (dr.anomalies && dr.anomalies.length > 0) {
          console.log('⚠️  Anomalies detected:');
          dr.anomalies.forEach((anomaly, idx) => {
            console.log(`   ${idx + 1}. ${anomaly.metric}: ${anomaly.currentValue} (${anomaly.type})`);
            console.log(`      ${anomaly.description}`);
          });
          console.log();
        }
        
        if (dr.recommendations && dr.recommendations.length > 0) {
          console.log('💡 Recommendations:');
          dr.recommendations.forEach((rec, idx) => {
            console.log(`   ${idx + 1}. ${rec}`);
          });
          console.log();
        }
      }
      
      console.log('🎯 Next steps:');
      console.log('   1. Go to http://localhost:3000/doctor/dashboard');
      console.log('   2. Click the "Health Alerts" tab');
      console.log('   3. View the generated alerts!\n');
      
    } else {
      console.error('❌ Detection failed:', result.error);
      if (result.message) {
        console.error('   Message:', result.message);
      }
      console.log('\n💡 Possible reasons:');
      console.log('   - Patient has no health readings');
      console.log('   - Invalid patient or doctor ID');
      console.log('   - API endpoint error\n');
      console.log('Full response:', JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure:');
    console.log('   - Dev server is running (npm run dev)');
    console.log('   - Patient and doctor IDs are correct');
    console.log('   - Patient has health readings in Firestore\n');
  }
}

testAnomalyDetection();
