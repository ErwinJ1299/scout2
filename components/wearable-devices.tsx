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
    return <div className="flex items-center justify-center p-8">Loading devices...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Connected Wearable Devices</CardTitle>
              <CardDescription>
                Connect your wearable devices to automatically sync health data
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={autoSyncEnabled ? "default" : "outline"}>
                Auto-sync: {autoSyncEnabled ? 'ON' : 'OFF'}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
              >
                {autoSyncEnabled ? 'Disable' : 'Enable'} Auto-sync
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {devices.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No devices connected yet. Connect a device to start tracking your health.
            </p>
          ) : (
            <div className="grid gap-4">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    {getDeviceIcon(device.deviceType)}
                    <div>
                      <h3 className="font-medium">{device.deviceName}</h3>
                      <p className="text-sm text-muted-foreground">
                        Last synced: {device.lastSync ? new Date(device.lastSync).toLocaleString() : 'Never'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={device.connected ? 'default' : 'secondary'}>
                      {device.connected ? 'Connected' : 'Disconnected'}
                    </Badge>
                    {device.connected && device.accessToken && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSync(device)}
                          disabled={syncing === device.id}
                          title="Sync today's data"
                        >
                          {syncing === device.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => syncHistoricalData(device, 7)}
                          disabled={syncing === device.id}
                          title="Sync last 7 days"
                        >
                          7d
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => syncHistoricalData(device, 30)}
                          disabled={syncing === device.id}
                          title="Sync last 30 days"
                        >
                          30d
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDisconnect(device.id)}
                    >
                      <Unplug className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connect New Device</CardTitle>
          <CardDescription>
            Choose a wearable device to connect
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Button
            variant="outline"
            className="h-24 flex flex-col items-center justify-center gap-2"
            onClick={handleConnectFitbit}
          >
            <Activity className="h-8 w-8 text-blue-500" />
            <span>Connect Fitbit</span>
          </Button>
          
          <Button
            variant="outline"
            className="h-24 flex flex-col items-center justify-center gap-2"
            onClick={handleConnectAppleWatch}
          >
            <Watch className="h-8 w-8 text-gray-500" />
            <span>Connect Apple Watch</span>
          </Button>
          
          <Button
            variant="outline"
            className="h-24 flex flex-col items-center justify-center gap-2"
            onClick={handleConnectGoogleFit}
          >
            <Smartphone className="h-8 w-8 text-green-500" />
            <span>Connect Google Fit</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
