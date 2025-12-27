import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App | undefined;
let adminDb: Firestore | undefined;

// Initialize Firebase Admin only on server side
if (typeof window === 'undefined') {
  try {
    if (getApps().length === 0) {
      // Try to use service account from environment variable
      let credential;
      
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY));
      } else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        credential = cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        });
      } else {
        // During build time, we don't have credentials - that's okay
        console.warn('⚠️  No Firebase Admin credentials found. Skipping initialization (normal during build).');
      }

      // Only initialize if we have credentials
      if (credential) {
        adminApp = initializeApp({
          credential,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
        adminDb = getFirestore(adminApp);
        console.log('✅ Firebase Admin initialized successfully');
      }
    } else {
      adminApp = getApps()[0];
      adminDb = getFirestore(adminApp);
    }
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error);
    // Don't throw - let it fail gracefully
  }
}

export { adminDb };
