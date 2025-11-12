'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';

export default function Home() {
  const router = useRouter();
  const { user, userRole, loading } = useAuthStore();
  const [firebaseConfigured, setFirebaseConfigured] = useState(true);

  useEffect(() => {
    // Check if Firebase is configured
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey || apiKey === 'your-api-key-here') {
      setFirebaseConfigured(false);
      router.push('/setup');
      return;
    }

    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (userRole === 'doctor') {
        router.push('/doctor/dashboard');
      } else if (userRole === 'patient') {
        router.push('/patient/dashboard');
      }
    }
  }, [user, userRole, loading, router]);

  if (!firebaseConfigured) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
