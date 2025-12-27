'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WearableService, WearableDevice } from '@/lib/services/wearable.service';
import { useAuthStore } from '@/lib/store/auth.store';
import { Smartphone, Watch, Activity, RefreshCw, Unplug } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

const AUTO_SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutes

export function WearableDevices() {
  const { user } = useAuthStore();
  const [devices, setDevices] = useState<WearableDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const autoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (user) {
      loadDevices();
      handleOAuthCallback();
    }
  }, [user, searchParams]);

  // Auto-sync setup
  useEffect(() => {
    if (!user || !autoSyncEnabled || devices.length === 0) return;

    // Initial sync after component mount (if last sync was more than 30 min ago)
    const checkAndSync = async () => {
      for (const device of devices) {
        // Handle both Firestore Timestamp and Date objects
        const lastSyncTime = device.lastSync
          ? (typeof device.lastSync.toMillis === 'function'
            ? device.lastSync.toMillis()
            : new Date(device.lastSync).getTime())
          : 0;
        const now = Date.now();
        if (now - lastSyncTime > AUTO_SYNC_INTERVAL) {
          await syncDevice(device, true);
        }
      }
    };

    checkAndSync();

    // Set up interval for auto-sync
    autoSyncIntervalRef.current = setInterval(async () => {
      console.log('🔄 Auto-sync triggered');
      for (const device of devices) {
        await syncDevice(device, true);
      }
    }, AUTO_SYNC_INTERVAL);

    return () => {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
      }
    };
  }, [user, devices, autoSyncEnabled]);

  // Handle OAuth callback and save device
  const handleOAuthCallback = async () => {
    if (!user) return;

    const success = searchParams.get('success');
    const deviceType = searchParams.get('deviceType');
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');

    if (success && deviceType && accessToken) {
      try {
        console.log('💾 Saving device to Firestore...', deviceType);

        // Check if device already exists
        const existingDevices = await WearableService.getUserDevices(user.uid);
        const deviceExists = existingDevices.some(d => d.deviceType === deviceType && d.connected);

        if (deviceExists) {
          console.log('ℹ️ Device already connected');
          toast({
            title: 'Device Already Connected',
            description: `${deviceType === 'fitbit' ? 'Fitbit' : 'Google Fit'} is already connected.`
          });
          window.history.replaceState({}, '', '/patient/wearables');
          return;
        }

        const deviceData: any = {
          userId: user.uid,
          deviceType,
          deviceName: deviceType === 'fitbit' ? 'Fitbit Device' : 'Google Fit',
          connected: true,
          lastSync: Timestamp.now(),
          accessToken,
          createdAt: Timestamp.now()
        };

        if (refreshToken) {
          deviceData.refreshToken = refreshToken;
        }

        await addDoc(collection(db, 'wearableDevices'), deviceData);

        console.log('✅ Device saved successfully');

        toast({
          title: 'Success!',
          description: `${deviceType === 'fitbit' ? 'Fitbit' : 'Google Fit'} connected successfully!`
        });

        // Reload devices
        loadDevices();

        // Clean URL
        window.history.replaceState({}, '', '/patient/wearables');
      } catch (error: any) {
        console.error('❌ Error saving device:', error);
        toast({
          title: 'Error',
          description: 'Failed to save device: ' + error.message,
          variant: 'destructive'
        });
      }
    }

    const error = searchParams.get('error');
    if (error) {
      const message = searchParams.get('message');
      toast({
        title: 'Connection Failed',
        description: message || 'Failed to connect device',
        variant: 'destructive'
      });
      // Clean URL
      window.history.replaceState({}, '', '/patient/wearables');
    }
  };

  const loadDevices = async () => {
    if (!user) return;

    try {
      const userDevices = await WearableService.getUserDevices(user.uid);

      // Deduplicate devices by deviceType
      // Priority: connected devices first, then most recently synced
      const deviceMap = new Map<string, WearableDevice>();
      userDevices.forEach(device => {
        const existing = deviceMap.get(device.deviceType);

        if (!existing) {
          deviceMap.set(device.deviceType, device);
        } else {
          // Prioritize connected devices
          if (device.connected && !existing.connected) {
            deviceMap.set(device.deviceType, device);
          } else if (device.connected === existing.connected) {
            // If both have same connection status, keep most recently synced
            if (device.lastSync && existing.lastSync && new Date(device.lastSync) > new Date(existing.lastSync)) {
              deviceMap.set(device.deviceType, device);
            }
          }
        }
      });

      // Only show connected devices
      const connectedDevices = Array.from(deviceMap.values()).filter(d => d.connected);
      setDevices(connectedDevices);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load devices',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectFitbit = () => {
    if (!user) return;

    const clientId = process.env.NEXT_PUBLIC_FITBIT_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/wearables/fitbit/callback`;
    const scope = 'activity heartrate sleep profile';

    window.location.href = `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${user.uid}`;
  };

  const handleConnectGoogleFit = () => {
    if (!user) return;

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/wearables/google-fit/callback`;
    const scope = 'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.heart_rate.read https://www.googleapis.com/auth/fitness.sleep.read';

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&state=${user.uid}`;
  };

  const handleConnectAppleWatch = async () => {
    if (!user) return;

    try {
      await WearableService.connectAppleWatch(user.uid);
      toast({
        title: 'Success',
        description: 'Apple Watch connected! Please sync data from your iOS app.'
      });
      loadDevices();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to connect Apple Watch',
        variant: 'destructive'
      });
    }
  };

  const handleSync = async (device: WearableDevice) => {
    await syncDevice(device, false);
  };

  const syncDevice = async (device: WearableDevice, isAutoSync: boolean = false) => {
    if (!user || !device.accessToken) return;

    setSyncing(device.id);
    try {
      const days = 1; // Default daily sync
      let result;
      if (device.deviceType === 'fitbit') {
        result = await WearableService.syncFitbitData(user.uid, device.id, device.accessToken, days);
      } else if (device.deviceType === 'google_fit') {
        result = await WearableService.syncGoogleFitData(user.uid, device.id, device.accessToken);
      }

      if (!isAutoSync) {
        toast({
          title: 'Success',
          description: `Synced ${result?.metricsCount || 0} metrics successfully!`
        });
      }
      loadDevices();
    } catch (error: any) {
      if (!isAutoSync) {
        toast({
          title: 'Sync Error',
          description: error.message || 'Failed to sync data',
          variant: 'destructive'
        });
      } else {
        console.error('Auto-sync failed:', error);
      }
    } finally {
      setSyncing(null);
    }
  };

  const syncHistoricalData = async (device: WearableDevice, days: number) => {
    if (!user || !device.accessToken) return;

    setSyncing(device.id);
    try {
      if (device.deviceType === 'fitbit') {
        await WearableService.syncFitbitData(user.uid, device.id, device.accessToken, days);
      }

      toast({
        title: 'Success',
        description: `Synced ${days} days of historical data!`
      });
      loadDevices();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to sync historical data',
        variant: 'destructive'
      });
    } finally {
      setSyncing(null);
    }
  };

  const handleDisconnect = async (deviceId: string) => {
    try {
      await WearableService.disconnectDevice(deviceId);
      toast({
        title: 'Success',
        description: 'Device disconnected'
      });
      loadDevices();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to disconnect device',
        variant: 'destructive'
      });
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'fitbit':
        return <Activity className="h-8 w-8 text-blue-500" />;
      case 'apple_watch':
        return <Watch className="h-8 w-8 text-gray-500" />;
      case 'google_fit':
        return <Smartphone className="h-8 w-8 text-green-500" />;
      default:
        return <Activity className="h-8 w-8" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading your devices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Connected Devices Section */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Connected Devices</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Syncing health data automatically
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${autoSyncEnabled
                ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                }`}>
                <span className={`w-2 h-2 rounded-full ${autoSyncEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                Auto-sync {autoSyncEnabled ? 'ON' : 'OFF'}
              </div>
              <button
                onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
                className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium transition-colors"
              >
                {autoSyncEnabled ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        </div>

        {/* Devices List */}
        <div className="p-6">
          {devices.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Watch className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-gray-900 dark:text-white font-medium mb-1">No devices connected</h3>
              <p className="text-gray-500 text-sm">Connect a wearable device to start tracking your health automatically</p>
            </div>
          ) : (
            <div className="space-y-4">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="group flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
                >
                  <div className="flex items-center gap-4">
                    {/* Device Icon */}
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${device.deviceType === 'fitbit'
                      ? 'bg-[#00B0B9]'
                      : device.deviceType === 'google_fit'
                        ? 'bg-white border border-gray-200 dark:border-gray-700'
                        : 'bg-black'
                      }`}>
                      {device.deviceType === 'fitbit' && (
                        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="white">
                          <path d="M12.5 5.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3-12a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3-9a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm9-6a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3-9a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
                        </svg>
                      )}
                      {device.deviceType === 'google_fit' && (
                        <svg className="w-8 h-8" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                          <path fill="#EA4335" d="M12 2v10l8.66 5c1.17-1.76 1.84-3.85 1.84-6 0-5.52-4.48-10-10-10z" />
                          <path fill="#FBBC05" d="M12 12l-8.66 5C4.51 19.24 7.99 22 12 22c4.01 0 7.49-2.76 8.66-5L12 12z" />
                          <path fill="#34A853" d="M2 12c0 2.15.67 4.24 1.84 6L12 12V2C6.48 2 2 6.48 2 12z" />
                          <circle fill="white" cx="12" cy="12" r="4" />
                        </svg>
                      )}
                      {device.deviceType === 'apple_watch' && (
                        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="white">
                          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                        </svg>
                      )}
                    </div>

                    {/* Device Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{device.deviceName}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${device.connected
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                          }`}>
                          {device.connected ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        Last synced: {device.lastSync ? new Date(device.lastSync).toLocaleString() : 'Never'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {device.connected && device.accessToken && (
                      <>
                        <button
                          onClick={() => handleSync(device)}
                          disabled={syncing === device.id}
                          className="p-2.5 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-teal-300 dark:hover:border-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all"
                          title="Sync now"
                        >
                          <RefreshCw className={`h-4 w-4 text-gray-600 dark:text-gray-300 ${syncing === device.id ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          onClick={() => syncHistoricalData(device, 7)}
                          disabled={syncing === device.id}
                          className="px-3 py-2 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm font-medium text-gray-700 dark:text-gray-300 transition-all"
                          title="Sync last 7 days"
                        >
                          7d
                        </button>
                        <button
                          onClick={() => syncHistoricalData(device, 30)}
                          disabled={syncing === device.id}
                          className="px-3 py-2 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-sm font-medium text-gray-700 dark:text-gray-300 transition-all"
                          title="Sync last 30 days"
                        >
                          30d
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDisconnect(device.id)}
                      className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all"
                      title="Disconnect"
                    >
                      <Unplug className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Connect New Device Section */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Connect New Device</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Choose a wearable platform to link with your health profile
          </p>
        </div>

        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Fitbit Card */}
            <button
              onClick={handleConnectFitbit}
              className="group relative p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-700 hover:border-[#00B0B9] bg-white dark:bg-gray-800 hover:shadow-lg hover:shadow-[#00B0B9]/10 transition-all duration-300 text-left"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#00B0B9] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="white">
                  <path d="M12.5 5.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3-12a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3-9a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm9-6a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3-9a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Fitbit</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Sync steps, heart rate, sleep & more</p>
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5 text-[#00B0B9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </button>

            {/* Apple Watch Card */}
            <button
              onClick={handleConnectAppleWatch}
              className="group relative p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-700 hover:border-gray-900 dark:hover:border-gray-400 bg-white dark:bg-gray-800 hover:shadow-lg hover:shadow-gray-900/10 transition-all duration-300 text-left"
            >
              <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="white">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Apple Watch</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Connect via HealthKit integration</p>
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5 text-gray-900 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </button>

            {/* Google Fit Card */}
            <button
              onClick={handleConnectGoogleFit}
              className="group relative p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-700 hover:border-[#4285F4] bg-white dark:bg-gray-800 hover:shadow-lg hover:shadow-[#4285F4]/10 transition-all duration-300 text-left"
            >
              <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 dark:border-gray-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-9 h-9" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                  <path fill="#EA4335" d="M12 2v10l8.66 5c1.17-1.76 1.84-3.85 1.84-6 0-5.52-4.48-10-10-10z" />
                  <path fill="#FBBC05" d="M12 12l-8.66 5C4.51 19.24 7.99 22 12 22c4.01 0 7.49-2.76 8.66-5L12 12z" />
                  <path fill="#34A853" d="M2 12c0 2.15.67 4.24 1.84 6L12 12V2C6.48 2 2 6.48 2 12z" />
                  <circle fill="white" cx="12" cy="12" r="4" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Google Fit</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Import activity & wellness data</p>
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5 text-[#4285F4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
