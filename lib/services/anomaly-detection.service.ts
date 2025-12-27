/**
 * Anomaly Detection Service
 * 
 * This service implements a three-layer anomaly detection engine:
 * 1. Rule-based safety thresholds (hard limits for critical vitals)
 * 2. Trend-based detection using recent readings
 * 3. Confidence scoring to handle noisy or missing wearable data
 * 
 * Safety-first approach: Err on the side of caution for CRITICAL alerts
 */

import {
  AlertSeverity,
  AnomalyDetectionResult,
  AnomalyMetricType,
  ConfidenceScore,
  DataSource,
  DetectedAnomaly,
  MetricReading,
  MetricThreshold,
  TrendAnalysis,
} from '@/types';

// ============================================================================
// CONFIGURATION: Medical Safety Thresholds
// ============================================================================

/**
 * Clinically-validated thresholds for vital signs
 * Sources: AHA, ADA, WHO guidelines
 * 
 * CRITICAL thresholds are set conservatively to avoid false negatives
 * that could endanger patient safety
 */
export const METRIC_THRESHOLDS: Record<AnomalyMetricType, MetricThreshold> = {
  heart_rate: {
    metric: 'heart_rate',
    criticalLow: 40,      // Severe bradycardia
    warningLow: 50,       // Bradycardia
    normalLow: 60,
    normalHigh: 100,
    warningHigh: 110,     // Tachycardia
    criticalHigh: 130,    // Severe tachycardia (resting)
    unit: 'bpm',
  },
  blood_pressure_systolic: {
    metric: 'blood_pressure_systolic',
    criticalLow: 80,      // Hypotensive crisis
    warningLow: 90,       // Hypotension
    normalLow: 90,
    normalHigh: 120,
    warningHigh: 140,     // Stage 1 Hypertension
    criticalHigh: 180,    // Hypertensive crisis
    unit: 'mmHg',
  },
  blood_pressure_diastolic: {
    metric: 'blood_pressure_diastolic',
    criticalLow: 50,
    warningLow: 60,
    normalLow: 60,
    normalHigh: 80,
    warningHigh: 90,      // Stage 1 Hypertension
    criticalHigh: 120,    // Hypertensive crisis
    unit: 'mmHg',
  },
  glucose: {
    metric: 'glucose',
    criticalLow: 54,      // Severe hypoglycemia
    warningLow: 70,       // Hypoglycemia
    normalLow: 70,
    normalHigh: 140,      // Post-meal target
    warningHigh: 180,     // Hyperglycemia
    criticalHigh: 250,    // Severe hyperglycemia
    unit: 'mg/dL',
  },
  oxygen_saturation: {
    metric: 'oxygen_saturation',
    criticalLow: 88,      // Severe hypoxemia
    warningLow: 92,       // Hypoxemia
    normalLow: 95,
    normalHigh: 100,
    unit: '%',
  },
  temperature: {
    metric: 'temperature',
    criticalLow: 35,      // Hypothermia
    warningLow: 36,
    normalLow: 36.1,
    normalHigh: 37.2,
    warningHigh: 38,      // Fever
    criticalHigh: 39.5,   // High fever
    unit: '°C',
  },
  steps: {
    metric: 'steps',
    normalLow: 0,
    normalHigh: 50000,    // Very high activity
    unit: 'steps',
  },
  weight: {
    metric: 'weight',
    normalLow: 30,
    normalHigh: 300,
    unit: 'kg',
  },
};

/**
 * Data source reliability weights for confidence scoring
 * Higher = more reliable
 */
const SOURCE_CONFIDENCE: Record<DataSource, number> = {
  clinical: 1.0,    // Medical-grade devices
  iot: 0.85,        // Connected medical IoT devices
  wearable: 0.7,    // Consumer wearables
  manual: 0.5,      // Self-reported data
};

// ============================================================================
// LAYER 1: Rule-Based Threshold Detection
// ============================================================================

/**
 * Evaluates a single metric reading against clinical thresholds
 * Returns detected anomaly if value is outside safe range
 */
