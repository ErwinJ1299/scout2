import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, orderBy, limit, getDocs, Timestamp, updateDoc, doc } from 'firebase/firestore';

export interface WearableDevice {
  id: string;
  userId: string;
  deviceType: 'fitbit' | 'apple_watch' | 'google_fit' | 'samsung_health';
  deviceName: string;
  connected: boolean;
  lastSync: Date;
  accessToken?: string;
  refreshToken?: string;
}

export interface HealthMetric {
  id?: string;
  userId: string;
  deviceId: string;
  metricType: 'heart_rate' | 'steps' | 'sleep' | 'calories' | 'blood_oxygen' | 'blood_pressure' | 'temperature';
  value: number;
  unit: string;
  timestamp: Date;
  source: string;
}

export class WearableService {
  // Fitbit Integration
  static async connectFitbit(userId: string, authCode: string) {
    try {
      // Exchange auth code for access token
      const response = await fetch('https://api.fitbit.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${process.env.NEXT_PUBLIC_FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`)}`
        },
        body: new URLSearchParams({
          code: authCode,
          grant_type: 'authorization_code',
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/wearables/fitbit/callback`
        })
      });

      const data = await response.json();

      // Build device data object, only including defined values
      const deviceData: any = {
        userId,
        deviceType: 'fitbit',
        deviceName: 'Fitbit Device',
        connected: true,
        lastSync: Timestamp.now(),
        createdAt: Timestamp.now()
      };

      // Only add tokens if they exist
      if (data.access_token) {
        deviceData.accessToken = data.access_token;
      }
      if (data.refresh_token) {
        deviceData.refreshToken = data.refresh_token;
      }

      // Save device connection
      await addDoc(collection(db, 'wearableDevices'), deviceData);

      return { success: true, deviceId: data.user_id };
    } catch (error) {
      console.error('Error connecting Fitbit:', error);
      throw error;
    }
  }

  // Fetch Fitbit Health Data
  static async syncFitbitData(userId: string, deviceId: string, accessToken: string, days: number = 1) {
    try {
      console.log(`🔄 Syncing Fitbit data for ${days} days...`);
      
      // Call our API route to fetch data (bypasses CORS)
      const response = await fetch('/api/wearables/fitbit/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, days })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync Fitbit data');
      }

      console.log(`✅ Fetched ${data.metrics.length} metrics from Fitbit`);

      // Save metrics to Firestore
      const healthMetricsRef = collection(db, 'healthMetrics');

      for (const metric of data.metrics) {
        const metricDate = metric.date ? new Date(metric.date) : new Date();
        const now = metricDate;
        
        await addDoc(healthMetricsRef, {
          userId,
          deviceId,
          metricType: metric.metricType,
          value: metric.value,
          unit: metric.unit,
          timestamp: Timestamp.fromDate(now),
          source: metric.source
        });
      }

      // Update last sync time
      const devicesRef = collection(db, 'wearableDevices');
      const q = query(devicesRef, where('userId', '==', userId), where('deviceType', '==', 'fitbit'));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const deviceDoc = snapshot.docs[0];
        await updateDoc(doc(db, 'wearableDevices', deviceDoc.id), {
          lastSync: Timestamp.now()
        });
      }

      console.log(`✅ Saved ${data.metrics.length} metrics to Firestore`);
      return { success: true, metricsCount: data.metrics.length };
    } catch (error) {
      console.error('❌ Error syncing Fitbit data:', error);
      throw error;
    }
  }

  // Apple Health Kit Integration (iOS only)
  static async connectAppleWatch(userId: string) {
    try {
      await addDoc(collection(db, 'wearableDevices'), {
        userId,
        deviceType: 'apple_watch',
        deviceName: 'Apple Watch',
        connected: true,
        lastSync: Timestamp.now(),
        createdAt: Timestamp.now()
      });

      return { success: true, message: 'Apple Watch connected. Please sync data from iOS app.' };
    } catch (error) {
      console.error('Error connecting Apple Watch:', error);
      throw error;
    }
  }

  // Google Fit Integration
  static async connectGoogleFit(userId: string, authCode: string) {
    try {
      // Exchange auth code for access token
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: authCode,
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/wearables/google-fit/callback`,
          grant_type: 'authorization_code'
        })
      });

