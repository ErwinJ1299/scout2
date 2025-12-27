import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  addDoc,
  arrayUnion,
  arrayRemove,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Patient,
  Reading,
  Reminder,
  GamificationProgress,
  TaskCompletion,
  FirestorePatient,
  FirestoreReading,
  FirestoreReminder,
  DoctorPatientRequest,
  Doctor,
  ClinicalNote,
  CommunityChallenge,
  ChallengeProgress,
  RewardItem,
  RewardWallet,
} from '@/types';

// Helper function to convert Firestore timestamp to Date
const timestampToDate = (timestamp: any): Date => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return new Date();
};

export class FirestoreService {
  // ==================== PATIENTS ====================
  
  static async savePatient(patient: Patient) {
    const patientData: any = {
      ...patient,
      createdAt: serverTimestamp(),
    };
    if (patient.dateOfBirth) {
      patientData.dateOfBirth = Timestamp.fromDate(patient.dateOfBirth);
    }
    await setDoc(doc(db, 'patients', patient.id), patientData);
  }

  static async getPatient(patientId: string): Promise<Patient | null> {
    const docSnap = await getDoc(doc(db, 'patients', patientId));
    if (docSnap.exists()) {
      const data = docSnap.data() as FirestorePatient;
      return {
        ...data,
        createdAt: timestampToDate(data.createdAt),
        dateOfBirth: data.dateOfBirth ? timestampToDate(data.dateOfBirth) : undefined,
      };
    }
    return null;
  }

