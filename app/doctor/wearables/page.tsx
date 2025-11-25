"use client";

import { DoctorPatientMetrics } from '@/components/doctor-patient-metrics';
import { Activity } from 'lucide-react';

export default function DoctorWearablesPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Patient Health Monitoring</h1>
          <p className="text-muted-foreground">
            Monitor your patients' wearable device data and health metrics
          </p>
        </div>
      </div>

      <DoctorPatientMetrics />
    </div>
  );
}
