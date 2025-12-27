/**
 * Migrate existing health data to generate alerts in the new anomaly detection system
 * This script finds all patients with readings and triggers anomaly detection for each
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: 'scouts-health-monitor-2025'
    });
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

async function triggerAnomalyDetection(patientId, doctorId) {
  try {
    const response = await fetch('http://localhost:3000/api/anomaly-detection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, doctorId })
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`  ❌ Error triggering detection for patient ${patientId}:`, error.message);
    return null;
  }
}

async function migrateAlerts() {
  console.log('🔄 Starting alert migration to new anomaly detection system...\n');
  
  try {
    // Get all doctor-patient relationships
    const requestsSnapshot = await db
      .collection('doctorPatientRequests')
      .where('status', '==', 'accepted')
      .get();
    
    if (requestsSnapshot.empty) {
      console.log('⚠️  No accepted doctor-patient relationships found');
      console.log('   Patients need to be assigned to doctors first\n');
      return;
    }
    
    const relationships = [];
    requestsSnapshot.forEach(doc => {
      const data = doc.data();
      relationships.push({
        patientId: data.patientId,
        doctorId: data.doctorId,
        patientName: data.patientName || 'Unknown'
      });
    });
    
    console.log(`📋 Found ${relationships.length} doctor-patient relationships\n`);
    
    let processed = 0;
    let alertsCreated = 0;
    
    for (const rel of relationships) {
      console.log(`\n🔍 Processing: ${rel.patientName} (${rel.patientId})`);
      console.log(`   Assigned to Doctor: ${rel.doctorId}`);
      
      // Check if patient has readings
      const readingsSnapshot = await db
        .collection('readings')
        .where('patientId', '==', rel.patientId)
        .limit(1)
        .get();
      
      if (readingsSnapshot.empty) {
        console.log('   ⚠️  No health readings found for this patient');
        continue;
      }
      
      console.log('   ✅ Has health data, triggering anomaly detection...');
      
      const result = await triggerAnomalyDetection(rel.patientId, rel.doctorId);
      
      if (result && result.success) {
        processed++;
        if (result.alerts && result.alerts.created > 0) {
          alertsCreated += result.alerts.created;
          console.log(`   🎯 Created ${result.alerts.created} alerts`);
          if (result.severity) {
            console.log(`   📊 Overall severity: ${result.severity}`);
          }
        } else {
          console.log('   ✓ No anomalies detected (all readings normal)');
        }
      } else {
        console.log(`   ❌ Failed: ${result?.error || 'Unknown error'}`);
      }
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration complete!');
    console.log(`📊 Summary:`);
    console.log(`   - Patients processed: ${processed}/${relationships.length}`);
    console.log(`   - Alerts created: ${alertsCreated}`);
    console.log('\n🎯 Next steps:');
    console.log('   1. Refresh the doctor dashboard');
    console.log('   2. Click the "Health Alerts" tab');
    console.log('   3. View the generated alerts!\n');
    
  } catch (error) {
    console.error('\n❌ Migration error:', error);
  } finally {
    process.exit(0);
  }
}

// Run the migration
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  Health Alerts Migration - Generate Anomaly Detection     ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

migrateAlerts();
