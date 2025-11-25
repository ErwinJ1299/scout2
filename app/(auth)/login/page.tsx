'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/lib/services/auth.service';
import { FirestoreService } from '@/lib/services/firestore.service';
import { UserRole, Patient, Doctor } from '@/types';
import { LoginForm } from '@/components/login-form';

export default function AuthPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [specialization, setSpecialization] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isSignUp) {
        // Register new user
        const user = await AuthService.register(email, password, name, role);
        
        if (role === 'doctor') {
          // Create doctor profile
          const doctor: Doctor = {
            id: user.uid,
            name,
            email,
            specialization: specialization || 'General Physician',
            assignedPatientIds: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          await FirestoreService.saveDoctor(doctor);
          router.push('/doctor/dashboard');
        } else {
          // Create patient profile
          const patient: Patient = {
            id: user.uid,
            name,
            email,
            role: 'patient',
            conditions: [],
            points: 0,
            streak: 0,
            createdAt: new Date(),
            abhaLinked: false,
          };
          await FirestoreService.savePatient(patient);
          
          // Initialize gamification progress
          await FirestoreService.saveGamificationProgress({
            id: user.uid,
            patientId: user.uid,
            totalPoints: 0,
            currentStreak: 0,
            longestStreak: 0,
            earnedBadges: [],
            lastTaskCompletedAt: new Date(),
            tasksCompletedToday: 0,
            lastUpdated: new Date(),
          });
          
          router.push('/patient/dashboard');
        }
      } else {
        // Sign in existing user
        await AuthService.signIn(email, password);
        const user = AuthService.getCurrentUser();
        if (user) {
          const userRole = await AuthService.getUserRole(user.uid);
          router.push(userRole === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setEmail('');
    setPassword('');
    setName('');
    setRole('patient');
    setSpecialization('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-4">
      <LoginForm
        email={email}
        password={password}
        name={name}
        role={role}
        specialization={specialization}
        isLoading={isLoading}
        error={error}
        isSignUp={isSignUp}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onNameChange={setName}
        onRoleChange={setRole}
        onSpecializationChange={setSpecialization}
        onSubmit={handleSubmit}
        onToggleMode={handleToggleMode}
      />
    </div>
  );
}
