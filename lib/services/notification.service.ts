/**
 * Notification Service
 * 
 * Handles sending notifications for health alerts via AWS SNS.
 * Supports email and SMS notifications for CRITICAL alerts.
 * 
 * This service can be used both:
 * 1. From the Next.js API routes (server-side)
 * 2. From AWS Lambda (see lambda handler for embedded version)
 * 
 * Environment Variables Required:
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - AWS_REGION
 * - SNS_TOPIC_ARN (for critical alerts)
 * - SNS_SMS_SENDER_ID (optional, for SMS)
 */

import { 
  HealthAlert, 
  CriticalAlertNotification, 
  AnomalyDetectionResult 
} from '@/types';

// ============================================================================
// SNS CLIENT CONFIGURATION
// ============================================================================

interface SNSConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  topicArn: string;
  smsSenderId?: string;
}

/**
 * Get SNS configuration from environment variables
 */
function getSNSConfig(): SNSConfig | null {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const topicArn = process.env.SNS_TOPIC_ARN;
  
  if (!region || !accessKeyId || !secretAccessKey || !topicArn) {
    console.warn('[NotificationService] AWS SNS not configured - notifications disabled');
    return null;
  }
  
  return {
    region,
    accessKeyId,
    secretAccessKey,
    topicArn,
    smsSenderId: process.env.SNS_SMS_SENDER_ID,
  };
}

// ============================================================================
// MESSAGE FORMATTING
// ============================================================================

/**
 * Format critical alert for email notification
 */
function formatEmailMessage(alert: HealthAlert, dashboardUrl: string): string {
  const anomalyDescriptions = alert.detectionResult.anomalies
    .map(a => `• ${a.description}`)
    .join('\n');
  
  const recommendations = alert.detectionResult.recommendations
    .map(r => `• ${r}`)
    .join('\n');
  
  return `
🚨 CRITICAL HEALTH ALERT

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PATIENT INFORMATION
• Name: ${alert.patientName || 'Unknown'}
• Patient ID: ${alert.patientId}
• Alert ID: ${alert.id}
• Time: ${alert.createdAt.toISOString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ANOMALIES DETECTED
${anomalyDescriptions}

TRIGGER DETAILS
• Metric: ${alert.triggerMetric.replace(/_/g, ' ')}
• Current Value: ${alert.triggerValue}
• Normal Range: ${alert.detectionResult.anomalies[0]?.normalRange.min} - ${alert.detectionResult.anomalies[0]?.normalRange.max}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONFIDENCE ASSESSMENT
• Overall Confidence: ${(alert.detectionResult.confidence.overall * 100).toFixed(0)}%
• Data Quality: ${(alert.detectionResult.confidence.dataQuality * 100).toFixed(0)}%
• Data Recency: ${(alert.detectionResult.confidence.dataRecency * 100).toFixed(0)}%
${alert.detectionResult.confidence.factors.length > 0 
  ? `\nFactors:\n${alert.detectionResult.confidence.factors.map(f => `• ${f}`).join('\n')}`
  : ''
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RECOMMENDED ACTIONS
${recommendations}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View patient dashboard: ${dashboardUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is an automated alert from the Medical Safety System.
Please acknowledge this alert in your dashboard after review.

If this is a life-threatening emergency, contact emergency services immediately.
  `.trim();
}

/**
 * Format critical alert for SMS notification (short format)
 */
function formatSMSMessage(alert: HealthAlert): string {
  const primaryAnomaly = alert.detectionResult.anomalies[0];
  
  return `🚨 CRITICAL ALERT: ${alert.patientName || 'Patient'} - ${primaryAnomaly?.description || 'Health anomaly detected'}. Value: ${alert.triggerValue}. Check dashboard immediately.`;
}

/**
 * Create notification payload for SNS
 */
function createNotificationPayload(
  alert: HealthAlert,
  appUrl: string
): CriticalAlertNotification {
  const primaryAnomaly = alert.detectionResult.anomalies[0];
  
  return {
    alertId: alert.id,
    patientId: alert.patientId,
    patientName: alert.patientName || 'Unknown',
    severity: alert.severity,
    triggerMetric: alert.triggerMetric,
    triggerValue: alert.triggerValue,
    normalRange: primaryAnomaly?.normalRange || { min: 0, max: 0 },
    timestamp: alert.createdAt.toISOString(),
    recommendations: alert.detectionResult.recommendations,
    dashboardUrl: `${appUrl}/doctor/patients/${alert.patientId}`,
  };
}

// ============================================================================
// NOTIFICATION SERVICE
// ============================================================================

export class NotificationService {
  
