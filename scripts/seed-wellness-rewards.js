/**
 * Seed Wellness Marketplace Rewards
 * Populates the 'rewards' collection with example partner benefits
 * Run: node scripts/seed-wellness-rewards.js
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

// Sample rewards data
const rewards = [
  {
    title: "10% Off Diabetes Medicines",
    category: "Pharmacy",
    costTokens: 15,
    description: "Get 10% discount on all diabetes medicines and supplies. Valid on orders above ₹500.",
    externalUrl: "https://pharmeasy.in",
    imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400",
    active: true,
    stock: null, // unlimited
    terms: "Valid for 90 days from redemption. Cannot be combined with other offers."
  },
  {
    title: "Free Diet Consultation",
    category: "Nutrition",
    costTokens: 40,
    description: "Complimentary 30-minute video consultation with certified nutritionist. Personalized meal plans included.",
    externalUrl: null,
    imageUrl: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400",
    active: true,
    stock: null,
    terms: "Schedule within 60 days of redemption. Valid for one-time use only."
  },
  {
    title: "1-Week Gym Pass",
    category: "Fitness",
    costTokens: 60,
    description: "Access to premium gyms nationwide for 7 days. Includes group fitness classes and personal trainer consultation.",
    externalUrl: "https://fitpass.in",
    imageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400",
    active: true,
    stock: null,
    terms: "Valid at participating gyms. Must activate within 30 days of redemption."
  },
  {
    title: "Blood Test 20% Off",
    category: "Services",
    costTokens: 25,
    description: "20% discount on comprehensive blood test packages. Home collection available in metro cities.",
    externalUrl: "https://1mg.com",
    imageUrl: "https://images.unsplash.com/photo-1579154204601-01588f351e67?w=400",
    active: true,
    stock: null,
    terms: "Valid for 90 days. Cannot be used with insurance claims."
  },
  {
    title: "Premium Health Report",
    category: "Premium",
    costTokens: 80,
    description: "Detailed AI-powered health analysis with predictive insights and personalized recommendations from medical experts.",
    externalUrl: null,
    imageUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400",
    active: true,
    stock: null,
    terms: "Report delivered within 48 hours. Includes 1 follow-up consultation."
  },
  {
    title: "Doctor Teleconsultation Voucher",
    category: "Services",
    costTokens: 100,
    description: "Free video consultation with verified specialist doctors. Valid for general physician, cardiologist, or endocrinologist.",
    externalUrl: null,
    imageUrl: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400",
    active: true,
    stock: null,
    terms: "Book within 90 days. One consultation per redemption. 30-minute session."
  },
  {
    title: "Yoga Classes - 1 Month",
    category: "Fitness",
    costTokens: 75,
    description: "Unlimited access to live online yoga classes for 30 days. Beginner to advanced levels. Morning and evening batches.",
    externalUrl: "https://yogainternational.com",
    imageUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400",
    active: true,
    stock: null,
    terms: "Classes available 7 days a week. Recordings available for 7 days after live session."
  },
  {
    title: "Mental Wellness Session",
    category: "Premium",
    costTokens: 90,
    description: "45-minute counseling session with licensed therapist. Stress management, anxiety, and emotional wellness support.",
    externalUrl: null,
    imageUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400",
    active: true,
    stock: null,
    terms: "Confidential session. Book within 60 days. HIPAA compliant platform."
  },
  {
    title: "Healthy Meal Kit - 5 Days",
    category: "Nutrition",
    costTokens: 120,
    description: "Pre-portioned ingredients for 5 healthy dinners. Recipes for diabetic-friendly, heart-healthy meals delivered to your door.",
    externalUrl: "https://freshmenu.com",
    imageUrl: "https://images.unsplash.com/photo-1547496502-affa22d38842?w=400",
    active: true,
    stock: null,
    terms: "Delivery in select cities. Order within 30 days. Dietary preferences customizable."
  },
  {
    title: "Wearable Device Discount",
    category: "Premium",
    costTokens: 150,
    description: "₹2000 off on fitness trackers and smartwatches. Track steps, heart rate, sleep, and more. Compatible with app.",
    externalUrl: "https://fitbit.com",
    imageUrl: "https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=400",
    active: true,
    stock: null,
    terms: "Valid on select models. Discount applied at checkout. 90-day validity."
  }
];

async function seedRewards() {
  console.log('🌱 Starting to seed wellness rewards...\n');
  
  const batch = db.batch();
  let count = 0;

  for (const reward of rewards) {
    const docRef = db.collection('rewards').doc();
    batch.set(docRef, {
      ...reward,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    count++;
    console.log(`✓ Prepared reward: ${reward.title} (${reward.costTokens} WC)`);
  }

  try {
    await batch.commit();
    console.log(`\n✅ Successfully seeded ${count} wellness rewards!`);
    console.log('🎉 Marketplace is ready for redemptions.\n');
  } catch (error) {
    console.error('❌ Error seeding rewards:', error);
    process.exit(1);
  }
}

// Check if we should clear existing rewards first
const args = process.argv.slice(2);
const shouldClear = args.includes('--clear');

async function clearExistingRewards() {
  console.log('🗑️  Clearing existing rewards...');
  const snapshot = await db.collection('rewards').get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
  console.log(`✓ Cleared ${snapshot.size} existing rewards\n`);
}

// Main execution
(async () => {
  try {
    if (shouldClear) {
      await clearExistingRewards();
    }
    await seedRewards();
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
})();
