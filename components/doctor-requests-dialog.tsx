'use client';

import { useEffect, useState } from 'react';
import { FirestoreService } from '@/lib/services/firestore.service';
import { DoctorPatientRequest } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Check, X, Stethoscope, Mail, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface DoctorRequestsDialogProps {
  patientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DoctorRequestsDialog({ patientId, open, onOpenChange }: DoctorRequestsDialogProps) {
  const [requests, setRequests] = useState<DoctorPatientRequest[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!patientId || !open) return;

    const unsubscribe = FirestoreService.subscribeToPatientRequests(patientId, setRequests);

    return () => unsubscribe();
  }, [patientId, open]);

  const handleAccept = async (request: DoctorPatientRequest) => {
    setLoading(true);
    try {
      console.log('Accepting request:', request);
      await FirestoreService.updateRequestStatus(
        request.id,
        'accepted',
        request.patientId,
        request.doctorId
      );
      console.log('Request accepted successfully');
    } catch (error) {
      console.error('Error accepting request:', error);
      alert('Failed to accept request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (request: DoctorPatientRequest) => {
    setLoading(true);
    try {
      await FirestoreService.updateRequestStatus(
        request.id,
        'rejected',
        request.patientId,
        request.doctorId
      );
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Failed to reject request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const respondedRequests = requests.filter((r) => r.status !== 'pending');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Doctor Connection Requests
          </DialogTitle>
          <DialogDescription>
            Review and respond to doctor requests to access your health data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-gray-700">Pending Requests</h3>
              {pendingRequests.map((request) => (
                <Card key={request.id} className="border-orange-200 bg-orange-50/50">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h4 className="font-semibold text-lg">{request.doctorName}</h4>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Stethoscope className="h-4 w-4" />
                            <span>{request.doctorSpecialization}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="h-4 w-4" />
                            <span>{request.doctorEmail}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Calendar className="h-4 w-4" />
                            <span>Sent: {format(request.createdAt, 'MMM d, yyyy h:mm a')}</span>
                          </div>
                        </div>
                        <Badge variant="secondary">Pending</Badge>
                      </div>

                      {request.message && (
                        <div className="p-3 bg-white rounded-lg border">
                          <p className="text-sm text-gray-700 italic">"{request.message}"</p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleAccept(request)}
                          disabled={loading}
                          className="flex-1"
                          variant="default"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Accept
                        </Button>
                        <Button
                          onClick={() => handleReject(request)}
                          disabled={loading}
                          className="flex-1"
                          variant="outline"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Responded Requests */}
          {respondedRequests.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-gray-700">Previous Responses</h3>
              {respondedRequests.map((request) => (
                <Card key={request.id} className="border-gray-200">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h4 className="font-medium">{request.doctorName}</h4>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Stethoscope className="h-4 w-4" />
                          <span>{request.doctorSpecialization}</span>
                        </div>
                        {request.respondedAt && (
                          <p className="text-xs text-gray-500">
                            {request.status === 'accepted' ? 'Accepted' : 'Declined'} on{' '}
                            {format(request.respondedAt, 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={request.status === 'accepted' ? 'default' : 'destructive'}
                      >
                        {request.status === 'accepted' && <Check className="h-3 w-3 mr-1" />}
                        {request.status === 'rejected' && <X className="h-3 w-3 mr-1" />}
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {requests.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <UserPlus className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>No doctor requests yet</p>
              <p className="text-sm">Doctors can send you requests to access your health data</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
