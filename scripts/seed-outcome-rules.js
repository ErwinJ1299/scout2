/**
 * Seed Outcome-Based Reward Rules
 * 
 * Populates the 'outcomeRules' collection with predefined rules for
 * clinical improvement rewards.
 * 
 * Run: node scripts/seed-outcome-rules.js
 */

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
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

// Outcome Rules Configuration
const outcomeRules = [
  {
    id: 'glucose_weekly_drop',
    metric: 'glucose',
    description: 'Glucose Control - Weekly Improvement',
    windowDays: 7,
    minChange: 10, // mg/dL decrease
    direction: 'decrease',
    targetMin: 80,
    targetMax: 150,
    rewardHp: 40,
    rewardWc: 1,
    cooldownDays: 14,
    active: true,
  },
  {
    id: 'bp_weekly_drop',
    metric: 'bp',
    description: 'Blood Pressure - Weekly Improvement',
    windowDays: 7,
    minChange: 5, // mmHg systolic decrease
    direction: 'decrease',
    targetMax: 140,
    rewardHp: 30,
    rewardWc: 1,
    cooldownDays: 14,
    active: true,
  },
  {
    id: 'steps_weekly_boost',
    metric: 'steps',
    description: 'Activity Boost - Weekly Step Increase',
    windowDays: 7,
    minChange: 2000, // avg daily steps increase
    direction: 'increase',
    targetMin: 8000,
    rewardHp: 25,
    rewardWc: 1,
    cooldownDays: 7,
    active: true,
  },
  {
    id: 'weight_loss',
    metric: 'weight',
    description: 'Weight Management - Bi-weekly Loss',
    windowDays: 14,
    minChange: 1.0, // kg decrease
    direction: 'decrease',
    rewardHp: 50,
    rewardWc: 2,
    cooldownDays: 21,
    active: true,
  },
];

async function seedOutcomeRules() {
  console.log('🌱 Starting to seed outcome-based reward rules...\n');
  
  const batch = db.batch();
  let count = 0;

  for (const rule of outcomeRules) {
    const docRef = db.collection('outcomeRules').doc(rule.id);
    
    batch.set(docRef, {
      ...rule,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    count++;
    console.log(`✓ Prepared rule: ${rule.description}`);
    console.log(`  └─ Metric: ${rule.metric} | Window: ${rule.windowDays}d | Cooldown: ${rule.cooldownDays}d`);
    console.log(`  └─ Reward: +${rule.rewardHp} HP, +${rule.rewardWc} WC\n`);
  }

  try {
    await batch.commit();
    console.log(`✅ Successfully seeded ${count} outcome rules!`);
    console.log('🎯 Outcome-based rewards system is ready.\n');
    
    console.log('📋 Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    outcomeRules.forEach(rule => {
      console.log(`${rule.id.padEnd(25)} → +${rule.rewardHp} HP, +${rule.rewardWc} WC`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error seeding outcome rules:', error);
    process.exit(1);
  }
}

// Check if we should clear existing rules first
const args = process.argv.slice(2);
const shouldClear = args.includes('--clear');

async function clearExistingRules() {
  console.log('🗑️  Clearing existing outcome rules...');
  const snapshot = await db.collection('outcomeRules').get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
  console.log(`✓ Cleared ${snapshot.size} existing rules\n`);
}

// Main execution
(async () => {
  try {
    if (shouldClear) {
      await clearExistingRules();
    }
    await seedOutcomeRules();
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
})();
