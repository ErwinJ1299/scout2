/**
 * One-time script to fix accepted requests that don't have proper bidirectional relationships
 * Run this in the browser console on the doctor dashboard
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  // Your Firebase config here
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixAcceptedRequests() {
  try {
    console.log('Starting to fix accepted requests...');
    
    // Get all accepted requests
    const q = query(
      collection(db, 'doctorPatientRequests'),
      where('status', '==', 'accepted')
    );
    
    const snapshot = await getDocs(q);
    console.log(`Found ${snapshot.docs.length} accepted requests`);
    
    for (const requestDoc of snapshot.docs) {
      const request = requestDoc.data();
      console.log('Processing request:', request);
      
      const { doctorId, patientId, id } = request;
      
      if (!doctorId || !patientId) {
        console.warn('Missing doctorId or patientId in request:', id);
        continue;
      }
      
      // Update patient with doctorId
      try {
        await updateDoc(doc(db, 'patients', patientId), {
          doctorId,
          updatedAt: serverTimestamp(),
        });
        console.log(`✓ Updated patient ${patientId}`);
      } catch (error) {
        console.error(`✗ Failed to update patient ${patientId}:`, error);
      }
      
      // Update doctor with patientId in assignedPatientIds array
      try {
        const doctorDoc = await getDoc(doc(db, 'doctors', doctorId));
        if (doctorDoc.exists()) {
          const doctorData = doctorDoc.data();
          const currentPatients = doctorData.assignedPatientIds || [];
          
          if (!currentPatients.includes(patientId)) {
            await updateDoc(doc(db, 'doctors', doctorId), {
              assignedPatientIds: [...currentPatients, patientId],
              updatedAt: serverTimestamp(),
            });
            console.log(`✓ Added patient ${patientId} to doctor ${doctorId}`);
          } else {
            console.log(`⊕ Patient ${patientId} already assigned to doctor ${doctorId}`);
          }
        } else {
          console.error(`✗ Doctor ${doctorId} not found`);
        }
      } catch (error) {
        console.error(`✗ Failed to update doctor ${doctorId}:`, error);
      }
    }
    
    console.log('✅ Finished fixing accepted requests!');
  } catch (error) {
    console.error('Error fixing accepted requests:', error);
  }
}

// Run the fix
fixAcceptedRequests();