function evaluateThreshold(
  reading: MetricReading,
  threshold: MetricThreshold
): DetectedAnomaly | null {
  const { value, metric } = reading;
  
  // Check CRITICAL thresholds first (safety priority)
  if (threshold.criticalLow !== undefined && value <= threshold.criticalLow) {
    return {
      metric,
      currentValue: value,
      normalRange: { min: threshold.normalLow, max: threshold.normalHigh },
      deviation: threshold.normalLow - value,
      type: 'threshold_breach',
      description: `CRITICAL: ${metric.replace('_', ' ')} is dangerously low at ${value} ${threshold.unit} (critical threshold: ${threshold.criticalLow})`,
    };
  }
  
  if (threshold.criticalHigh !== undefined && value >= threshold.criticalHigh) {
    return {
      metric,
      currentValue: value,
      normalRange: { min: threshold.normalLow, max: threshold.normalHigh },
      deviation: value - threshold.normalHigh,
      type: 'threshold_breach',
      description: `CRITICAL: ${metric.replace('_', ' ')} is dangerously high at ${value} ${threshold.unit} (critical threshold: ${threshold.criticalHigh})`,
    };
  }
  
  // Check WARNING thresholds
  if (threshold.warningLow !== undefined && value <= threshold.warningLow) {
    return {
      metric,
      currentValue: value,
      normalRange: { min: threshold.normalLow, max: threshold.normalHigh },
      deviation: threshold.normalLow - value,
      type: 'threshold_breach',
      description: `WARNING: ${metric.replace('_', ' ')} is below normal at ${value} ${threshold.unit}`,
    };
  }
  
  if (threshold.warningHigh !== undefined && value >= threshold.warningHigh) {
    return {
      metric,
      currentValue: value,
      normalRange: { min: threshold.normalLow, max: threshold.normalHigh },
      deviation: value - threshold.normalHigh,
      type: 'threshold_breach',
      description: `WARNING: ${metric.replace('_', ' ')} is above normal at ${value} ${threshold.unit}`,
    };
  }
  
  return null;
}

/**
 * Checks if an anomaly is critical severity based on threshold breach
 */
function isCriticalThresholdBreach(
  value: number,
  threshold: MetricThreshold
): boolean {
  if (threshold.criticalLow !== undefined && value <= threshold.criticalLow) {
    return true;
  }
  if (threshold.criticalHigh !== undefined && value >= threshold.criticalHigh) {
    return true;
  }
  return false;
}

// ============================================================================
// LAYER 2: Trend-Based Detection
// ============================================================================

/**
 * Analyzes trend in metric readings over time
 * Uses linear regression to determine direction and volatility
 */
function analyzeTrend(
  readings: MetricReading[],
  metric: AnomalyMetricType,
  periodDays: number = 7
): TrendAnalysis {
  const metricReadings = readings
    .filter(r => r.metric === metric)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  const n = metricReadings.length;
  
  if (n < 3) {
    return {
      metric,
      direction: 'stable',
      slope: 0,
      volatility: 0,
      dataPoints: n,
      periodDays,
    };
  }
  
  // Calculate linear regression slope
  const values = metricReadings.map(r => r.value);
  const times = metricReadings.map(r => r.timestamp.getTime());
  
  const meanX = times.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (times[i] - meanX) * (values[i] - meanY);
    denominator += (times[i] - meanX) ** 2;
  }
  
  // Slope per day (convert from ms to days)
  const slopePerMs = denominator !== 0 ? numerator / denominator : 0;
  const slopePerDay = slopePerMs * (24 * 60 * 60 * 1000);
  
  // Calculate volatility (standard deviation / mean)
  const variance = values.reduce((sum, v) => sum + (v - meanY) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const volatility = meanY !== 0 ? stdDev / Math.abs(meanY) : 0;
  
  // Determine direction based on slope significance
  const threshold = meanY * 0.01; // 1% of mean per day is significant
  let direction: TrendAnalysis['direction'];
  
  if (volatility > 0.3) {
    direction = 'volatile';
  } else if (slopePerDay > threshold) {
    direction = 'increasing';
  } else if (slopePerDay < -threshold) {
    direction = 'decreasing';
  } else {
    direction = 'stable';
  }
  
  return {
    metric,
    direction,
    slope: slopePerDay,
    volatility,
    dataPoints: n,
    periodDays,
  };
}

/**
 * Detects sudden changes in metric values
 * Compares recent readings against baseline
 */
