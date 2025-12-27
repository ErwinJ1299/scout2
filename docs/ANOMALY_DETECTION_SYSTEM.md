# Medical Safety Anomaly Detection System

An event-driven health monitoring system that automatically detects anomalies in patient vital signs and triggers appropriate alerts.

## Overview

This system adds an automated anomaly detection layer to the existing health monitoring application. When new health data is written to Firestore, it triggers a background evaluation that:

1. **Analyzes readings** through a three-layer detection engine
2. **Classifies severity** as NORMAL, WATCH, or CRITICAL
3. **Creates alerts** in Firestore for doctor dashboards
4. **Sends notifications** via AWS SNS for critical alerts

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Patient adds   │────▶│  Firestore       │────▶│  Anomaly        │
│  health reading │     │  (readings)      │     │  Detection API  │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌─────────────────────────────────┼─────────────────┐
                        │                                 │                 │
                        ▼                                 ▼                 ▼
                ┌───────────────┐              ┌─────────────────┐  ┌──────────────┐
                │ Rule-based    │              │ Trend-based     │  │ Confidence   │
                │ Thresholds    │              │ Detection       │  │ Scoring      │
                └───────────────┘              └─────────────────┘  └──────────────┘
                        │                                 │                 │
                        └─────────────────────────────────┼─────────────────┘
                                                          │
                                                          ▼
                                               ┌─────────────────┐
                                               │   Severity      │
                                               │   Classification│
                                               └────────┬────────┘
                                                        │
                        ┌───────────────────────────────┼───────────────────────────────┐
                        │                               │                               │
                        ▼                               ▼                               ▼
                ┌───────────────┐              ┌─────────────────┐              ┌──────────────┐
                │   NORMAL      │              │     WATCH       │              │   CRITICAL   │
                │   No action   │              │   Firestore     │              │   Firestore  │
                └───────────────┘              │   Alert created │              │   + SNS      │
                                               └─────────────────┘              │   Notification│
                                                                                └──────────────┘
```

## Components

### 1. Anomaly Detection Service
**Location:** `lib/services/anomaly-detection.service.ts`

Three-layer detection engine:

- **Rule-based Thresholds:** Clinical safety limits for vital signs
- **Trend Detection:** Linear regression analysis for patterns
- **Confidence Scoring:** Data quality assessment

### 2. Alert Service
**Location:** `lib/services/alert.service.ts`

Manages Firestore alert documents:
- Create alerts from detection results
- Fetch alerts by patient/doctor
- Acknowledge/resolve alerts
- Track statistics

### 3. Notification Service
**Location:** `lib/services/notification.service.ts`

Handles AWS SNS notifications:
- Email notifications via SNS topics
- SMS alerts for critical conditions
- Webhook support for integrations

### 4. AWS Lambda Handler
**Location:** `aws-lambda/anomaly-detector/handler.ts`

Standalone Lambda function for serverless deployment:
- Can be triggered by EventBridge/Firestore events
- Self-contained detection logic
- Direct SNS integration

### 5. API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/anomaly-detection` | POST | Trigger detection for a patient |
| `/api/anomaly-detection` | GET | Check service status |
| `/api/alerts` | GET | Fetch alerts (filter by patient/doctor/status) |
| `/api/alerts` | PATCH | Acknowledge an alert |
| `/api/alerts` | POST | Bulk acknowledge / get stats |

### 6. Dashboard Component
**Location:** `components/health-alerts-dashboard.tsx`

React component for doctors:
- Real-time alert updates
- Severity filtering
- Alert acknowledgement
- Statistics overview

## Clinical Thresholds

| Metric | Critical Low | Warning Low | Normal Range | Warning High | Critical High |
|--------|-------------|-------------|--------------|--------------|---------------|
| Heart Rate | 40 bpm | 50 bpm | 60-100 bpm | 110 bpm | 130 bpm |
| BP Systolic | 80 mmHg | 90 mmHg | 90-120 mmHg | 140 mmHg | 180 mmHg |
| BP Diastolic | 50 mmHg | 60 mmHg | 60-80 mmHg | 90 mmHg | 120 mmHg |
| Glucose | 54 mg/dL | 70 mg/dL | 70-140 mg/dL | 180 mg/dL | 250 mg/dL |
| O2 Saturation | 88% | 92% | 95-100% | - | - |

