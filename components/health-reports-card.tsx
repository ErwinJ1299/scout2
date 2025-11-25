'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Loader2, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HealthReportsCardProps {
  userId: string;
}

export function HealthReportsCard({ userId }: HealthReportsCardProps) {
  const [generating, setGenerating] = useState(false);
  const [period, setPeriod] = useState('week');
  const { toast } = useToast();

  const generateReport = async () => {
    try {
      setGenerating(true);
      
      // Fetch report data
      const res = await fetch(`/api/reports?userId=${userId}&period=${period}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error('Failed to generate report');
      }

      // Create HTML report
      const reportHTML = createReportHTML(data);
      
      // Create and download as HTML
      const blob = new Blob([reportHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `health-report-${period}-${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Report downloaded!',
        description: 'Your health report has been generated successfully'
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate report. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setGenerating(false);
    }
  };

  const createReportHTML = (data: any) => {
    const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Health Report - ${formatDate(data.dateRange.end)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
          }
          .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            border-bottom: 3px solid #14b8a6;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          h1 { color: #14b8a6; font-size: 32px; margin-bottom: 10px; }
          .subtitle { color: #666; font-size: 16px; }
          .section {
            margin: 30px 0;
            page-break-inside: avoid;
          }
          h2 {
            color: #14b8a6;
            font-size: 24px;
            margin-bottom: 15px;
            border-left: 4px solid #14b8a6;
            padding-left: 15px;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
          }
          .stat-card {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #14b8a6;
          }
          .stat-label {
            font-size: 14px;
            color: #666;
            margin-bottom: 5px;
          }
          .stat-value {
            font-size: 28px;
            font-weight: bold;
            color: #14b8a6;
          }
          .stat-unit {
            font-size: 14px;
            color: #999;
          }
          .trend {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-top: 5px;
          }
          .trend.improving { background: #dcfce7; color: #16a34a; }
          .trend.stable { background: #e0f2fe; color: #0284c7; }
          .trend.declining { background: #fee2e2; color: #dc2626; }
          .alert {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 10px 0;
            border-radius: 4px;
          }
          .alert.critical {
            background: #fee2e2;
            border-left-color: #dc2626;
          }
          .goal-item {
            background: #f8fafc;
            padding: 15px;
            margin: 10px 0;
            border-radius: 8px;
            border-left: 4px solid #14b8a6;
          }
          .achievement {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            background: #fef3c7;
            padding: 10px 15px;
            border-radius: 8px;
            margin: 5px;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #999;
            font-size: 12px;
          }
          @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏥 Health Monitoring Report</h1>
            <p class="subtitle">
              Report Period: ${formatDate(data.dateRange.start)} - ${formatDate(data.dateRange.end)}
            </p>
            <p class="subtitle">Generated: ${formatDate(new Date().toISOString())}</p>
          </div>

          <!-- Health Statistics -->
          <div class="section">
            <h2>📊 Health Statistics Overview</h2>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Average Heart Rate</div>
                <div class="stat-value">${data.stats.avgHeartRate || 'N/A'} <span class="stat-unit">bpm</span></div>
                <span class="trend ${data.stats.trends.heartRate === 'decreasing' ? 'improving' : data.stats.trends.heartRate === 'increasing' ? 'declining' : 'stable'}">
                  ${data.stats.trends.heartRate}
                </span>
              </div>
              <div class="stat-card">
                <div class="stat-label">Average Steps</div>
                <div class="stat-value">${data.stats.avgSteps || 'N/A'} <span class="stat-unit">steps</span></div>
                <span class="trend ${data.stats.trends.steps === 'increasing' ? 'improving' : data.stats.trends.steps === 'decreasing' ? 'declining' : 'stable'}">
                  ${data.stats.trends.steps}
                </span>
              </div>
              <div class="stat-card">
                <div class="stat-label">Average Glucose</div>
                <div class="stat-value">${data.stats.avgGlucose || 'N/A'} <span class="stat-unit">mg/dL</span></div>
                <span class="trend ${data.stats.trends.glucose === 'decreasing' ? 'improving' : data.stats.trends.glucose === 'increasing' ? 'declining' : 'stable'}">
                  ${data.stats.trends.glucose}
                </span>
              </div>
              <div class="stat-card">
                <div class="stat-label">Average Blood Pressure</div>
                <div class="stat-value">${data.stats.avgBPSystolic || 'N/A'}/${data.stats.avgBPDiastolic || 'N/A'} <span class="stat-unit">mmHg</span></div>
                <span class="trend ${data.stats.trends.bp === 'decreasing' ? 'improving' : data.stats.trends.bp === 'increasing' ? 'declining' : 'stable'}">
                  ${data.stats.trends.bp}
                </span>
              </div>
            </div>
            <div class="stat-card" style="margin-top: 20px;">
              <div class="stat-label">Total Health Readings</div>
              <div class="stat-value">${data.stats.totalReadings}</div>
            </div>
          </div>

          <!-- Health Alerts -->
          ${data.alerts && data.alerts.length > 0 ? `
          <div class="section">
            <h2>⚠️ Health Alerts</h2>
            ${data.alerts.map((alert: any) => `
              <div class="alert ${alert.severity === 'critical' ? 'critical' : ''}">
                <strong>${alert.message || alert.title}</strong>
                ${alert.recommendation ? `<p>${alert.recommendation}</p>` : ''}
              </div>
            `).join('')}
          </div>
          ` : ''}

          <!-- Active Goals -->
          ${data.goals && data.goals.length > 0 ? `
          <div class="section">
            <h2>🎯 Active Health Goals</h2>
            ${data.goals.map((goal: any) => `
              <div class="goal-item">
                <strong>${goal.title}</strong>
                <p style="margin: 5px 0;">Target: ${goal.targetValue} ${goal.goalType}</p>
                <p style="color: #666;">Progress: ${goal.progress}% • Status: ${goal.status}</p>
              </div>
            `).join('')}
          </div>
          ` : ''}

          <!-- Recent Achievements -->
          ${data.recentAchievements && data.recentAchievements.length > 0 ? `
          <div class="section">
            <h2>🏆 Recent Achievements</h2>
            <div>
              ${data.recentAchievements.map((achievement: any) => `
                <div class="achievement">
                  <span style="font-size: 24px;">${achievement.icon}</span>
                  <div>
                    <strong>${achievement.title}</strong>
                    <p style="font-size: 14px; color: #666;">${achievement.description}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          <!-- User Progress -->
          ${data.userStats ? `
          <div class="section">
            <h2>📈 Overall Progress</h2>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Total Points</div>
                <div class="stat-value">${data.userStats.totalPoints || 0}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Current Streak</div>
                <div class="stat-value">${data.userStats.currentStreak || 0} <span class="stat-unit">days</span></div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Longest Streak</div>
                <div class="stat-value">${data.userStats.longestStreak || 0} <span class="stat-unit">days</span></div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Achievements Earned</div>
                <div class="stat-value">${data.userStats.achievementsCount || 0}</div>
              </div>
            </div>
          </div>
          ` : ''}

          <div class="footer">
            <p>This report is generated by Health Monitoring Platform</p>
            <p>For medical advice, please consult your healthcare provider</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-teal-600" />
          Health Reports
        </CardTitle>
        <CardDescription>
          Download comprehensive reports of your health data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={generateReport}
            disabled={generating}
            className="flex-1"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download Report
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Reports include health statistics, trends, goals, achievements, and alerts
        </p>
      </CardContent>
    </Card>
  );
}
