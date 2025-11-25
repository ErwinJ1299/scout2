"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.predictHealthRisk = exports.getHealthHistory = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
/**
 * Extract and compute features from raw health metrics
 */
function computeFeatures(metrics, userProfile) {
    // Group metrics by type
    const heartRateData = metrics
        .filter(m => m.metricType === 'heart_rate')
        .map(m => m.value);
    const stepsData = metrics
        .filter(m => m.metricType === 'steps')
        .map(m => m.value);
    const sleepData = metrics
        .filter(m => m.metricType === 'sleep')
        .map(m => m.value);
    const caloriesData = metrics
        .filter(m => m.metricType === 'calories')
        .map(m => m.value);
    // Helper functions
    const mean = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const std = (arr) => {
        if (arr.length === 0)
            return 0;
        const avg = mean(arr);
        const variance = arr.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / arr.length;
        return Math.sqrt(variance);
    };
    const max = (arr) => arr.length > 0 ? Math.max(...arr) : 0;
    const min = (arr) => arr.length > 0 ? Math.min(...arr) : 0;
    const sum = (arr) => arr.reduce((a, b) => a + b, 0);
    // Compute trend (simple linear regression slope)
    const computeTrend = (values) => {
        if (values.length < 2)
            return 0;
        const n = values.length;
        const x = Array.from({ length: n }, (_, i) => i);
        const y = values;
        const sumX = sum(x);
        const sumY = sum(y);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        return isNaN(slope) ? 0 : slope;
    };
    // Get unique days with data
    const uniqueDays = new Set(metrics.map(m => m.timestamp.toDate().toDateString()));
    return {
        heart_rate_mean: mean(heartRateData),
        heart_rate_std: std(heartRateData),
        heart_rate_max: max(heartRateData),
        heart_rate_min: min(heartRateData),
        steps_mean: mean(stepsData),
        steps_std: std(stepsData),
        steps_total: sum(stepsData),
        sleep_hours_mean: mean(sleepData),
        sleep_hours_std: std(sleepData),
        calories_mean: mean(caloriesData),
        calories_std: std(caloriesData),
        age: userProfile.age,
        gender_encoded: userProfile.gender.toLowerCase() === 'male' ? 1 : 0,
        days_with_data: uniqueDays.size,
        trend_heart_rate: computeTrend(heartRateData),
        trend_steps: computeTrend(stepsData),
        trend_sleep: computeTrend(sleepData)
    };
}
/**
 * Simple rule-based risk prediction (fallback when ML model not available)
 */
function calculateRiskScore(features) {
    let riskScore = 0.3; // Base risk
    // Heart rate risk factors
    if (features.heart_rate_mean > 80)
        riskScore += 0.15;
    else if (features.heart_rate_mean > 75)
        riskScore += 0.08;
    else if (features.heart_rate_mean < 60)
        riskScore -= 0.05;
    // Activity risk factors
    if (features.steps_mean < 5000)
        riskScore += 0.20;
    else if (features.steps_mean < 7000)
        riskScore += 0.10;
    else if (features.steps_mean > 10000)
        riskScore -= 0.08;
    // Sleep risk factors
    if (features.sleep_hours_mean < 6)
        riskScore += 0.18;
    else if (features.sleep_hours_mean < 7)
        riskScore += 0.10;
    else if (features.sleep_hours_mean > 8)
        riskScore -= 0.05;
    // Calories risk factor
    if (features.calories_mean > 2800)
        riskScore += 0.10;
    else if (features.calories_mean < 1800)
        riskScore += 0.08;
    // Age factor
    if (features.age > 60)
        riskScore += 0.10;
    else if (features.age > 50)
        riskScore += 0.05;
    // Trend factors (worsening trends increase risk)
    if (features.trend_heart_rate > 1)
        riskScore += 0.08;
    if (features.trend_steps < -100)
        riskScore += 0.08;
    if (features.trend_sleep < -0.2)
        riskScore += 0.08;
    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, riskScore));
}
// ============================================================================
// CLOUD FUNCTIONS
// ============================================================================
/**
 * Get health history for a user
 */