function detectSuddenChange(
  currentReading: MetricReading,
  recentReadings: MetricReading[],
  threshold: MetricThreshold
): DetectedAnomaly | null {
  const metricReadings = recentReadings
    .filter(r => r.metric === currentReading.metric)
    .slice(-10); // Last 10 readings
  
  if (metricReadings.length < 3) {
    return null; // Insufficient data for sudden change detection
  }
  
  const values = metricReadings.map(r => r.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  );
  
  // Detect if current value is > 2 standard deviations from recent mean
  const zScore = stdDev !== 0 ? (currentReading.value - mean) / stdDev : 0;
  
  if (Math.abs(zScore) > 2.5) {
    const direction = zScore > 0 ? 'spike' : 'drop';
    return {
      metric: currentReading.metric,
      currentValue: currentReading.value,
      normalRange: { min: threshold.normalLow, max: threshold.normalHigh },
      deviation: Math.abs(currentReading.value - mean),
      type: 'sudden_change',
      description: `Sudden ${direction} detected: ${currentReading.metric.replace('_', ' ')} changed from average ${mean.toFixed(1)} to ${currentReading.value} ${threshold.unit}`,
    };
  }
  
  return null;
}

/**
 * Detects concerning trends that warrant attention
 */
function detectTrendAnomaly(
  trend: TrendAnalysis,
  threshold: MetricThreshold
): DetectedAnomaly | null {
  // Volatile readings indicate unstable condition
  if (trend.volatility > 0.25 && trend.dataPoints >= 5) {
    return {
      metric: trend.metric,
      currentValue: 0, // N/A for trend anomaly
      normalRange: { min: threshold.normalLow, max: threshold.normalHigh },
      deviation: trend.volatility,
      type: 'trend_anomaly',
      description: `High variability detected in ${trend.metric.replace('_', ' ')} readings (volatility: ${(trend.volatility * 100).toFixed(1)}%)`,
    };
  }
  
  // Rapid increase/decrease over time
  const normalRange = threshold.normalHigh - threshold.normalLow;
  const significantChange = normalRange * 0.1; // 10% of normal range per day
  
  if (Math.abs(trend.slope) > significantChange && trend.dataPoints >= 5) {
    const direction = trend.slope > 0 ? 'increasing' : 'decreasing';
    return {
      metric: trend.metric,
      currentValue: 0,
      normalRange: { min: threshold.normalLow, max: threshold.normalHigh },
      deviation: Math.abs(trend.slope),
      type: 'trend_anomaly',
      description: `${trend.metric.replace('_', ' ')} is consistently ${direction} at ${Math.abs(trend.slope).toFixed(2)} ${threshold.unit}/day`,
    };
  }
  
  return null;
}

// ============================================================================
// LAYER 3: Confidence Scoring
// ============================================================================

/**
 * Calculates overall confidence score for the detection result
 * Lower confidence = more caution in escalation decisions
 */
function calculateConfidence(
  readings: MetricReading[],
  recentHistory: MetricReading[]
): ConfidenceScore {
  const factors: string[] = [];
  
  // 1. Data Quality Score (based on source)
  const sources = readings.map(r => r.source);
  const avgSourceScore = sources.reduce((sum, s) => sum + SOURCE_CONFIDENCE[s], 0) / sources.length;
  const dataQuality = avgSourceScore || 0.5;
  
  if (dataQuality >= 0.8) {
    factors.push('High-quality data sources (clinical/IoT devices)');
  } else if (dataQuality < 0.6) {
    factors.push('Lower confidence due to manual/wearable data sources');
  }
  
  // 2. Data Recency Score
  const now = Date.now();
  const latestReading = readings.reduce(
    (latest, r) => Math.max(latest, r.timestamp.getTime()),
    0
  );
  const hoursSinceLatest = (now - latestReading) / (1000 * 60 * 60);
  
  let dataRecency: number;
  if (hoursSinceLatest < 1) {
    dataRecency = 1.0;
  } else if (hoursSinceLatest < 4) {
    dataRecency = 0.9;
  } else if (hoursSinceLatest < 12) {
    dataRecency = 0.7;
  } else if (hoursSinceLatest < 24) {
    dataRecency = 0.5;
  } else {
    dataRecency = 0.3;
    factors.push('Data is more than 24 hours old');
  }
  
  // 3. Data Consistency Score (based on reading frequency)
  const uniqueDays = new Set(
    recentHistory.map(r => r.timestamp.toDateString())
  ).size;
  const expectedDays = 7;
  const dataConsistency = Math.min(uniqueDays / expectedDays, 1);
  
  if (dataConsistency < 0.5) {
    factors.push('Sparse data history (fewer readings than expected)');
  }
  
  // 4. Check for data gaps
  if (recentHistory.length < 5) {
    factors.push('Limited historical data for trend analysis');
  }
  
  // Calculate overall score (weighted average)
  const overall = (
    dataQuality * 0.4 +
    dataRecency * 0.35 +
    dataConsistency * 0.25
  );
  
  return {
    overall: Math.round(overall * 100) / 100,
    dataQuality: Math.round(dataQuality * 100) / 100,
    dataRecency: Math.round(dataRecency * 100) / 100,
    dataConsistency: Math.round(dataConsistency * 100) / 100,
    factors,
  };
}

