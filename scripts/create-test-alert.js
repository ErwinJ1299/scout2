/**
 * Test Script: Create Sample Health Alert
 * 
 * This script creates a sample critical alert for testing the alerts dashboard.
 * Run with: node scripts/create-test-alert.js
 * 
 * Usage:
 * 1. Replace PATIENT_ID and DOCTOR_ID with actual IDs from your database
 * 2. Run: node scripts/create-test-alert.js
 * 3. Check the doctor's dashboard to see the alert
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json'); // You'll need to download this from Firebase Console

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Replace these with actual IDs from your database
const PATIENT_ID = 'YOUR_PATIENT_ID_HERE';
const DOCTOR_ID = 'YOUR_DOCTOR_ID_HERE';
const PATIENT_NAME = 'Test Patient';

async function createSampleAlert() {
  console.log('🔧 Creating sample health alert...\n');
  
  try {
    // Create a CRITICAL alert for high blood pressure
    const alertRef = db.collection('healthAlerts').doc();
    
    const alertData = {
      id: alertRef.id,
      patientId: PATIENT_ID,
      patientName: PATIENT_NAME,
      doctorId: DOCTOR_ID,
      severity: 'CRITICAL',
      status: 'ACTIVE',
      triggerMetric: 'blood_pressure_systolic',
      triggerValue: 185,
      createdAt: admin.firestore.Timestamp.now(),
      notificationSent: true,
      notificationType: 'email',
      notificationSentAt: admin.firestore.Timestamp.now(),
      detectionResult: {
        patientId: PATIENT_ID,
        timestamp: admin.firestore.Timestamp.now(),
        severity: 'CRITICAL',
        confidence: {
          overall: 0.85,
          dataQuality: 0.9,
          dataRecency: 0.95,
          dataConsistency: 0.7,
          factors: ['High-quality data sources', 'Recent reading'],
        },
        anomalies: [
          {
            metric: 'blood_pressure_systolic',
            currentValue: 185,
            normalRange: { min: 90, max: 120 },
            deviation: 65,
            type: 'threshold_breach',
            description: 'CRITICAL: blood pressure systolic is dangerously high at 185 mmHg (critical threshold: 180)',
          }
        ],
        trendAnalysis: [
          {
            metric: 'blood_pressure_systolic',
            direction: 'increasing',
            slope: 2.5,
            volatility: 0.15,
            dataPoints: 10,
            periodDays: 7,
          }
        ],
        rawReadings: [
          {
            metric: 'blood_pressure_systolic',
            value: 185,
            timestamp: admin.firestore.Timestamp.now(),
            source: 'manual',
          }
        ],
        recentHistory: [],
        recommendations: [
          '⚠️ URGENT: Seek immediate medical attention',
          'Contact your healthcare provider or call emergency services',
          'Take blood pressure again in a seated position after 5 min rest',
          'Avoid caffeine and stress before re-measurement',
        ],
        requiresNotification: true,
      },
    };
    
    await alertRef.set(alertData);
    
    console.log('✅ Sample alert created successfully!');
    console.log('📋 Alert ID:', alertRef.id);
    console.log('🔴 Severity:', alertData.severity);
    console.log('📊 Trigger:', alertData.triggerMetric, '=', alertData.triggerValue);
    console.log('\n👨‍⚕️ Check the doctor dashboard to see the alert!');
    console.log(`🔗 URL: http://localhost:3000/doctor/dashboard\n`);
    
    // Also create a WATCH level alert
    const alertRef2 = db.collection('healthAlerts').doc();
    
    const alertData2 = {
      id: alertRef2.id,
      patientId: PATIENT_ID,
      patientName: PATIENT_NAME,
      doctorId: DOCTOR_ID,
      severity: 'WATCH',
      status: 'ACTIVE',
      triggerMetric: 'glucose',
      triggerValue: 155,
      createdAt: admin.firestore.Timestamp.now(),
      notificationSent: false,
      detectionResult: {
        patientId: PATIENT_ID,
        timestamp: admin.firestore.Timestamp.now(),
        severity: 'WATCH',
        confidence: {
          overall: 0.75,
          dataQuality: 0.7,
          dataRecency: 0.8,
          dataConsistency: 0.75,
          factors: ['Manual data entry'],
        },
        anomalies: [
          {
            metric: 'glucose',
            currentValue: 155,
            normalRange: { min: 70, max: 140 },
            deviation: 15,
            type: 'threshold_breach',
            description: 'WARNING: glucose is above normal at 155 mg/dL',
          }
        ],
        trendAnalysis: [
          {
            metric: 'glucose',
            direction: 'stable',
            slope: 0.5,
            volatility: 0.1,
            dataPoints: 8,
            periodDays: 7,
          }
        ],
        rawReadings: [
          {
            metric: 'glucose',
            value: 155,
            timestamp: admin.firestore.Timestamp.now(),
            source: 'manual',
          }
        ],
        recentHistory: [],
        recommendations: [
          'Continue monitoring and log any symptoms',
          'Consult your doctor within 24-48 hours if readings persist',
          'Review your diet and exercise routine',
        ],
        requiresNotification: false,
      },
    };
    
    await alertRef2.set(alertData2);
    
    console.log('✅ Second alert (WATCH) created successfully!');
    console.log('📋 Alert ID:', alertRef2.id);
    console.log('🟡 Severity:', alertData2.severity);
    console.log('📊 Trigger:', alertData2.triggerMetric, '=', alertData2.triggerValue, '\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error creating alert:', error);
    process.exit(1);
  }
}

// Run the script
createSampleAlert();
