# 🏥 Medora- AI-Powered Health Monitoring Platform

> **Transforming chronic disease management through AI, gamification, and seamless doctor-patient collaboration**

[![Next.js](https://img.shields.io/badge/Next.js-16.0-black)](https://nextjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-11.1-orange)](https://firebase.google.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [Features Documentation](#-features-documentation)
- [API Endpoints](#-api-endpoints)
- [Future Roadmap](#-future-roadmap)
- [Demo Credentials](#-demo-credentials)
- [Contributing](#-contributing)

---

## 🎯 Overview

**HealthVerse** is a comprehensive health monitoring platform that bridges the gap between patients and healthcare providers through intelligent automation, real-time health tracking, and gamified wellness engagement. Our platform addresses the critical challenge of chronic disease management by making health monitoring engaging, rewarding, and accessible.

### The Problem We Solve
- 📊 **Poor Health Tracking**: Patients struggle to consistently monitor vital health metrics
- 🔗 **Disconnected Care**: Limited communication between patients and doctors
- 😴 **Low Engagement**: Traditional health apps have <15% user retention after 30 days
- 💰 **High Healthcare Costs**: Preventable chronic diseases cost billions annually

### Our Solution
- ✅ **Effortless Tracking**: Simple, fast health data logging with real-time alerts
- 🤝 **Connected Care**: Direct doctor-patient communication and remote consultations
- 🎮 **Gamified Engagement**: 300% higher retention through rewards and achievements
- 🤖 **AI-Powered Insights**: Predictive health analytics and 24/7 AI health coaching

---

## ✨ Key Features

### 🏠 For Patients

#### 1. **Smart Health Dashboard**
- Real-time health metrics tracking (glucose, BP, heart rate, weight)
- Interactive charts with trend analysis
- Instant alerts for abnormal readings
- Daily health tasks and reminders

#### 2. **AI Health Prediction**
- Machine learning-powered 7-day health risk forecasting
- Personalized risk assessments with confidence intervals
- Contributing factor analysis
- Actionable recommendations

#### 3. **24/7 AI Health Coach**
- Powered by Google Gemini AI
- Context-aware responses using patient health history
- Instant answers to health questions
- Personalized guidance and support

#### 4. **Gamification & Rewards System**
- **Health Points**: Earn points for logging data, completing tasks, maintaining streaks
- **Progression Levels**: 6 tiers from Beginner (0-99 pts) to Legend (2500+ pts)
- **Achievements & Badges**: Unlock milestones and showcase progress
- **Wellness Coins**: Convert points to real currency for marketplace purchases
- **Outcome-Based Rewards**: Automatic bonuses for improved health metrics

#### 5. **Wellness Marketplace**
- Redeem Wellness Coins for real products
- Fitness trackers, supplements, gym memberships
- Health books, equipment, and wellness services
- Integrated order management and tracking

#### 6. **Wearable Device Integration**
- Fitbit, Apple Watch, Garmin synchronization
- Automatic data syncing for steps, heart rate, sleep
- Real-time activity monitoring

#### 7. **Connected Care**
- Send doctor connection requests
- Secure messaging with healthcare providers
- Medication reminders and management
- Health reports and history sharing

### 👨‍⚕️ For Doctors

#### 1. **Doctor Dashboard**
- Centralized patient management
- Real-time health alerts and notifications
- Patient request management
- Quick access to patient metrics

#### 2. **Patient Health Monitoring**
- Comprehensive health metrics overview
- Historical data with trend analysis
- Color-coded risk indicators
- Critical alert notifications

#### 3. **Digital Prescription System**
- Create and manage prescriptions digitally
- Automated drug interaction checks
- E-prescription delivery to patients
- One-click refill approvals

#### 4. **Telemedicine**
- Built-in video consultation system
- HIPAA-compliant communication
- Screen sharing and recording capabilities
- Session scheduling and management

#### 5. **Clinical Notes**
- Comprehensive medical record keeping
- Treatment plans and progress notes
- Diagnosis documentation
- Searchable patient history

#### 6. **Smart Medicine Ordering**
- Patients can request prescription refills
- Automated approval workflow
- Order tracking and fulfillment
- Integration with pharmacy systems

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: Radix UI + shadcn/ui
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts + ECharts
- **Animations**: Framer Motion

### Backend
- **Database**: Firebase Firestore (NoSQL)
- **Authentication**: Firebase Auth
- **Storage**: Firebase Storage
- **Functions**: Firebase Cloud Functions
- **Real-time**: Firebase Realtime Database

### AI & Machine Learning
- **AI Chat**: Google Gemini API
- **Health Prediction**: Custom ML model (Python + scikit-learn)
- **Model Training**: TensorFlow/Keras
- **Data Processing**: NumPy, Pandas

### Additional Technologies
- **Video Calls**: WebRTC
- **Real-time Communication**: Firebase
- **API Integration**: Axios
- **Date Handling**: date-fns
- **Icons**: Lucide React

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18 or higher)
- **npm** or **yarn** or **pnpm**
- **Firebase Account** (for backend services)
- **Google Gemini API Key** (for AI features)

### Installation Steps

#### 1. Clone the Repository
```bash
git clone https://github.com/ErwinJ1299/scout2.git
cd scout2
npm install
```

#### 2. Environment Setup

Create a `.env.local` file in the root directory:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin (for server-side operations)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourPrivateKeyHere\n-----END PRIVATE KEY-----\n"

# Google Gemini AI
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
GEMINI_API_KEY=your_gemini_api_key
```

#### 3. Firebase Setup

1. **Create a Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Firestore Database
   - Enable Firebase Authentication (Email/Password)
   - Enable Firebase Storage

2. **Deploy Firestore Rules & Indexes**
```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

3. **Deploy Firebase Functions** (Optional)
```bash
cd firebase-functions
npm install
firebase deploy --only functions
```

#### 4. Initialize Gamification System

Run this once to set up the gamification collections:
```bash
# Visit in browser after starting dev server
http://localhost:3000/api/init-gamification
```

#### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
scout4/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Authentication routes
│   │   ├── login/
│   │   └── register/
│   ├── api/                      # API routes
│   │   ├── gemini/               # AI chat endpoint
│   │   ├── health-prediction/    # ML prediction APIs
│   │   ├── init-gamification/    # Setup endpoints
│   │   └── wearables/            # Wearable integration
│   ├── patient/                  # Patient portal
│   │   ├── dashboard/
│   │   ├── health-prediction/
│   │   ├── progress/
│   │   ├── wallet/
│   │   ├── marketplace/
│   │   └── wearables/
│   ├── doctor/                   # Doctor portal
│   │   ├── dashboard/
│   │   ├── patients/
│   │   ├── prescriptions/
│   │   └── video-call/
│   └── healthcoach/              # AI Coach interface
│
├── components/                   # React components
│   ├── ui/                       # Reusable UI components
│   ├── charts/                   # Chart components
│   ├── providers/                # Context providers
│   ├── challenges/               # Gamification components
│   └── medicines/                # Prescription components
│
├── lib/                          # Utilities and libraries
│   ├── store/                    # Zustand stores
│   ├── firebase/                 # Firebase config
│   └── utils.ts                  # Helper functions
│
├── firebase-functions/           # Cloud Functions
├── ml-model/                     # Machine Learning model
├── types/                        # TypeScript definitions
├── public/                       # Static assets
└── scripts/                      # Utility scripts
```

---

## 📚 Features Documentation

### Patient Journey

#### 1. Registration & Onboarding
- Navigate to `/register`
- Fill in: Name, Email, Password, Age, Gender
- Select Role: "Patient"
- Complete health profile setup

#### 2. Daily Health Tracking
- Dashboard → "Add Reading"
- Enter: Glucose, Blood Pressure, Heart Rate, Weight
- System automatically validates ranges, triggers alerts, awards points

#### 3. Earning Rewards
- **+10 points**: Log health reading
- **+5 points**: Complete daily task
- **+20 points**: Maintain 7-day streak
- **+50 points**: Achieve health goal
- **Outcome Bonuses**: Glucose decrease, weight loss, BP improvement

#### 4. Connect with Doctor
- Dashboard → "Doctors"
- Search by specialty or name
- Send connection request
- Once accepted: message, share data, schedule video calls

### Doctor Journey

#### 1. Patient Management
- Dashboard → View all patients
- Accept connection requests
- Monitor real-time metrics
- Receive critical alerts

#### 2. Prescribe Medicine
- Patient View → "Prescribe Medicine"
- Search medication database
- Add dosage, frequency, duration
- System checks drug interactions

#### 3. Video Consultation
- Dashboard → "Start Video Call"
- Enter patient ID or select from list
- High-quality WebRTC connection

### AI Features

#### AI Health Coach
- Navigate to `/healthcoach`
- Ask any health question
- AI responds using your health history and medical knowledge

#### Health Prediction
- Navigate to `/patient/health-prediction`
- Click "Get Prediction"
- System analyzes last 30 days
- Returns 7-day risk forecast with recommendations

---

## 🔌 API Endpoints

### Authentication
```
POST /api/auth/register    # User registration
POST /api/auth/login       # User login
```

### Health Data
```
POST /api/health/readings       # Add health reading
GET  /api/health/readings/:id   # Get user readings
```

### AI & Predictions
```
POST /api/gemini                              # AI chat
POST /api/health-prediction/predict           # Generate prediction
POST /api/health-prediction/history           # Get historical data
```

### Gamification
```
POST /api/gamification/award-points           # Award points
GET  /api/gamification/progress               # Get progress
POST /api/gamification/outcome-rewards        # Award bonuses
```

### Doctor-Patient
```
POST /api/doctor/prescribe     # Create prescription
GET  /api/doctor/patients      # Get patients
POST /api/patient/connect      # Send connection request
```

### Marketplace
```
GET  /api/marketplace/products  # Get items
POST /api/marketplace/purchase  # Purchase with coins
GET  /api/wallet                # Get balance
```

---

## 🎮 Demo Credentials

### Test Patient Account
```
Email: patient@test.com
Password: test123456
```

### Test Doctor Account
```
Email: doctor@test.com
Password: test123456
```

**Note**: Create your own accounts for full feature testing!

---

## 🚀 Future Roadmap

### Phase 1 (Next 6 months)
- **ABDM Integration**: Connect with India's Ayushman Bharat Digital Mission
- **Advanced AI**: Multi-disease prediction
- **Mental Health Module**: Mood tracking, teletherapy
- **Corporate Wellness**: B2B SaaS for enterprises

### Phase 2 (6-12 months)
- **Insurance Integration**: Dynamic premiums
- **Hospital EHR Integration**
- **IoT Expansion**: Smart devices
- **Emergency Care**: SOS with health data

### Phase 3 (1-2 years)
- **Blockchain Health Records**
- **Genomics Integration**
- **AR/VR Telemedicine**
- **Clinical Trials Platform**

---

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 👥 Team

**Project Lead**: Siddhesh Jejurkar  
**Repository**: [scout2](https://github.com/ErwinJ1299/scout2)

---

## 🙏 Acknowledgments

- **Next.js Team**: Amazing React framework
- **Firebase**: Robust backend infrastructure
- **Google Gemini**: Powerful AI capabilities
- **shadcn/ui**: Beautiful UI components
- **Open Source Community**: Invaluable tools

---

## 🎉 Quick Start Summary

```bash
# 1. Clone and install
git clone https://github.com/ErwinJ1299/scout2.git
cd scout2
npm install

# 2. Setup environment
cp .env.local.example .env.local
# Edit .env.local with your credentials

# 3. Initialize Firebase
firebase deploy --only firestore:rules

# 4. Start development
npm run dev

# 5. Initialize gamification
# Visit: http://localhost:3000/api/init-gamification
```

**You're ready to go! 🚀**

---

<div align="center">

**Built with ❤️ for better healthcare**

⭐ Star us on GitHub if you find this project useful!

</div>
