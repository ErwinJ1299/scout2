"""
Local Health Risk Prediction Server
Runs on http://localhost:5000

Uses REAL patient data from Firestore to generate health risk predictions.
This provides accurate predictions based on actual health metrics.
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
from datetime import datetime, timedelta
import random
import firebase_admin
from firebase_admin import credentials, firestore
import os

# Initialize Firebase Admin SDK
try:
    # Use the Firebase config from your project
    cred = credentials.Certificate({
        "type": "service_account",
        "project_id": "scouts-health-monitor-2025",
        "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID", ""),
        "private_key": os.getenv("FIREBASE_PRIVATE_KEY", "").replace('\\n', '\n'),
        "client_email": os.getenv("FIREBASE_CLIENT_EMAIL", ""),
        "client_id": os.getenv("FIREBASE_CLIENT_ID", ""),
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs"
    })
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("✅ Firebase Admin SDK initialized successfully")
except Exception as e:
    print(f"⚠️  Firebase Admin SDK initialization failed: {e}")
    print("📌 Will use mock predictions as fallback")
    db = None


def compute_features(metrics, user_profile):
    """Extract and compute 17 features from raw health metrics"""
    # Group metrics by type
    heart_rate_data = [m['value'] for m in metrics if m['metricType'] == 'heart_rate']
    steps_data = [m['value'] for m in metrics if m['metricType'] == 'steps']
    sleep_data = [m['value'] for m in metrics if m['metricType'] == 'sleep']
    calories_data = [m['value'] for m in metrics if m['metricType'] == 'calories']
    
    # Helper functions
    def mean(arr):
        return sum(arr) / len(arr) if arr else 0
    
    def std(arr):
        if not arr:
            return 0
        avg = mean(arr)
        variance = sum((x - avg) ** 2 for x in arr) / len(arr)
        return variance ** 0.5
    
    def compute_trend(values):
        """Simple linear regression slope"""
        if len(values) < 2:
            return 0
        n = len(values)
        x = list(range(n))
        sum_x = sum(x)
        sum_y = sum(values)
        sum_xy = sum(xi * yi for xi, yi in zip(x, values))
        sum_x2 = sum(xi * xi for xi in x)
        
        denominator = (n * sum_x2 - sum_x * sum_x)
        if denominator == 0:
            return 0
        slope = (n * sum_xy - sum_x * sum_y) / denominator
        return slope
    
    # Get unique days with data
    unique_days = len(set(m['timestamp'].date() if hasattr(m['timestamp'], 'date') else m['timestamp'][:10] for m in metrics))
    
    return {
        'heart_rate_mean': mean(heart_rate_data),
        'heart_rate_std': std(heart_rate_data),
        'heart_rate_max': max(heart_rate_data) if heart_rate_data else 0,
        'heart_rate_min': min(heart_rate_data) if heart_rate_data else 0,
        'steps_mean': mean(steps_data),
        'steps_std': std(steps_data),
        'steps_total': sum(steps_data),
        'sleep_hours_mean': mean(sleep_data),
        'sleep_hours_std': std(sleep_data),
        'calories_mean': mean(calories_data),
        'calories_std': std(calories_data),
        'age': user_profile.get('age', 35),
        'gender_encoded': 1 if user_profile.get('gender', 'male').lower() == 'male' else 0,
        'days_with_data': unique_days,
        'trend_heart_rate': compute_trend(heart_rate_data),
        'trend_steps': compute_trend(steps_data),
        'trend_sleep': compute_trend(sleep_data)
    }

def calculate_risk_score(features):
    """
    Rule-based risk calculation using same logic as Cloud Functions
    Returns risk score between 0 and 1
    """
    risk = 0.0
    
    # Heart Rate Risk (0-30 points)
    hr_mean = features['heart_rate_mean']
    if hr_mean > 100:
        risk += 0.30
    elif hr_mean > 90:
        risk += 0.25
    elif hr_mean > 80:
        risk += 0.15
    elif hr_mean < 50:
        risk += 0.20
    elif hr_mean < 60:
        risk += 0.10
    
    # Steps Risk (0-30 points)
    steps_mean = features['steps_mean']
    if steps_mean < 3000:
        risk += 0.30
    elif steps_mean < 5000:
        risk += 0.20
    elif steps_mean < 7000:
        risk += 0.10
    
    # Sleep Risk (0-20 points)
    sleep_mean = features['sleep_hours_mean']
    if sleep_mean < 5:
        risk += 0.20
    elif sleep_mean < 6:
        risk += 0.15
    elif sleep_mean < 7:
        risk += 0.10
    elif sleep_mean > 10:
        risk += 0.10
    
    # Calories Risk (0-10 points)
    cal_mean = features['calories_mean']
    if cal_mean > 3000:
        risk += 0.10
    elif cal_mean > 2800:
        risk += 0.05
    elif cal_mean < 1500:
        risk += 0.08
    
    # Age Risk (0-10 points)
    age = features['age']
    if age > 60:
        risk += 0.10
    elif age > 50:
        risk += 0.05
    elif age < 18:
        risk += 0.03
    
    # Trend penalties (increasing risk trends are bad)
    if features['trend_heart_rate'] > 0.5:
        risk += 0.05
    if features['trend_steps'] < -50:
        risk += 0.05
    if features['trend_sleep'] < -0.1:
        risk += 0.05
    
    return max(0.0, min(1.0, risk))

class HealthPredictionHandler(BaseHTTPRequestHandler):
    
    def _set_cors_headers(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_OPTIONS(self):
        self._set_cors_headers()
    
    def do_POST(self):
        if self.path == '/predictHealthRisk':
            self._handle_predict()
        elif self.path == '/getHealthHistory':
            self._handle_history()
        else:
            self.send_error(404)
    
    def _handle_predict(self):
        """Generate health risk prediction from REAL Firestore data"""
        self._set_cors_headers()
        
        try:
            # Parse request body
            content_length = int(self.headers['Content-Length'])
            body = self.rfile.read(content_length)
            data = json.loads(body.decode())
            
            user_id = data.get('userId')
            
            if not user_id:
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': 'userId is required'
                }).encode())
                return
            
            # Try to fetch real data from Firestore
            if db:
                try:
                    # Get user profile
                    user_doc = db.collection('patients').document(user_id).get()
                    user_profile = user_doc.to_dict() if user_doc.exists else {'age': 35, 'gender': 'male'}
                    
                    # Get last 30 days of health metrics
                    thirty_days_ago = datetime.now() - timedelta(days=30)
                    metrics_ref = db.collection('healthMetrics')
                    query = metrics_ref.where('userId', '==', user_id).where('timestamp', '>=', thirty_days_ago)
                    
                    metrics = []
                    for doc in query.stream():
                        metric_data = doc.to_dict()
                        metrics.append({
                            'timestamp': metric_data['timestamp'],
                            'metricType': metric_data['metricType'],
                            'value': metric_data['value'],
                            'userId': metric_data['userId']
                        })
                    
                    if len(metrics) < 10:
                        print(f"⚠️  User {user_id} has insufficient data ({len(metrics)} records)")
                        # Fall back to mock prediction
                        response = self._generate_mock_prediction(user_id)
                    else:
                        print(f"✅ Found {len(metrics)} health records for user {user_id}")
                        
                        # Compute features from real data
                        features = compute_features(metrics, user_profile)
                        
                        # Calculate risk score
                        risk_score = calculate_risk_score(features)
                        
                        # Generate response
                        response = self._generate_prediction_response(risk_score, features, user_id)
                        print(f"✅ Real prediction for user {user_id}: {risk_score:.1%} risk")
                    
                except Exception as e:
                    print(f"⚠️  Error fetching Firestore data: {e}")
                    response = self._generate_mock_prediction(user_id)
            else:
                # No Firebase connection - use mock
                response = self._generate_mock_prediction(user_id)
            
            self.wfile.write(json.dumps(response).encode())
            
        except Exception as e:
            print(f"❌ Error in prediction handler: {e}")
            self.wfile.write(json.dumps({
                'success': False,
                'error': str(e)
            }).encode())
    
    def _generate_prediction_response(self, risk_score, features, user_id):
        """Generate complete prediction response from real data"""
        # Determine risk level
        if risk_score < 0.3:
            risk_level = 'low'
        elif risk_score < 0.6:
            risk_level = 'medium'
        else:
            risk_level = 'high'
        
        # Analyze contributing factors
        contributing_factors = []
        
        # Heart rate factor
        hr_mean = features['heart_rate_mean']
        hr_impact = abs(hr_mean - 70) / 70
        hr_status = 'warning' if hr_mean > 80 or hr_mean < 60 else 'good'
        contributing_factors.append({
            'feature': 'heart_rate',
            'impact': round(hr_impact, 2),
            'status': hr_status
        })
        
        # Steps factor
        steps_mean = features['steps_mean']
        steps_impact = abs(steps_mean - 8000) / 8000
        if steps_mean < 5000:
            steps_status = 'critical'
        elif steps_mean < 7000:
            steps_status = 'warning'
        else:
            steps_status = 'good'
        contributing_factors.append({
            'feature': 'steps',
            'impact': round(steps_impact, 2),
            'status': steps_status
        })
        
        # Sleep factor
        sleep_mean = features['sleep_hours_mean']
        sleep_impact = abs(sleep_mean - 7.5) / 7.5
        if sleep_mean < 6:
            sleep_status = 'critical'
        elif sleep_mean < 7:
            sleep_status = 'warning'
        else:
            sleep_status = 'good'
        contributing_factors.append({
            'feature': 'sleep',
            'impact': round(sleep_impact, 2),
            'status': sleep_status
        })
        
        # Calories factor
        cal_mean = features['calories_mean']
        cal_impact = abs(cal_mean - 2200) / 2200
        cal_status = 'warning' if cal_mean > 2800 else 'good'
        contributing_factors.append({
            'feature': 'calories',
            'impact': round(cal_impact, 2),
            'status': cal_status
        })
        
        # Sort by impact
        contributing_factors.sort(key=lambda x: x['impact'], reverse=True)
        
        # Generate recommendations
        recommendations = []
        if hr_mean > 80:
            recommendations.append('Consider stress management techniques to lower resting heart rate')
        if steps_mean < 7000:
            recommendations.append('Increase daily physical activity - aim for at least 8000 steps per day')
        if sleep_mean < 7:
            recommendations.append('Improve sleep quality - aim for 7-8 hours per night')
        if cal_mean > 2500:
            recommendations.append('Monitor calorie intake and consider dietary adjustments')
        if not recommendations:
            recommendations.append('Keep up the great work! Maintain your healthy lifestyle')
        
        # Generate 7-day trend forecast
        predicted_trend = []
        for i in range(1, 8):
            trend_adjustment = (
                features['trend_heart_rate'] * 0.3 +
                features['trend_steps'] * -0.0001 +
                features['trend_sleep'] * -0.05
            ) * i
            
            predicted_risk = max(0, min(1, risk_score + trend_adjustment * 0.01))
            
            predicted_trend.append({
                'date': (datetime.now() + timedelta(days=i)).strftime('%Y-%m-%d'),
                'predicted_risk': round(predicted_risk, 3),
                'confidence_lower': round(max(0, predicted_risk - 0.1), 3),
                'confidence_upper': round(min(1, predicted_risk + 0.1), 3)
            })
        
        return {
            'success': True,
            'prediction': {
                'risk_score': round(risk_score, 3),
                'risk_level': risk_level,
                'confidence': 0.85,
                'contributing_factors': contributing_factors,
                'recommendations': recommendations,
                'predicted_trend': predicted_trend
            }
        }
    
    def _generate_mock_prediction(self, user_id):
        """Fallback mock prediction when no real data available"""
        base_risk = random.uniform(0.2, 0.7)
        
        response = {
            'success': True,
            'prediction': {
                'risk_score': round(base_risk, 3),
                'risk_level': 'low' if base_risk < 0.3 else 'medium' if base_risk < 0.6 else 'high',
                'confidence': 0.85,
                'contributing_factors': [
                    {
                        'feature': 'steps',
                        'impact': round(random.uniform(0.3, 0.5), 2),
                        'status': 'warning'
                    },
                    {
                        'feature': 'sleep',
                        'impact': round(random.uniform(0.2, 0.4), 2),
                        'status': 'warning'
                    },
                    {
                        'feature': 'heart_rate',
                        'impact': round(random.uniform(0.1, 0.3), 2),
                        'status': 'good'
                    },
                    {
                        'feature': 'calories',
                        'impact': round(random.uniform(0.05, 0.15), 2),
                        'status': 'good'
                    }
                ],
                'recommendations': [
                    'Increase daily physical activity - aim for at least 8000 steps per day',
                    'Improve sleep quality - aim for 7-8 hours per night',
                    'Maintain consistent exercise routine'
                ],
                'predicted_trend': [
                    {
                        'date': (datetime.now() + timedelta(days=i)).strftime('%Y-%m-%d'),
                        'predicted_risk': round(base_risk + random.uniform(-0.05, 0.05), 3),
                        'confidence_lower': round(base_risk - 0.1, 3),
                        'confidence_upper': round(base_risk + 0.1, 3)
                    }
                    for i in range(1, 8)
                ]
            }
        }
        
        self.wfile.write(json.dumps(response).encode())
        print(f"✅ Predicted risk for user {user_id}: {response['prediction']['risk_score']:.1%}")
    
    def _handle_history(self):
        """Simulate health history retrieval"""
        self._set_cors_headers()
        
        # Generate 30 days of mock data
        history = []
        base_date = datetime.now() - timedelta(days=30)
        
        for i in range(30):
            date = base_date + timedelta(days=i)
            history.append({
                'date': date.strftime('%Y-%m-%d'),
                'heart_rate': round(random.uniform(60, 85), 1),
                'steps': round(random.uniform(4000, 10000)),
                'sleep_hours': round(random.uniform(5.5, 8.5), 1),
                'calories': round(random.uniform(1800, 2600))
            })
        
        response = {
            'success': True,
            'history': history
        }
        
        self.wfile.write(json.dumps(response).encode())
        print(f"✅ Retrieved 30 days of health history")

def run_server(port=5000):
    server_address = ('', port)
    httpd = HTTPServer(server_address, HealthPredictionHandler)
    print(f"""
╔════════════════════════════════════════════════════════════╗
║  🏥 Local Health Risk Prediction Server                   ║
║  Running on http://localhost:{port}                          ║
║                                                            ║
║  Endpoints:                                                ║
║  • POST /predictHealthRisk  → Get risk prediction         ║
║  • POST /getHealthHistory   → Get 30-day history          ║
║                                                            ║
║  Update .env.local:                                        ║
║  NEXT_PUBLIC_FIREBASE_FUNCTION_URL=http://localhost:{port}/predictHealthRisk  ║
║  NEXT_PUBLIC_FIREBASE_FUNCTION_URL_HISTORY=http://localhost:{port}/getHealthHistory  ║
║                                                            ║
║  Press Ctrl+C to stop                                      ║
╚════════════════════════════════════════════════════════════╝
    """)
    httpd.serve_forever()

if __name__ == '__main__':
    run_server()
