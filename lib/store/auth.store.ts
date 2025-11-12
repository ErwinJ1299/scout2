import { create } from 'zustand';
import { User } from 'firebase/auth';
import { UserRole } from '@/types';

interface AuthState {
  user: User | null;
  userRole: UserRole | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setUserRole: (role: UserRole | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  userRole: null,
  loading: true,
  setUser: (user) => set({ user }),
  setUserRole: (userRole) => set({ userRole }),
  setLoading: (loading) => set({ loading }),
}));