      const data = await response.json();

      // Build device data object, only including refresh token if it exists
      const deviceData: any = {
        userId,
        deviceType: 'google_fit',
        deviceName: 'Google Fit',
        connected: true,
        lastSync: Timestamp.now(),
        accessToken: data.access_token,
        createdAt: Timestamp.now()
      };

      // Only add refreshToken if it exists
      if (data.refresh_token) {
        deviceData.refreshToken = data.refresh_token;
      }

      await addDoc(collection(db, 'wearableDevices'), deviceData);

      return { success: true };
    } catch (error) {
      console.error('Error connecting Google Fit:', error);
      throw error;
    }
  }

  // Sync Google Fit Data
  static async syncGoogleFitData(userId: string, deviceId: string, accessToken: string) {
    try {
      console.log('🔄 Syncing Google Fit data...');
      
      // Call our API route to fetch data (bypasses CORS)
      const response = await fetch('/api/wearables/google-fit/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync Google Fit data');
      }

      console.log(`✅ Fetched ${data.metrics.length} metrics from Google Fit`);

      // Save metrics to Firestore
      const healthMetricsRef = collection(db, 'healthMetrics');
      const now = new Date();

      for (const metric of data.metrics) {
        const metricDate = metric.date ? new Date(metric.date) : new Date();
        
        await addDoc(healthMetricsRef, {
          userId,
          deviceId,
          metricType: metric.metricType,
          value: metric.value,
          unit: metric.unit,
          timestamp: Timestamp.fromDate(metricDate),
          source: metric.source
        });
      }

      // Update last sync
      const devicesRef = collection(db, 'wearableDevices');
      const q = query(devicesRef, where('userId', '==', userId), where('deviceType', '==', 'google_fit'));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const deviceDoc = snapshot.docs[0];
        await updateDoc(doc(db, 'wearableDevices', deviceDoc.id), {
          lastSync: Timestamp.now()
        });
      }

      console.log(`✅ Saved ${data.metrics.length} metrics to Firestore`);
      return { success: true, metricsCount: data.metrics.length };
    } catch (error) {
      console.error('❌ Error syncing Google Fit data:', error);
      throw error;
    }
  }

  // Fetch user's connected devices
  static async getUserDevices(userId: string): Promise<WearableDevice[]> {
    try {
      const devicesRef = collection(db, 'wearableDevices');
      const q = query(devicesRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        lastSync: docSnap.data().lastSync?.toDate()
      })) as WearableDevice[];
    } catch (error) {
      console.error('Error fetching devices:', error);
      return [];
    }
  }

  // Fetch health metrics
  static async getHealthMetrics(
    userId: string,
    metricType?: string,
    days: number = 7
  ): Promise<HealthMetric[]> {
    try {
      const metricsRef = collection(db, 'healthMetrics');
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let q;
      if (metricType) {
        q = query(
          metricsRef,
          where('userId', '==', userId),
          where('metricType', '==', metricType),
          where('timestamp', '>=', Timestamp.fromDate(startDate)),
          orderBy('timestamp', 'desc'),
          limit(100)
        );
      } else {
        q = query(
          metricsRef,
          where('userId', '==', userId),
          where('timestamp', '>=', Timestamp.fromDate(startDate)),
          orderBy('timestamp', 'desc'),
          limit(100)
        );
      }

      const snapshot = await getDocs(q);

      return snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        timestamp: docSnap.data().timestamp?.toDate()
      })) as HealthMetric[];
    } catch (error) {
      console.error('Error fetching health metrics:', error);
      return [];
    }
  }

  // Disconnect device
  static async disconnectDevice(deviceId: string) {
    try {
      const deviceRef = doc(db, 'wearableDevices', deviceId);
      await updateDoc(deviceRef, {
        connected: false,
        accessToken: null,
        refreshToken: null
      });

      return { success: true };
    } catch (error) {
      console.error('Error disconnecting device:', error);
      throw error;
    }
  }
}
