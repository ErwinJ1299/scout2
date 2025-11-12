import { Timestamp } from 'firebase/firestore';

export type UserRole = 'patient' | 'doctor';

export interface Patient {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  conditions: string[];
  points: number;
  streak: number;
  createdAt: Date;
  doctorId?: string;
  
  // ABDM Integration
  abhaNumber?: string;
  abhaAddress?: string;
  abhaLinked: boolean;
  
  // Personal Information
  gender?: 'Male' | 'Female' | 'Other';
  dateOfBirth?: Date;
  age?: number;
  
  // Target Goals
  targetBpSystolic?: number;
  targetBpDiastolic?: number;
  targetBpSystolicMin?: number;
  targetBpSystolicMax?: number;
  targetBpDiastolicMin?: number;
  targetBpDiastolicMax?: number;
  targetGlucoseMin?: number;
  targetGlucoseMax?: number;
  targetWeight?: number;
}

export interface Doctor {
  id: string;
  name: string;
  email: string;
  phone?: string;
  specialization: string;
  licenseNumber?: string;
  hospital?: string;
  assignedPatientIds: string[];
  createdAt: Date;
  updatedAt?: Date;
}

export interface Reading {
  id: string;
  patientId: string;
  glucose?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  steps?: number;
  heartRate?: number;
  weight?: number;
  createdAt: Date;
  source: 'manual' | 'iot' | 'wearable';
}

export interface Reminder {
  id: string;
  patientId: string;
  type: 'medicine' | 'exercise' | 'checkup' | 'meal' | 'water' | 'other';
  label: string;
  time: string;
  daysOfWeek: number[];
  isActive: boolean;
  createdAt: Date;
}

export interface ClinicalNote {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  note: string;
  recommendation?: string;
  diagnosis?: string;
  medications?: string[];
  followUpDate?: string;
  createdAt: Date;
  updatedAt?: Date;
  isPriority: boolean;
}

export interface TaskCompletion {
  id: string;
  patientId: string;
  reminderId: string;
  completedAt: Date;
  taskType: string;
  pointsAwarded: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  iconEmoji: string;
  pointsRequired: number;
}

export interface GamificationProgress {
  id: string;
  patientId: string;
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  earnedBadges: string[];
  lastTaskCompletedAt: Date;
  tasksCompletedToday: number;
  lastUpdated: Date;
}

// Firebase Firestore type helpers
export type FirestoreTimestamp = Timestamp | Date;

export interface FirestorePatient extends Omit<Patient, 'createdAt' | 'dateOfBirth'> {
  createdAt: FirestoreTimestamp;
  dateOfBirth?: FirestoreTimestamp;
}

export interface FirestoreReading extends Omit<Reading, 'createdAt'> {
  createdAt: FirestoreTimestamp;
}

export interface FirestoreReminder extends Omit<Reminder, 'createdAt'> {
  createdAt: FirestoreTimestamp;
}