// ============================================================================
// SEVERITY CLASSIFICATION
// ============================================================================

/**
 * Determines final severity level based on anomalies and confidence
 * 
 * Safety principle: When in doubt, escalate to WATCH rather than NORMAL
 * Only suppress CRITICAL if confidence is very low AND no threshold breach
 */
function classifySeverity(
  anomalies: DetectedAnomaly[],
  confidence: ConfidenceScore
): AlertSeverity {
  if (anomalies.length === 0) {
    return 'NORMAL';
  }
  
  // Check for critical threshold breaches
  const hasCriticalBreach = anomalies.some(
    a => a.type === 'threshold_breach' && a.description.startsWith('CRITICAL')
  );
  
  if (hasCriticalBreach) {
    // Only downgrade CRITICAL if confidence is extremely low
    // Safety-first: Better to over-alert than miss a genuine emergency
    if (confidence.overall < 0.3 && confidence.dataQuality < 0.4) {
      return 'WATCH'; // Low confidence, but still worth watching
    }
    return 'CRITICAL';
  }
  
  // Any warning-level anomalies = WATCH
  const hasWarning = anomalies.some(
    a => a.type === 'threshold_breach' && a.description.startsWith('WARNING')
  );
  
  if (hasWarning) {
    return 'WATCH';
  }
  
  // Trend anomalies or sudden changes
  const hasTrendAnomaly = anomalies.some(
    a => a.type === 'trend_anomaly' || a.type === 'sudden_change'
  );
  
  if (hasTrendAnomaly && confidence.overall >= 0.5) {
    return 'WATCH';
  }
  
  // Low confidence trend anomalies don't escalate
  return 'NORMAL';
}

/**
 * Generate actionable recommendations based on anomalies
 */
function generateRecommendations(
  anomalies: DetectedAnomaly[],
  severity: AlertSeverity
): string[] {
  const recommendations: string[] = [];
  
  if (severity === 'CRITICAL') {
    recommendations.push('⚠️ URGENT: Seek immediate medical attention');
    recommendations.push('Contact your healthcare provider or call emergency services');
  }
  
  for (const anomaly of anomalies) {
    switch (anomaly.metric) {
      case 'heart_rate':
        if (anomaly.currentValue > 0) {
          if (anomaly.currentValue > 100) {
            recommendations.push('Rest and avoid strenuous activity');
            recommendations.push('Monitor for chest pain, shortness of breath');
          } else if (anomaly.currentValue < 60) {
            recommendations.push('Monitor for dizziness or fainting');
          }
        }
        break;
        
      case 'blood_pressure_systolic':
      case 'blood_pressure_diastolic':
        recommendations.push('Take blood pressure again in a seated position after 5 min rest');
        recommendations.push('Avoid caffeine and stress before re-measurement');
        break;
        
      case 'glucose':
        if (anomaly.currentValue > 0) {
          if (anomaly.currentValue > 180) {
            recommendations.push('Check ketones if blood sugar remains high');
            recommendations.push('Increase water intake');
          } else if (anomaly.currentValue < 70) {
            recommendations.push('Consume 15-20g fast-acting carbohydrates');
            recommendations.push('Recheck glucose in 15 minutes');
          }
        }
        break;
        
      case 'oxygen_saturation':
        if (anomaly.currentValue < 92) {
          recommendations.push('Sit upright and take slow, deep breaths');
          recommendations.push('If symptoms persist, seek medical attention');
        }
        break;
    }
  }
  
  if (severity === 'WATCH') {
    recommendations.push('Continue monitoring and log any symptoms');
    recommendations.push('Consult your doctor within 24-48 hours if readings persist');
  }
  
  return [...new Set(recommendations)]; // Remove duplicates
}

// ============================================================================
// MAIN DETECTION FUNCTION
// ============================================================================

/**
 * Main entry point for anomaly detection
 * Processes new health readings and returns detection result
 * 
 * @param patientId - The patient's unique identifier
 * @param newReadings - Array of new metric readings to evaluate
 * @param historicalReadings - Recent historical readings for trend analysis
 * @returns Complete anomaly detection result
 */