  static subscribeToPatient(patientId: string, callback: (patient: Patient | null) => void) {
    return onSnapshot(doc(db, 'patients', patientId), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as FirestorePatient;
        callback({
          ...data,
          createdAt: timestampToDate(data.createdAt),
          dateOfBirth: data.dateOfBirth ? timestampToDate(data.dateOfBirth) : undefined,
        });
      } else {
        callback(null);
      }
    });
  }

  static async updatePatientGamification(patientId: string, points: number, streak: number) {
    await updateDoc(doc(db, 'patients', patientId), {
      points,
      streak,
    });
  }

  // ==================== REMINDERS ====================
  
  static async addReminder(reminder: Reminder) {
    const reminderData: any = {
      ...reminder,
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'reminders', reminder.id), reminderData);
  }

  static async updateReminder(reminder: Reminder) {
    const { id, ...reminderData } = reminder;
    await updateDoc(doc(db, 'reminders', id), reminderData);
  }

  static async deleteReminder(reminderId: string) {
    await deleteDoc(doc(db, 'reminders', reminderId));
  }

  static async getReminders(patientId: string): Promise<Reminder[]> {
    const q = query(
      collection(db, 'reminders'),
      where('patientId', '==', patientId),
      orderBy('time')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data() as FirestoreReminder;
      return {
        ...data,
        createdAt: timestampToDate(data.createdAt),
      };
    });
  }

  static subscribeToReminders(patientId: string, callback: (reminders: Reminder[]) => void) {
    const q = query(
      collection(db, 'reminders'),
      where('patientId', '==', patientId),
      orderBy('time')
    );
    return onSnapshot(q, (querySnapshot) => {
      const reminders = querySnapshot.docs.map((doc) => {
        const data = doc.data() as FirestoreReminder;
        return {
          ...data,
          createdAt: timestampToDate(data.createdAt),
        };
      });
      callback(reminders);
    });
  }

  // ==================== READINGS ====================
  
  /**
   * Add a new health reading and trigger anomaly detection
   * The anomaly detection runs asynchronously to not block the UI
   */
  static async addReading(reading: Reading) {
    const readingData: any = {
      ...reading,
      createdAt: serverTimestamp(),
    };
    const docRef = reading.id ? doc(db, 'readings', reading.id) : doc(collection(db, 'readings'));
    const readingWithId = {
      ...readingData,
      id: docRef.id,
    };
    await setDoc(docRef, readingWithId);
    
    // Trigger anomaly detection asynchronously (fire and forget)
    // This ensures the UI isn't blocked waiting for anomaly analysis
    FirestoreService.triggerAnomalyDetection(reading.patientId, docRef.id).catch(error => {
      console.error('[FirestoreService] Anomaly detection failed:', error);
      // Don't throw - reading was saved successfully
    });
  }
  
  /**
   * Trigger anomaly detection for a patient's reading
   * Called automatically after adding a reading, or manually for batch processing
   */
  static async triggerAnomalyDetection(patientId: string, readingId?: string): Promise<void> {
    try {
      const response = await fetch('/api/anomaly-detection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId,
          readingId,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.warn('[FirestoreService] Anomaly detection warning:', error);
      } else {
        const result = await response.json();
        console.log('[FirestoreService] Anomaly detection result:', result.severity, 
          result.anomaliesDetected > 0 ? `(${result.anomaliesDetected} anomalies)` : '(no anomalies)');
      }
    } catch (error) {
      // Log but don't throw - anomaly detection is supplementary
      console.error('[FirestoreService] Anomaly detection error:', error);
    }
  }


  static async getReadings(patientId: string, limitCount = 30): Promise<Reading[]> {
    const q = query(
      collection(db, 'readings'),
      where('patientId', '==', patientId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data() as FirestoreReading;
      return {
        ...data,
        createdAt: timestampToDate(data.createdAt),
      };
    });
  }

  static subscribeToReadings(
    patientId: string,
    callback: (readings: Reading[]) => void,
    limitCount = 30
  ) {
    const q = query(
      collection(db, 'readings'),
      where('patientId', '==', patientId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    return onSnapshot(q, (querySnapshot) => {
      const readings = querySnapshot.docs.map((doc) => {
        const data = doc.data() as FirestoreReading;
        return {
          ...data,
          createdAt: timestampToDate(data.createdAt),
        };
      });
      callback(readings);
    });
  }

  static async getLatestReading(patientId: string): Promise<Reading | null> {
    const q = query(
      collection(db, 'readings'),
      where('patientId', '==', patientId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const data = querySnapshot.docs[0].data() as FirestoreReading;
      return {
        ...data,
        createdAt: timestampToDate(data.createdAt),
      };
    }
    return null;
  }

  // ==================== GAMIFICATION ====================
  
  static async saveGamificationProgress(progress: GamificationProgress) {
    const progressData: any = {
      ...progress,
      lastTaskCompletedAt: Timestamp.fromDate(progress.lastTaskCompletedAt),
      lastUpdated: serverTimestamp(),
    };
    await setDoc(doc(db, 'gamification', progress.id), progressData);
  }

  static async getGamificationProgress(patientId: string): Promise<GamificationProgress | null> {
    const docSnap = await getDoc(doc(db, 'gamification', patientId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ...data,
        lastTaskCompletedAt: timestampToDate(data.lastTaskCompletedAt),
        lastUpdated: timestampToDate(data.lastUpdated),
      } as GamificationProgress;
    }
    return null;
  }

  static subscribeToGamificationProgress(
    patientId: string,
    callback: (progress: GamificationProgress | null) => void
  ) {
    return onSnapshot(doc(db, 'gamification', patientId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        callback({
          ...data,
          lastTaskCompletedAt: timestampToDate(data.lastTaskCompletedAt),
          lastUpdated: timestampToDate(data.lastUpdated),
        } as GamificationProgress);
      } else {
        callback(null);
      }
    });
  }

  // ==================== TASK COMPLETIONS ====================
  
  static async addTaskCompletion(completion: TaskCompletion) {
    const completionData: any = {
      ...completion,
      completedAt: serverTimestamp(),
    };
    const docRef = doc(collection(db, 'taskCompletions'));
    await setDoc(docRef, { ...completionData, id: docRef.id });
  }

  static async getCompletedTaskIds(patientId: string, date: Date): Promise<string[]> {
    const dateStr = date.toISOString().split('T')[0];
    const q = query(
      collection(db, 'taskCompletions'),
      where('patientId', '==', patientId),
      where('completionDate', '==', dateStr)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => doc.data().reminderId);
  }

  // ==================== DOCTORS ====================
  
  static async saveDoctor(doctor: Doctor) {
    const doctorData: any = {
      ...doctor,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'doctors', doctor.id), doctorData);
  }

  static async getDoctor(doctorId: string): Promise<Doctor | null> {
    const docSnap = await getDoc(doc(db, 'doctors', doctorId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: timestampToDate(data.createdAt),
        updatedAt: data.updatedAt ? timestampToDate(data.updatedAt) : undefined,
      } as Doctor;
    }
    return null;
  }

  static subscribeToDoctor(doctorId: string, callback: (doctor: Doctor | null) => void) {
    return onSnapshot(doc(db, 'doctors', doctorId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        callback({
          id: doc.id,
          ...data,
          createdAt: timestampToDate(data.createdAt),
          updatedAt: data.updatedAt ? timestampToDate(data.updatedAt) : undefined,
        } as Doctor);
      } else {
        callback(null);
      }
    });
  }

  static async getAllPatients(): Promise<Patient[]> {
    const querySnapshot = await getDocs(collection(db, 'patients'));
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        createdAt: timestampToDate(data.createdAt),
        dateOfBirth: data.dateOfBirth ? timestampToDate(data.dateOfBirth) : undefined,
      } as Patient;
    });
  }

  // ==================== DOCTOR-PATIENT REQUESTS ====================
  
  static async createDoctorPatientRequest(request: Omit<DoctorPatientRequest, 'id' | 'createdAt'>) {
    // Check for existing requests between this doctor and patient
    const q = query(
      collection(db, 'doctorPatientRequests'),
      where('doctorId', '==', request.doctorId),
      where('patientId', '==', request.patientId)
    );
    
    const existingRequests = await getDocs(q);
    
    // Prevent duplicate requests if there's already a pending or accepted request
    if (!existingRequests.empty) {
      const hasActiveRequest = existingRequests.docs.some(
        doc => doc.data().status === 'pending' || doc.data().status === 'accepted'
      );
      if (hasActiveRequest) {
        throw new Error('A request already exists for this patient');
      }
    }
    
    const requestData: any = {
      ...request,
      createdAt: serverTimestamp(),
      status: 'pending',
    };
    const docRef = doc(collection(db, 'doctorPatientRequests'));
    await setDoc(docRef, { ...requestData, id: docRef.id });
    return docRef.id;
  }

  static async updateRequestStatus(
    requestId: string,
    status: 'accepted' | 'rejected',
    patientId?: string,
    doctorId?: string
  ) {
    try {
      // Update request status
      await updateDoc(doc(db, 'doctorPatientRequests', requestId), {
        status,
        respondedAt: serverTimestamp(),
      });

      // If accepted, update patient with doctorId and doctor with patientId
      if (status === 'accepted' && patientId && doctorId) {
        console.log('Updating patient and doctor relationship...', { patientId, doctorId });
        
        // Update patient with doctorId
        await updateDoc(doc(db, 'patients', patientId), {
          doctorId,
          updatedAt: serverTimestamp(),
        });
        console.log('Patient updated successfully');

        // Update doctor with patientId in assignedPatientIds array
        const doctorDoc = await getDoc(doc(db, 'doctors', doctorId));
        console.log('Doctor document exists:', doctorDoc.exists());
        if (doctorDoc.exists()) {
          const doctorData = doctorDoc.data();
          console.log('Current doctor data:', doctorData);
          const currentPatients = doctorData.assignedPatientIds || [];
          console.log('Current assigned patients:', currentPatients);
          
          if (!currentPatients.includes(patientId)) {
            const updatedPatients = [...currentPatients, patientId];
            console.log('Updating doctor with patients:', updatedPatients);
            await updateDoc(doc(db, 'doctors', doctorId), {
              assignedPatientIds: updatedPatients,
              updatedAt: serverTimestamp(),
            });
            console.log('Doctor updated successfully with new patient');
            
            // Verify the update
            const verifyDoc = await getDoc(doc(db, 'doctors', doctorId));
            console.log('Verified doctor data after update:', verifyDoc.data());
          } else {
            console.log('Patient already in doctor\'s assigned list');
          }
        } else {
          console.error('Doctor document not found:', doctorId);
        }
      }
    } catch (error) {
      console.error('Error updating request status:', error);
      throw error;
    }
  }

  static subscribeToPatientRequests(
    patientId: string,
    callback: (requests: DoctorPatientRequest[]) => void
  ) {
    const q = query(
      collection(db, 'doctorPatientRequests'),
      where('patientId', '==', patientId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(q, (querySnapshot) => {
      const requests = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          createdAt: timestampToDate(data.createdAt),
          respondedAt: data.respondedAt ? timestampToDate(data.respondedAt) : undefined,
        } as DoctorPatientRequest;
      });
      callback(requests);
    });
  }

  static subscribeToDoctorRequests(
    doctorId: string,
    callback: (requests: DoctorPatientRequest[]) => void
  ) {
    const q = query(
      collection(db, 'doctorPatientRequests'),
      where('doctorId', '==', doctorId),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(q, (querySnapshot) => {
      const requests = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          createdAt: timestampToDate(data.createdAt),
          respondedAt: data.respondedAt ? timestampToDate(data.respondedAt) : undefined,
        } as DoctorPatientRequest;
      });
      callback(requests);
    });
  }

  static async getAssignedPatients(patientIds: string[]): Promise<Patient[]> {
    if (patientIds.length === 0) return [];
    
    const patients: Patient[] = [];
    for (const id of patientIds) {
      const patient = await this.getPatient(id);
      if (patient) patients.push(patient);
    }
    return patients;
  }

  // Clinical Notes Methods
  static async addClinicalNote(noteData: {
    patientId: string;
    doctorId: string;
    doctorName: string;
    note: string;
    recommendation?: string;
    diagnosis?: string;
    medications?: string[];
    followUpDate?: string;
    isPriority: boolean;
  }) {
    const docRef = await addDoc(collection(db, 'clinicalNotes'), {
      ...noteData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  static subscribeToClinicalNotes(
    patientId: string,
    callback: (notes: ClinicalNote[]) => void
  ) {
    const q = query(
      collection(db, 'clinicalNotes'),
      where('patientId', '==', patientId),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(q, (querySnapshot) => {
      const notes = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: timestampToDate(data.createdAt),
          updatedAt: data.updatedAt ? timestampToDate(data.updatedAt) : undefined,
        } as ClinicalNote;
      });
      callback(notes);
    });
  }

  static async getClinicalNotes(patientId: string): Promise<ClinicalNote[]> {
    const q = query(
      collection(db, 'clinicalNotes'),
      where('patientId', '==', patientId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: timestampToDate(data.createdAt),
        updatedAt: data.updatedAt ? timestampToDate(data.updatedAt) : undefined,
      } as ClinicalNote;
    });
  }

  static async deleteClinicalNote(noteId: string) {
    await deleteDoc(doc(db, 'clinicalNotes', noteId));
  }

  // ==================== COMMUNITY CHALLENGES ====================
  
  static async createChallenge(challenge: Omit<CommunityChallenge, 'id' | 'createdAt'>) {
    const challengeData = {
      ...challenge,
      startDate: Timestamp.fromDate(challenge.startDate),
      endDate: Timestamp.fromDate(challenge.endDate),
      createdAt: serverTimestamp(),
    };
    const docRef = await addDoc(collection(db, 'communityChallenges'), challengeData);
    return docRef.id;
  }

  static async getChallenges(status?: 'active' | 'completed'): Promise<CommunityChallenge[]> {
    let q = query(collection(db, 'communityChallenges'), orderBy('createdAt', 'desc'));
    
    if (status) {
      q = query(collection(db, 'communityChallenges'), where('status', '==', status), orderBy('createdAt', 'desc'));
    }
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        startDate: timestampToDate(data.startDate),
        endDate: timestampToDate(data.endDate),
        createdAt: timestampToDate(data.createdAt),
      } as CommunityChallenge;
    });
  }

  static subscribeToChallenges(status: 'active' | 'completed' | 'all', callback: (challenges: CommunityChallenge[]) => void) {
    let q = query(collection(db, 'communityChallenges'), orderBy('createdAt', 'desc'));
    
    if (status !== 'all') {
      q = query(collection(db, 'communityChallenges'), where('status', '==', status), orderBy('createdAt', 'desc'));
    }

    return onSnapshot(q, (snapshot) => {
      const challenges = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startDate: timestampToDate(data.startDate),
          endDate: timestampToDate(data.endDate),
          createdAt: timestampToDate(data.createdAt),
        } as CommunityChallenge;
      });
      callback(challenges);
    });
  }

  static async getChallenge(challengeId: string): Promise<CommunityChallenge | null> {
    const docSnap = await getDoc(doc(db, 'communityChallenges', challengeId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        startDate: timestampToDate(data.startDate),
        endDate: timestampToDate(data.endDate),
        createdAt: timestampToDate(data.createdAt),
      } as CommunityChallenge;
    }
    return null;
  }

  static async joinChallenge(challengeId: string, patientId: string) {
    // Add patient to challenge participants
    await updateDoc(doc(db, 'communityChallenges', challengeId), {
      participants: arrayUnion(patientId),
    });

    // Create challenge progress document
    const progressData = {
      challengeId,
      patientId,
      progressValue: 0,
      updatedAt: serverTimestamp(),
      pointsEarned: 0,
      rank: 0,
      completed: false,
    };
    await addDoc(collection(db, 'challengeProgress'), progressData);
  }

  static async leaveChallenge(challengeId: string, patientId: string) {
    // Remove patient from challenge participants
    await updateDoc(doc(db, 'communityChallenges', challengeId), {
      participants: arrayRemove(patientId),
    });

    // Delete challenge progress
    const q = query(
      collection(db, 'challengeProgress'),
      where('challengeId', '==', challengeId),
      where('patientId', '==', patientId)
    );
    const snapshot = await getDocs(q);
    snapshot.forEach(async (doc) => {
      await deleteDoc(doc.ref);
    });
  }

  static async updateChallengeProgress(challengeId: string, patientId: string, progressValue: number) {
    const q = query(
      collection(db, 'challengeProgress'),
      where('challengeId', '==', challengeId),
      where('patientId', '==', patientId)
    );
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const progressDoc = snapshot.docs[0];
      const challenge = await this.getChallenge(challengeId);
      
      if (challenge) {
        const completed = progressValue >= challenge.goalValue;
        const pointsEarned = Math.floor((progressValue / challenge.goalValue) * 100) + (completed ? 50 : 0);
        
        await updateDoc(progressDoc.ref, {
          progressValue,
          updatedAt: serverTimestamp(),
          pointsEarned,
          completed,
        });

        // Update patient's total points
        if (completed) {
          const patient = await this.getPatient(patientId);
          if (patient) {
            await this.updatePatientGamification(patientId, patient.points + pointsEarned, patient.streak);
          }
        }
      }
    }
  }

  static subscribeToChallengeProgress(challengeId: string, callback: (progress: ChallengeProgress[]) => void) {
    const q = query(
      collection(db, 'challengeProgress'),
      where('challengeId', '==', challengeId),
      orderBy('pointsEarned', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const progress = snapshot.docs.map((doc, index) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          rank: index + 1,
          updatedAt: timestampToDate(data.updatedAt),
        } as ChallengeProgress;
      });
      callback(progress);
    });
  }

  static async getPatientChallengeProgress(patientId: string): Promise<ChallengeProgress[]> {
    const q = query(
      collection(db, 'challengeProgress'),
      where('patientId', '==', patientId),
      orderBy('updatedAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        updatedAt: timestampToDate(data.updatedAt),
      } as ChallengeProgress;
    });
  }

  static async updateChallenge(challengeId: string, updates: Partial<CommunityChallenge>) {
    const updateData: any = { ...updates };
    if (updates.startDate) {
      updateData.startDate = Timestamp.fromDate(updates.startDate);
    }
    if (updates.endDate) {
      updateData.endDate = Timestamp.fromDate(updates.endDate);
    }
    await updateDoc(doc(db, 'communityChallenges', challengeId), updateData);
  }

  static async deleteChallenge(challengeId: string) {
    // Delete challenge progress entries
    const q = query(collection(db, 'challengeProgress'), where('challengeId', '==', challengeId));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    // Delete challenge
    batch.delete(doc(db, 'communityChallenges', challengeId));
    await batch.commit();
  }

  // ==================== REWARD MARKETPLACE ====================
  
  static async getRewards(): Promise<RewardItem[]> {
    const q = query(collection(db, 'rewardMarketplace'), where('available', '==', true));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as RewardItem));
  }

  static subscribeToRewards(callback: (rewards: RewardItem[]) => void) {
    const q = query(collection(db, 'rewardMarketplace'), where('available', '==', true));
    return onSnapshot(q, (snapshot) => {
      const rewards = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as RewardItem));
      callback(rewards);
    });
  }

  static async createReward(reward: Omit<RewardItem, 'id'>) {
    const docRef = await addDoc(collection(db, 'rewardMarketplace'), reward);
    return docRef.id;
  }

  // ==================== REWARD WALLET ====================
  
  static async getOrCreateWallet(patientId: string): Promise<RewardWallet> {
    const docSnap = await getDoc(doc(db, 'rewardWallet', patientId));
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        patientId,
        rewardsClaimed: data.rewardsClaimed.map((r: any) => ({
          ...r,
          dateClaimed: timestampToDate(r.dateClaimed),
        })),
        totalPointsSpent: data.totalPointsSpent,
        currentPoints: data.currentPoints,
      } as RewardWallet;
    }

    // Create new wallet
    const newWallet: Omit<RewardWallet, 'id'> = {
      patientId,
      rewardsClaimed: [],
      totalPointsSpent: 0,
      currentPoints: 0,
    };
    await setDoc(doc(db, 'rewardWallet', patientId), newWallet);
    return { id: patientId, ...newWallet };
  }

  static subscribeToWallet(patientId: string, callback: (wallet: RewardWallet) => void) {
    return onSnapshot(doc(db, 'rewardWallet', patientId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        callback({
          id: doc.id,
          patientId,
          rewardsClaimed: data.rewardsClaimed.map((r: any) => ({
            ...r,
            dateClaimed: timestampToDate(r.dateClaimed),
          })),
          totalPointsSpent: data.totalPointsSpent,
          currentPoints: data.currentPoints,
        } as RewardWallet);
      }
    });
  }

  static async redeemReward(patientId: string, reward: RewardItem) {
    const patient = await this.getPatient(patientId);
    if (!patient || patient.points < reward.pointsRequired) {
      throw new Error('Insufficient points');
    }

    const wallet = await this.getOrCreateWallet(patientId);
    
    const claimedReward = {
      rewardId: reward.id,
      dateClaimed: new Date(),
      name: reward.name,
      brand: reward.brand,
    };

    // Update wallet
    await updateDoc(doc(db, 'rewardWallet', patientId), {
      rewardsClaimed: arrayUnion({
        ...claimedReward,
        dateClaimed: Timestamp.fromDate(claimedReward.dateClaimed),
      }),
      totalPointsSpent: wallet.totalPointsSpent + reward.pointsRequired,
      currentPoints: wallet.currentPoints,
    });

    // Deduct points from patient
    await this.updatePatientGamification(
      patientId,
      patient.points - reward.pointsRequired,
      patient.streak
    );
  }

  static async syncWalletPoints(patientId: string) {
    const patient = await this.getPatient(patientId);
    if (patient) {
      await updateDoc(doc(db, 'rewardWallet', patientId), {
        currentPoints: patient.points,
      });
    }
  }

  // Close a challenge (mark as completed)
  static async closeChallenge(challengeId: string) {
    const challengeRef = doc(db, 'communityChallenges', challengeId);
    await updateDoc(challengeRef, {
      status: 'completed',
      updatedAt: serverTimestamp(),
    });
  }
}

