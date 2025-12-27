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

// Wellness Coins System Types
export interface UserStats {
  userId: string;
  totalPoints: number; // Health Points (HP)
  currentStreak: number;
  longestStreak: number;
  achievementsCount: number;
  rewardTokens?: number; // Wellness Coins (WC)
  totalTokensEarned?: number;
  totalTokensSpent?: number;
  lastConversionDate?: Date;
  hpConvertedToday?: number;
}

export interface WellnessTransaction {
  id: string;
  userId: string;
  type: 'credit' | 'debit';
  source: 'conversion' | 'reward_redeem' | 'admin_grant';
  hpUsed?: number;
  tokens: number;
  timestamp: Date;
  description?: string;
}

export interface WellnessReward {
  id: string;
  title: string;
  costTokens: number;
  category: 'Pharmacy' | 'Fitness' | 'Nutrition' | 'Services' | 'Premium';
  imageUrl?: string;
  description?: string;
  externalUrl?: string;
  stock?: number | null;
  active: boolean;
  terms?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface RewardRedemption {
  id: string;
  rewardId: string;
  userId: string;
  rewardTitle: string;
  rewardCategory?: string;
  costTokens: number;
  code: string; // Unique redemption code
  redeemedAt: Date | any;
  status: 'active' | 'used' | 'expired';
  expiresAt?: Date | any;
  externalUrl?: string | null;
}

// ==================== OUTCOME-BASED REWARDS ====================

export type MetricType = 'glucose' | 'bp' | 'steps' | 'weight';
export type ImprovementDirection = 'decrease' | 'increase' | 'range';

export interface OutcomeRule {
  id: string;
  metric: MetricType;
  description: string;
  windowDays: number; // Evaluation window (usually 7 or 14)
  minChange: number; // Minimum improvement threshold
  direction: ImprovementDirection;
  targetMin?: number; // Target range minimum (optional)
  targetMax?: number; // Target range maximum (optional)
  rewardHp: number; // Health Points reward
  rewardWc: number; // Wellness Coins reward
  cooldownDays: number; // Cannot reward twice within this period
  active: boolean;
  createdAt: Date | any;
}

export interface OutcomeReward {
  id: string;
  userId: string;
  metric: MetricType;
  ruleId: string; // Which rule triggered this reward
  periodStart: Date | any; // Evaluation window start
  periodEnd: Date | any; // Evaluation window end
  improvementValue: number; // Actual improvement (e.g., -15 mg/dL)
  currentAverage: number; // Current window average
  previousAverage: number; // Previous window average
  rewardHp: number;
  rewardWc: number;
  createdAt: Date | any;
}

export interface OutcomeEvaluationResult {
  ruleId: string;
  metric: MetricType;
  eligible: boolean;
  reason?: string;
  improvementValue?: number;
  rewardHp?: number;
  rewardWc?: number;
  currentAverage?: number;
  previousAverage?: number;
}

// ========== SMART MEDICINE ORDERING SYSTEM ==========

export interface MedicineOrder {
  id: string;
  userId: string;
  medicineName: string;
  source: "manual" | "clinical_note" | "prescription_ocr";
  partner: "pharmeasy" | "tata1mg" | "netmeds" | "apollo" | "other";
  redirectUrl: string;
  createdAt: string | Date;
  noteId?: string;
  prescriptionId?: string;
}

export interface PrescriptionUpload {
  id: string;
  userId: string;
  filePath?: string;
  extractedMedicines?: string[];
  createdAt: string | Date;
}

export interface Challenge {
  granted: OutcomeEvaluationResult[];
  checkedRules: number;
  message: string;
}

export interface DoctorPatientRequest {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorEmail: string;
  doctorSpecialization: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  status: 'pending' | 'accepted' | 'rejected';
  message?: string;
  createdAt: Date;
  respondedAt?: Date;
}

// HealthVerse Gamification Types
export type MetricType = 'steps' | 'hydration' | 'sleep' | 'custom';
export type ChallengeStatus = 'active' | 'completed';

export interface CommunityChallenge {
  id: string;
  createdBy: string; // doctorId
  title: string;
  description: string;
  metricType: MetricType;
  goalValue: number;
  startDate: Date;
  endDate: Date;
  participants: string[]; // patientIds
  createdAt: Date;
  status: ChallengeStatus;
}

export interface ChallengeProgress {
  id: string;
  challengeId: string;
  patientId: string;
  progressValue: number;
  updatedAt: Date;
  pointsEarned: number;
  rank: number;
  completed: boolean;
}

export interface RewardItem {
  id: string;
  name: string;
  brand: string;
  imageUrl: string;
  pointsRequired: number;
  available: boolean;
}

export interface ClaimedReward {
  rewardId: string;
  dateClaimed: Date;
  name: string;
  brand: string;
}

export interface RewardWallet {
  id: string;
  patientId: string;
  rewardsClaimed: ClaimedReward[];
  totalPointsSpent: number;
  currentPoints: number;
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

// ==================== MEDICAL SAFETY ANOMALY DETECTION ====================

/**
 * Severity levels for health anomalies
 * - NORMAL: All metrics within safe ranges
 * - WATCH: Metrics showing concerning patterns, notify doctor dashboard
 * - CRITICAL: Immediate danger, requires SMS/email notification
 */
export type AlertSeverity = 'NORMAL' | 'WATCH' | 'CRITICAL';

/**
 * Status of an alert in the system
 * - ACTIVE: Alert is new and requires attention
 * - REVIEWED: Doctor has acknowledged the alert
 * - RESOLVED: Alert has been addressed/resolved
 */
export type AlertStatus = 'ACTIVE' | 'REVIEWED' | 'RESOLVED';

/**
 * Source of health data for confidence scoring
 * - manual: Patient-entered data (lower confidence)
 * - wearable: From connected devices (medium confidence)
 * - clinical: From medical devices/tests (highest confidence)
 */
export type DataSource = 'manual' | 'wearable' | 'clinical' | 'iot';

/**
 * Types of metrics that can trigger anomalies
 */
export type AnomalyMetricType = 
  | 'heart_rate'
  | 'blood_pressure_systolic'
  | 'blood_pressure_diastolic'
  | 'glucose'
  | 'oxygen_saturation'
  | 'temperature'
  | 'steps'
  | 'weight';

/**
 * Rule-based threshold configuration for each metric
 */
export interface MetricThreshold {
  metric: AnomalyMetricType;
  criticalLow?: number;
  warningLow?: number;
  normalLow: number;
  normalHigh: number;
  warningHigh?: number;
  criticalHigh?: number;
  unit: string;
}

/**
 * Single metric reading with metadata for anomaly detection
 */
export interface MetricReading {
  metric: AnomalyMetricType;
  value: number;
  timestamp: Date;
  source: DataSource;
  deviceId?: string;
}

/**
 * Result of trend analysis for a specific metric
 */
export interface TrendAnalysis {
  metric: AnomalyMetricType;
  direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  slope: number;
  volatility: number;
  dataPoints: number;
  periodDays: number;
}

/**
 * Confidence score calculation result
 */
export interface ConfidenceScore {
  overall: number;           // 0-1 scale
  dataQuality: number;       // Based on source type
  dataRecency: number;       // Based on timestamp
  dataConsistency: number;   // Based on reading patterns
  factors: string[];         // Explanatory factors affecting score
}

/**
 * Individual anomaly detected by the engine
 */
export interface DetectedAnomaly {
  metric: AnomalyMetricType;
  currentValue: number;
  normalRange: { min: number; max: number };
  deviation: number;         // How far outside normal range
  type: 'threshold_breach' | 'trend_anomaly' | 'sudden_change';
  description: string;
}

/**
 * Complete result from the anomaly detection engine
 */
export interface AnomalyDetectionResult {
  patientId: string;
  timestamp: Date;
  severity: AlertSeverity;
  confidence: ConfidenceScore;
  anomalies: DetectedAnomaly[];
  trendAnalysis: TrendAnalysis[];
  rawReadings: MetricReading[];
  recentHistory: MetricReading[];
  recommendations: string[];
  requiresNotification: boolean;
}

/**
 * Health alert document stored in Firestore
 */
export interface HealthAlert {
  id: string;
  patientId: string;
  patientName?: string;
  doctorId?: string;
  