exports.getHealthHistory = functions.https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        const { userId, days = 30 } = req.body;
        if (!userId) {
            res.status(400).json({ error: 'userId is required' });
            return;
        }
        // Query health metrics from last N days
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const metricsSnapshot = await db
            .collection('healthMetrics')
            .where('userId', '==', userId)
            .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startDate))
            .orderBy('timestamp', 'asc')
            .get();
        // Aggregate by date
        const dailyData = {};
        metricsSnapshot.forEach(doc => {
            const data = doc.data();
            const date = data.timestamp.toDate().toISOString().split('T')[0];
            if (!dailyData[date]) {
                dailyData[date] = {
                    date,
                    heart_rate: [],
                    steps: [],
                    sleep_hours: [],
                    calories: []
                };
            }
            if (data.metricType === 'heart_rate')
                dailyData[date].heart_rate.push(data.value);
            if (data.metricType === 'steps')
                dailyData[date].steps.push(data.value);
            if (data.metricType === 'sleep')
                dailyData[date].sleep_hours.push(data.value);
            if (data.metricType === 'calories')
                dailyData[date].calories.push(data.value);
        });
        // Calculate daily averages
        const history = Object.values(dailyData).map((day) => ({
            date: day.date,
            heart_rate: day.heart_rate.length > 0
                ? day.heart_rate.reduce((a, b) => a + b, 0) / day.heart_rate.length
                : 0,
            steps: day.steps.length > 0
                ? day.steps.reduce((a, b) => a + b, 0) / day.steps.length
                : 0,
            sleep_hours: day.sleep_hours.length > 0
                ? day.sleep_hours.reduce((a, b) => a + b, 0) / day.sleep_hours.length
                : 0,
            calories: day.calories.length > 0
                ? day.calories.reduce((a, b) => a + b, 0) / day.calories.length
                : 0
        }));
        res.json({ success: true, history });
    }
    catch (error) {
        console.error('Error getting health history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Predict health risk score using rule-based system
 */
exports.predictHealthRisk = functions
    .runWith({ memory: '512MB', timeoutSeconds: 60 })
    .https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        const { userId } = req.body;
        if (!userId) {
            res.status(400).json({ error: 'userId is required' });
            return;
        }
        console.log(`Predicting health risk for user: ${userId}`);
        // 1. Fetch user profile
        const userDoc = await db.collection('patients').doc(userId).get();
        if (!userDoc.exists) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const userData = userDoc.data();
        const userProfile = {
            age: userData.age || 35,
            gender: userData.gender || 'male'
        };
        // 2. Fetch last 30 days of health metrics
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const metricsSnapshot = await db
            .collection('healthMetrics')
            .where('userId', '==', userId)
            .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
            .get();
        const metrics = [];
        metricsSnapshot.forEach(doc => {
            const data = doc.data();
            metrics.push({
                timestamp: data.timestamp,
                metricType: data.metricType,
                value: data.value,
                userId: data.userId
            });
        });
        if (metrics.length < 10) {
            res.status(400).json({
                error: 'Insufficient data for prediction',
                message: 'At least 7 days of health metrics required'
            });
            return;
        }
        // 3. Compute features
        const features = computeFeatures(metrics, userProfile);
        console.log('Computed features:', features);
        // 4. Calculate risk score (rule-based)
        const riskScore = calculateRiskScore(features);
        console.log(`Predicted risk score: ${riskScore}`);
        // 5. Determine risk level
        let riskLevel;
        if (riskScore < 0.3)
            riskLevel = 'low';
        else if (riskScore < 0.6)
            riskLevel = 'medium';
        else
            riskLevel = 'high';
        // 6. Analyze contributing factors
        const contributingFactors = [
            {
                feature: 'heart_rate',
                impact: Math.abs(features.heart_rate_mean - 70) / 70,
                status: features.heart_rate_mean > 80 ? 'critical' : features.heart_rate_mean > 75 ? 'warning' : 'good'
            },
            {
                feature: 'steps',
                impact: Math.abs(features.steps_mean - 8000) / 8000,
                status: features.steps_mean < 5000 ? 'critical' : features.steps_mean < 7000 ? 'warning' : 'good'
            },
            {
                feature: 'sleep',
                impact: Math.abs(features.sleep_hours_mean - 7.5) / 7.5,
                status: features.sleep_hours_mean < 6 ? 'critical' : features.sleep_hours_mean < 7 ? 'warning' : 'good'
            },
            {
                feature: 'calories',
                impact: Math.abs(features.calories_mean - 2200) / 2200,
                status: features.calories_mean > 2800 ? 'warning' : 'good'
            }
        ].sort((a, b) => b.impact - a.impact);
        // 7. Generate recommendations
        const recommendations = [];
        if (features.heart_rate_mean > 80) {
            recommendations.push('Consider stress management techniques to lower resting heart rate');
        }
        if (features.steps_mean < 7000) {
            recommendations.push('Increase daily physical activity - aim for at least 8000 steps per day');
        }
        if (features.sleep_hours_mean < 7) {
            recommendations.push('Improve sleep quality - aim for 7-8 hours per night');
        }
        if (features.calories_mean > 2500) {
            recommendations.push('Monitor calorie intake and consider dietary adjustments');
        }
        if (recommendations.length === 0) {
            recommendations.push('Keep up the great work! Maintain your healthy lifestyle');
        }
        // 8. Generate predicted trend (simple forward projection)
        const predictedTrend = [];
        for (let i = 1; i <= 7; i++) {
            const trendAdjustment = (features.trend_heart_rate * 0.3 +
                features.trend_steps * -0.0001 +
                features.trend_sleep * -0.05) * i;
            const predictedRisk = Math.max(0, Math.min(1, riskScore + trendAdjustment * 0.01));
            predictedTrend.push({
                date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                predicted_risk: predictedRisk,
                confidence_lower: Math.max(0, predictedRisk - 0.1),
                confidence_upper: Math.min(1, predictedRisk + 0.1)
            });
        }
        // 9. Save prediction to Firestore
        await db.collection('healthPredictions').add({
            userId,
            risk_score: riskScore,
            risk_level: riskLevel,
            features,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        // 10. Return result
        const result = {
            risk_score: riskScore,
            risk_level: riskLevel,
            confidence: 0.85,
            contributing_factors: contributingFactors,
            recommendations,
            predicted_trend: predictedTrend
        };
        res.json({
            success: true,
            prediction: result
        });
    }
    catch (error) {
        console.error('Error predicting health risk:', error);
        res.status(500).json({ error: 'Internal server error', details: String(error) });
    }
});
//# sourceMappingURL=index.js.map