  /**
   * Send critical alert notification via AWS SNS
   * Supports both email (via topic subscription) and SMS
   */
  static async sendCriticalAlert(
    alert: HealthAlert,
    options: {
      sendEmail?: boolean;
      sendSMS?: boolean;
      phoneNumber?: string;  // Required if sendSMS is true
    } = { sendEmail: true }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    
    // Skip if not a critical alert
    if (alert.severity !== 'CRITICAL') {
      return { success: false, error: 'Only CRITICAL alerts trigger notifications' };
    }
    
    const config = getSNSConfig();
    
    if (!config) {
      console.warn('[NotificationService] SNS not configured, skipping notification');
      return { success: false, error: 'SNS not configured' };
    }
    
    try {
      // Import AWS SDK dynamically to avoid issues in non-server environments
      const { SNSClient, PublishCommand } = await import('@aws-sdk/client-sns').catch(() => {
        throw new Error('AWS SNS SDK not installed. Run: npm install @aws-sdk/client-sns');
      });
      
      const client = new SNSClient({
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
      
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yourapp.com';
      const dashboardUrl = `${appUrl}/doctor/patients/${alert.patientId}`;
      
      // Send to SNS Topic (for email subscribers)
      if (options.sendEmail !== false) {
        const emailMessage = formatEmailMessage(alert, dashboardUrl);
        
        const snsMessage = {
          default: `CRITICAL HEALTH ALERT for ${alert.patientName}`,
          email: emailMessage,
          sms: formatSMSMessage(alert),
        };
        
        const publishCommand = new PublishCommand({
          TopicArn: config.topicArn,
          Message: JSON.stringify(snsMessage),
          MessageStructure: 'json',
          Subject: `🚨 CRITICAL: Health Alert for ${alert.patientName || 'Patient'}`,
          MessageAttributes: {
            alertId: {
              DataType: 'String',
              StringValue: alert.id,
            },
            patientId: {
              DataType: 'String',
              StringValue: alert.patientId,
            },
            severity: {
              DataType: 'String',
              StringValue: alert.severity,
            },
            triggerMetric: {
              DataType: 'String',
              StringValue: alert.triggerMetric,
            },
          },
        });
        
        const response = await client.send(publishCommand);
        
        console.log(`[NotificationService] Sent notification for alert ${alert.id}, MessageId: ${response.MessageId}`);
        
        return { success: true, messageId: response.MessageId };
      }
      
      // Direct SMS to specific phone number
      if (options.sendSMS && options.phoneNumber) {
        const smsCommand = new PublishCommand({
          PhoneNumber: options.phoneNumber,
          Message: formatSMSMessage(alert),
          MessageAttributes: {
            'AWS.SNS.SMS.SenderID': {
              DataType: 'String',
              StringValue: config.smsSenderId || 'HEALTHALERT',
            },
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: 'Transactional', // High priority delivery
            },
          },
        });
        
        const response = await client.send(smsCommand);
        
        console.log(`[NotificationService] Sent SMS to ${options.phoneNumber}, MessageId: ${response.MessageId}`);
        
        return { success: true, messageId: response.MessageId };
      }
      
      return { success: false, error: 'No notification method specified' };
      
    } catch (error) {
      console.error('[NotificationService] Failed to send notification:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
  
  /**
   * Send a batch of critical alerts
   * Useful for catching up on missed notifications
   */
  static async sendBatchAlerts(
    alerts: HealthAlert[]
  ): Promise<{ sent: number; failed: number; errors: string[] }> {
    const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL' && !a.notificationSent);
    
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    
    for (const alert of criticalAlerts) {
      const result = await this.sendCriticalAlert(alert);
      
      if (result.success) {
        sent++;
      } else {
        failed++;
        if (result.error) {
          errors.push(`Alert ${alert.id}: ${result.error}`);
        }
      }
      
      // Rate limiting - wait 100ms between messages
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return { sent, failed, errors };
  }
  
  /**
   * Send test notification to verify SNS configuration
   */
  static async sendTestNotification(): Promise<{ success: boolean; error?: string }> {
    const config = getSNSConfig();
    
    if (!config) {
      return { success: false, error: 'SNS not configured' };
    }
    
    try {
      const { SNSClient, PublishCommand } = await import('@aws-sdk/client-sns').catch(() => {
        throw new Error('AWS SNS SDK not installed. Run: npm install @aws-sdk/client-sns');
      });
      
      const client = new SNSClient({
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
      
      const command = new PublishCommand({
        TopicArn: config.topicArn,
        Message: JSON.stringify({
          default: 'Test notification from Medical Safety System',
          email: `
This is a test notification from the Medical Safety System.

If you received this message, your notification system is configured correctly.

Time: ${new Date().toISOString()}
          `.trim(),
        }),
        MessageStructure: 'json',
        Subject: '✅ Test: Medical Safety System Notification',
      });
      
      await client.send(command);
      
      console.log('[NotificationService] Test notification sent successfully');
      
      return { success: true };
      
    } catch (error) {
      console.error('[NotificationService] Test notification failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
  
  /**
   * Check if notification service is properly configured
   */
  static isConfigured(): boolean {
    return getSNSConfig() !== null;
  }
  
  /**
   * Get notification configuration status (for admin dashboard)
   */
  static getConfigurationStatus(): {
    configured: boolean;
    region?: string;
    topicArn?: string;
    hasSMSSenderId: boolean;
  } {
    const config = getSNSConfig();
    
    if (!config) {
      return { configured: false, hasSMSSenderId: false };
    }
    
    return {
      configured: true,
      region: config.region,
      topicArn: config.topicArn.replace(/:.{12}:/, ':***:'), // Mask account ID
      hasSMSSenderId: !!config.smsSenderId,
    };
  }
}

// ============================================================================
// WEBHOOK SUPPORT (Alternative to SNS)
// ============================================================================

/**
 * Send notification via webhook (alternative delivery method)
 * Useful for integrating with Slack, PagerDuty, etc.
 */
export async function sendWebhookNotification(
  alert: HealthAlert,
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = {
      type: 'CRITICAL_HEALTH_ALERT',
      alert: {
        id: alert.id,
        patientId: alert.patientId,
        patientName: alert.patientName,
        severity: alert.severity,
        triggerMetric: alert.triggerMetric,
        triggerValue: alert.triggerValue,
        timestamp: alert.createdAt.toISOString(),
        recommendations: alert.detectionResult.recommendations,
      },
      metadata: {
        confidence: alert.detectionResult.confidence.overall,
        anomalyCount: alert.detectionResult.anomalies.length,
      },
    };
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }
    
    return { success: true };
    
  } catch (error) {
    console.error('[Webhook] Failed to send notification:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
