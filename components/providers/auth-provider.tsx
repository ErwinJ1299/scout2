'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';
import { AuthService } from '@/lib/services/auth.service';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setUserRole, setLoading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChange(async (user) => {
      setUser(user);
      if (user) {
        const role = await AuthService.getUserRole(user.uid);
        setUserRole(role);
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setUserRole, setLoading]);

  return <>{children}</>;
}
