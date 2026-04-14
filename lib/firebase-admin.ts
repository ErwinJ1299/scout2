import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let adminApp: App | undefined;
let adminDb: Firestore | undefined;

type ServiceAccountLike = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function parseServiceAccountFromEnvVar(): ServiceAccountLike | undefined {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw);
    return {
      projectId: parsed.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      clientEmail: parsed.client_email || '',
      privateKey: String(parsed.private_key || '').replace(/\\n/g, '\n'),
    };
  } catch {
    console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON. Falling back to alternate admin credential parsing.');
    return undefined;
  }
}

function parseServiceAccountFromSplitEnv(): ServiceAccountLike | undefined {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';

  if (!projectId || !clientEmail || !privateKey) return undefined;

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

function parseServiceAccountFromMalformedEnvFile(): ServiceAccountLike | undefined {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return undefined;

    const content = fs.readFileSync(envPath, 'utf8');
    const blockStart = content.indexOf('FIREBASE_SERVICE_ACCOUNT_KEY=');
    if (blockStart === -1) return undefined;

    const block = content.slice(blockStart);
    const projectIdMatch = block.match(/"project_id"\s*:\s*"([^"]+)"/);
    const clientEmailMatch = block.match(/"client_email"\s*:\s*"([^"]+)"/);
    const privateKeyMatch = block.match(/"private_key"\s*:\s*"([\s\S]*?)"\s*,\s*\n\s*"client_email"/);

    const projectId = projectIdMatch?.[1] || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
    const clientEmail = clientEmailMatch?.[1] || '';

    if (!privateKeyMatch?.[1] || !clientEmail || !projectId) {
      return undefined;
    }

    // Handle both escaped newlines (\\n) and literal line breaks in malformed blocks.
    let privateKey = privateKeyMatch[1].replace(/\\r/g, '');
    privateKey = privateKey.replace(/\\n/g, '\n');

    return {
      projectId,
      clientEmail,
      privateKey,
    };
  } catch {
    return undefined;
  }
}

// Initialize Firebase Admin only on server side
if (typeof window === 'undefined') {
  try {
    if (getApps().length === 0) {
      // Try to use service account from environment variable
      let credential;

      const fromJsonEnv = parseServiceAccountFromEnvVar();
      const fromSplitEnv = parseServiceAccountFromSplitEnv();
      const fromMalformedFile = parseServiceAccountFromMalformedEnvFile();
      const serviceAccount = fromJsonEnv || fromSplitEnv || fromMalformedFile;

      if (serviceAccount?.projectId && serviceAccount.clientEmail && serviceAccount.privateKey) {
        credential = cert({
          projectId: serviceAccount.projectId,
          clientEmail: serviceAccount.clientEmail,
          privateKey: serviceAccount.privateKey,
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
