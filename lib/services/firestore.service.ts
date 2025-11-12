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
}
