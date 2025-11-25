'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Area, AreaChart, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useAuthStore } from '@/lib/store/auth.store';
import { useToast } from '@/hooks/use-toast';
import { Activity, TrendingUp, TrendingDown, AlertTriangle, RefreshCw } from 'lucide-react';

interface HealthMetricHistory {
  date: string;
  heart_rate: number;
  steps: number;
  sleep_hours: number;
  calories: number;
}

interface PredictionResult {
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high';
  confidence: number;
  contributing_factors: {
    feature: string;
    impact: number;
    status: 'good' | 'warning' | 'critical';
  }[];
  recommendations: string[];
  predicted_trend: {
    date: string;
    predicted_risk: number;
    confidence_lower: number;
    confidence_upper: number;
  }[];
}

interface PredictionResponse {
  success: boolean;
  prediction: PredictionResult;
  timestamp: string;
}

export default function HealthPredictionPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [historicalData, setHistoricalData] = useState<HealthMetricHistory[]>([]);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user && mounted) {
      loadHistoricalData();
    }
  }, [user, mounted]);

  const loadHistoricalData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/health-prediction/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });

      const data = await response.json();
      
      if (data.success) {
        setHistoricalData(data.history);
      } else {
        throw new Error(data.error || 'Failed to load historical data');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load historical data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getPrediction = async () => {
    if (!user) return;
    
    setPredicting(true);
    try {
      const response = await fetch('/api/health-prediction/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });

      const data: PredictionResponse = await response.json();
      
      if (data.success) {
        setPrediction(data.prediction);
        toast({
          title: 'Prediction Complete',
          description: `Your health risk level is ${data.prediction.risk_level.toUpperCase()}`
        });
      } else {
        throw new Error('Failed to generate prediction');
      }
    } catch (error: any) {
      toast({
        title: 'Prediction Error',
        description: error.message || 'Failed to generate prediction',
        variant: 'destructive'
      });
    } finally {
      setPredicting(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'high': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getImpactColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (!mounted) return null;

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading health data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-8 w-8 text-blue-500" />
          <div>
            <h1 className="text-3xl font-bold">Health Risk Prediction</h1>
            <p className="text-muted-foreground">
              AI-powered health risk assessment based on your wearable data
            </p>
          </div>
        </div>
        <Button 
          onClick={getPrediction} 
          disabled={predicting || historicalData.length < 3}
          className="gap-2"
        >
          {predicting ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <TrendingUp className="h-4 w-4" />
              Get Prediction
            </>
          )}
        </Button>
      </div>

      {historicalData.length < 3 && (
        <Card className="border-yellow-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Insufficient Data
            </CardTitle>
            <CardDescription>
              At least 3 days of health metrics are required for accurate predictions. 
              Currently you have {historicalData.length} days of data.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Historical Data Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Heart Rate History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-red-500" />
              Heart Rate History
            </CardTitle>
            <CardDescription>Last 30 days average heart rate (bpm)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="heart_rate" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  name="Heart Rate (bpm)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Steps History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              Activity Level
            </CardTitle>
            <CardDescription>Daily steps count</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="steps" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Steps" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Prediction Results */}
      {prediction && (
        <>
          {/* Risk Score Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Current Health Risk Assessment</CardTitle>
              <CardDescription>AI-generated prediction based on your recent health metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Risk Level</p>
                  <Badge className={`${getRiskColor(prediction.risk_level)} text-white text-lg px-4 py-2`}>
                    {prediction.risk_level.toUpperCase()}
                  </Badge>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-sm text-muted-foreground">Risk Score</p>
                  <p className="text-4xl font-bold">
                    {(prediction.risk_score * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-sm text-muted-foreground">Confidence</p>
                  <p className="text-2xl font-semibold text-muted-foreground">
                    {(prediction.confidence * 100).toFixed(0)}%
                  </p>
                </div>
              </div>

              {/* Risk Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Low Risk</span>
                  <span className="text-yellow-600">Medium Risk</span>
                  <span className="text-red-600">High Risk</span>
                </div>
                <div className="w-full h-4 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full relative">
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-gray-800 rounded-full"
                    style={{ left: `${prediction.risk_score * 100}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contributing Factors */}
          <Card>
            <CardHeader>
              <CardTitle>Contributing Factors</CardTitle>
              <CardDescription>Key health metrics impacting your risk score</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {prediction.contributing_factors.map((factor, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {factor.impact > 0 ? (
                        <TrendingUp className={`h-5 w-5 ${getImpactColor(factor.status)}`} />
                      ) : (
                        <TrendingDown className={`h-5 w-5 ${getImpactColor(factor.status)}`} />
                      )}
                      <div>
                        <p className="font-medium capitalize">{factor.feature.replace('_', ' ')}</p>
                        <p className="text-sm text-muted-foreground">
                          Impact: {Math.abs(factor.impact * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <Badge variant={factor.status === 'good' ? 'default' : 'destructive'}>
                      {factor.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Predicted Trend */}
          <Card>
            <CardHeader>
              <CardTitle>7-Day Risk Trend Forecast</CardTitle>
              <CardDescription>Predicted health risk trajectory with confidence intervals</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={prediction.predicted_trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 1]} tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
                  <Tooltip 
                    formatter={(value: number) => `${(value * 100).toFixed(1)}%`}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="confidence_upper" 
                    stackId="1"
                    stroke="#94a3b8" 
                    fill="#e2e8f0" 
                    name="Confidence Upper"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="predicted_risk" 
                    stackId="2"
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.6}
                    name="Predicted Risk"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="confidence_lower" 
                    stackId="1"
                    stroke="#94a3b8" 
                    fill="#f1f5f9" 
                    name="Confidence Lower"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle>Personalized Recommendations</CardTitle>
              <CardDescription>Actions to improve your health risk score</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {prediction.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