## Alert Severity Levels

### NORMAL
- All metrics within safe ranges
- No anomalies detected
- No action required

### WATCH
- Metrics outside normal but not critical
- Or concerning trend patterns detected
- Alert created in Firestore
- Appears on doctor dashboard

### CRITICAL
- Metrics at dangerous levels
- Immediate attention required
- Alert created in Firestore
- SNS notification sent (email + SMS)

## Confidence Scoring

The system calculates confidence based on:

| Factor | Weight | Description |
|--------|--------|-------------|
| Data Quality | 40% | Source reliability (clinical > IoT > wearable > manual) |
| Data Recency | 35% | Time since last reading |
| Data Consistency | 25% | Frequency of readings over time |

**Note:** Critical alerts are only suppressed if confidence is extremely low (<30%) AND data quality is poor (<40%).

## Setup Instructions

### 1. Environment Variables

Add to `.env.local`:

```env
# AWS SNS Configuration (for notifications)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
SNS_TOPIC_ARN=arn:aws:sns:region:account:topic-name
SNS_SMS_SENDER_ID=HEALTHALERT

# App URL (for notification links)
NEXT_PUBLIC_APP_URL=https://yourapp.com
```

### 2. AWS SNS Setup

1. Create an SNS topic in AWS Console
2. Add email subscriptions for doctors
3. Configure SMS settings if needed
4. Copy Topic ARN to environment variables

### 3. Firestore Indexes

Create composite indexes for efficient queries:

```
Collection: healthAlerts
Fields: patientId ASC, createdAt DESC
Fields: doctorId ASC, status ASC, createdAt DESC
Fields: severity ASC, status ASC, createdAt DESC
```

### 4. AWS Lambda Deployment (Optional)

For event-driven processing:

```bash
cd aws-lambda/anomaly-detector
npm install
npm run build
npm run package
npm run deploy
```

Configure Lambda environment variables:
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY
- SNS_TOPIC_ARN

## Usage

### Automatic Detection

When a patient adds a reading via the app, anomaly detection runs automatically:

```typescript
// In FirestoreService.addReading()
await FirestoreService.triggerAnomalyDetection(patientId, docRef.id);
```

### Manual Trigger

```typescript
// From API
const response = await fetch('/api/anomaly-detection', {
  method: 'POST',
  body: JSON.stringify({ patientId: 'patient123' }),
});
```

### Acknowledge Alert

```typescript
const response = await fetch('/api/alerts', {
  method: 'PATCH',
  body: JSON.stringify({
    alertId: 'alert123',
    doctorId: 'doctor456',
    newStatus: 'REVIEWED',
    notes: 'Contacted patient, advised rest',
  }),
});
```

### Dashboard Integration

```tsx
import { HealthAlertsDashboard } from '@/components/health-alerts-dashboard';

function DoctorDashboard({ doctorId }) {
  return <HealthAlertsDashboard doctorId={doctorId} />;
}
```

## Type Definitions

Key types are defined in `types/index.ts`:

- `AlertSeverity`: 'NORMAL' | 'WATCH' | 'CRITICAL'
- `AlertStatus`: 'ACTIVE' | 'REVIEWED' | 'RESOLVED'
- `HealthAlert`: Complete alert document structure
- `AnomalyDetectionResult`: Detection engine output
- `ConfidenceScore`: Confidence calculation result

## Safety Considerations

1. **False Negative Prevention:** Critical thresholds are set conservatively
2. **Graceful Degradation:** Detection failures don't block reading saves
3. **Confidence Adjustment:** Low-quality data reduces severity escalation
4. **Audit Trail:** All alerts and acknowledgements are logged

## Testing

Test the anomaly detection with extreme values:

```bash
# Test API endpoint
curl -X POST http://localhost:3000/api/anomaly-detection \
  -H "Content-Type: application/json" \
  -d '{"patientId": "test-patient-id"}'

# Check service status
curl http://localhost:3000/api/anomaly-detection
```

## Future Enhancements

- [ ] Machine learning model integration
- [ ] Patient-specific baseline thresholds
- [ ] Alert correlation and deduplication
- [ ] Escalation workflows
- [ ] Integration with hospital EMR systems