  // Alert classification
  severity: AlertSeverity;
  status: AlertStatus;
  
  // Detection details
  detectionResult: AnomalyDetectionResult;
  triggerMetric: AnomalyMetricType;
  triggerValue: number;
  
  // Timestamps
  createdAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  acknowledgedBy?: string;
  resolvedBy?: string;
  
  // Notes
  doctorNotes?: string;
  actionTaken?: string;
  
  // Notification tracking
  notificationSent: boolean;
  notificationType?: 'email' | 'sms' | 'both';
  notificationSentAt?: Date;
}

/**
 * Request payload for acknowledging an alert
 */
export interface AcknowledgeAlertRequest {
  alertId: string;
  doctorId: string;
  notes?: string;
  newStatus: 'REVIEWED' | 'RESOLVED';
  actionTaken?: string;
}

/**
 * SNS notification payload for critical alerts
 */
export interface CriticalAlertNotification {
  alertId: string;
  patientId: string;
  patientName: string;
  severity: AlertSeverity;
  triggerMetric: AnomalyMetricType;
  triggerValue: number;
  normalRange: { min: number; max: number };
  timestamp: string;
  recommendations: string[];
  dashboardUrl: string;
}

/**
 * Firestore version of HealthAlert with Timestamps
 */
export interface FirestoreHealthAlert extends Omit<HealthAlert, 'createdAt' | 'acknowledgedAt' | 'resolvedAt' | 'notificationSentAt' | 'detectionResult'> {
  createdAt: FirestoreTimestamp;
  acknowledgedAt?: FirestoreTimestamp;
  resolvedAt?: FirestoreTimestamp;
  notificationSentAt?: FirestoreTimestamp;
  detectionResult: Omit<AnomalyDetectionResult, 'timestamp' | 'rawReadings' | 'recentHistory'> & {
    timestamp: FirestoreTimestamp;
    rawReadings: Array<Omit<MetricReading, 'timestamp'> & { timestamp: FirestoreTimestamp }>;
    recentHistory: Array<Omit<MetricReading, 'timestamp'> & { timestamp: FirestoreTimestamp }>;
  };
}
