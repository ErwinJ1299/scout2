'use client';

import { useState } from 'react';
import { FirestoreService } from '@/lib/services/firestore.service';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface FixAcceptedRequestsButtonProps {
  doctorId: string;
}

export function FixAcceptedRequestsButton({ doctorId }: FixAcceptedRequestsButtonProps) {
  const [fixing, setFixing] = useState(false);
  const [result, setResult] = useState<string>('');

  const fixAcceptedRequests = async () => {
    setFixing(true);
    setResult('');
    
    try {
      console.log('Starting to fix accepted requests...');
      
      // Get this doctor's accepted requests
      const q = query(
        collection(db, 'doctorPatientRequests'),
        where('doctorId', '==', doctorId),
        where('status', '==', 'accepted')
      );
      
      const snapshot = await getDocs(q);
      console.log(`Found ${snapshot.docs.length} accepted requests`);
      
      let fixed = 0;
      let skipped = 0;
      let errors = 0;
      
      for (const requestDoc of snapshot.docs) {
        const request = requestDoc.data();
        const { doctorId, patientId } = request;
        
        if (!doctorId || !patientId) {
          console.warn('Missing doctorId or patientId in request:', request.id);
          skipped++;
          continue;
        }
        
        try {
          // Use the existing updateRequestStatus method by re-accepting
          await FirestoreService.updateRequestStatus(
            requestDoc.id,
            'accepted',
            patientId,
            doctorId
          );
          fixed++;
          console.log(`✓ Fixed relationship for patient ${patientId} and doctor ${doctorId}`);
        } catch (error) {
          console.error(`✗ Failed to fix relationship:`, error);
          errors++;
        }
      }
      
      setResult(`Fixed: ${fixed} | Skipped: ${skipped} | Errors: ${errors}`);
      alert('Accepted requests have been fixed! Please refresh the page.');
    } catch (error) {
      console.error('Error fixing accepted requests:', error);
      setResult('Error occurred. Check console for details.');
    } finally {
      setFixing(false);
    }
  };

  return (
    <Card className="border-red-200 bg-red-50/50">
      <CardHeader>
        <CardTitle className="text-sm">Fix Existing Accepted Requests</CardTitle>
        <CardDescription className="text-xs">
          If you have accepted requests but patients don't appear in "Assigned Patients", click this button to fix the relationships.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={fixAcceptedRequests} 
          disabled={fixing}
          variant="destructive"
          size="sm"
        >
          {fixing ? 'Fixing...' : 'Fix Accepted Requests'}
        </Button>
        {result && (
          <p className="text-xs mt-2 text-gray-700">{result}</p>
        )}
      </CardContent>
    </Card>
  );
}