export function detectAnomalies(
  patientId: string,
  newReadings: MetricReading[],
  historicalReadings: MetricReading[]
): AnomalyDetectionResult {
  const timestamp = new Date();
  const anomalies: DetectedAnomaly[] = [];
  const trendAnalyses: TrendAnalysis[] = [];
  
  // Combine new and historical for trend analysis
  const allReadings = [...historicalReadings, ...newReadings]
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  // Get unique metrics from new readings
  const metricsToEvaluate = [...new Set(newReadings.map(r => r.metric))];
  
  for (const metric of metricsToEvaluate) {
    const threshold = METRIC_THRESHOLDS[metric];
    if (!threshold) continue;
    
    // Get the most recent reading for this metric
    const latestReading = newReadings
      .filter(r => r.metric === metric)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
    
    if (!latestReading) continue;
    
    // LAYER 1: Rule-based threshold check
    const thresholdAnomaly = evaluateThreshold(latestReading, threshold);
    if (thresholdAnomaly) {
      anomalies.push(thresholdAnomaly);
    }
    
    // LAYER 2a: Sudden change detection
    const suddenChangeAnomaly = detectSuddenChange(
      latestReading,
      historicalReadings,
      threshold
    );
    if (suddenChangeAnomaly) {
      anomalies.push(suddenChangeAnomaly);
    }
    
    // LAYER 2b: Trend analysis
    const trend = analyzeTrend(allReadings, metric);
    trendAnalyses.push(trend);
    
    const trendAnomaly = detectTrendAnomaly(trend, threshold);
    if (trendAnomaly) {
      anomalies.push(trendAnomaly);
    }
  }
  
  // LAYER 3: Calculate confidence score
  const confidence = calculateConfidence(newReadings, historicalReadings);
  
  // Determine overall severity
  const severity = classifySeverity(anomalies, confidence);
  
  // Generate recommendations
  const recommendations = generateRecommendations(anomalies, severity);
  
  return {
    patientId,
    timestamp,
    severity,
    confidence,
    anomalies,
    trendAnalysis: trendAnalyses,
    rawReadings: newReadings,
    recentHistory: historicalReadings.slice(-50), // Keep last 50 readings
    recommendations,
    requiresNotification: severity === 'CRITICAL',
  };
}

/**
 * Converts a standard Reading from Firestore to MetricReadings for detection
 */
export function convertReadingToMetrics(reading: {
  heartRate?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  glucose?: number;
  steps?: number;
  weight?: number;
  createdAt: Date;
  source: 'manual' | 'iot' | 'wearable';
}): MetricReading[] {
  const metrics: MetricReading[] = [];
  const timestamp = reading.createdAt;
  const source = reading.source as DataSource;
  
  if (reading.heartRate !== undefined) {
    metrics.push({
      metric: 'heart_rate',
      value: reading.heartRate,
      timestamp,
      source,
    });
  }
  
  if (reading.bpSystolic !== undefined) {
    metrics.push({
      metric: 'blood_pressure_systolic',
      value: reading.bpSystolic,
      timestamp,
      source,
    });
  }
  
  if (reading.bpDiastolic !== undefined) {
    metrics.push({
      metric: 'blood_pressure_diastolic',
      value: reading.bpDiastolic,
      timestamp,
      source,
    });
  }
  
  if (reading.glucose !== undefined) {
    metrics.push({
      metric: 'glucose',
      value: reading.glucose,
      timestamp,
      source,
    });
  }
  
  if (reading.steps !== undefined) {
    metrics.push({
      metric: 'steps',
      value: reading.steps,
      timestamp,
      source,
    });
  }
  
  if (reading.weight !== undefined) {
    metrics.push({
      metric: 'weight',
      value: reading.weight,
      timestamp,
      source,
    });
  }
  
  return metrics;
}

/**
 * Get the primary trigger metric and value for an alert
 */
export function getPrimaryTrigger(
  anomalies: DetectedAnomaly[]
): { metric: AnomalyMetricType; value: number } | null {
  if (anomalies.length === 0) return null;
  
  // Prioritize threshold breaches, then sudden changes, then trends
  const prioritized = [...anomalies].sort((a, b) => {
    const priority: Record<string, number> = {
      threshold_breach: 3,
      sudden_change: 2,
      trend_anomaly: 1,
    };
    return (priority[b.type] || 0) - (priority[a.type] || 0);
  });
  
  const primary = prioritized[0];
  return {
    metric: primary.metric,
    value: primary.currentValue,
  };
}
