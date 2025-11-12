# Health Monitoring Platform - Next.js Web Application

A comprehensive health monitoring and patient management system converted from Flutter to Next.js with shadcn/ui components.

## 🚀 Features

### For Patients
- **Dashboard**: View health metrics, daily tasks, and progress
- **Health Tracking**: Log glucose, blood pressure, heart rate, steps, and weight
- **Reminders**: Set up medication, exercise, and health check reminders
- **Gamification**: Earn points and badges for completing health tasks
- **Streak Tracking**: Maintain daily streaks for consistency

### For Doctors
- **Patient Management**: View and manage assigned patients
- **Health Monitoring**: Track patient readings and progress
- **Clinical Notes**: Add notes, recommendations, and diagnoses
- **Patient Insights**: AI-powered health insights and trends

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI Library**: shadcn/ui with Tailwind CSS
- **State Management**: Zustand
- **Backend**: Firebase (Authentication, Firestore)
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **Date Handling**: date-fns

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd scout2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   ```

4. **Set up Firebase**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project or use existing one
   - Enable Authentication (Email/Password)
   - Create Firestore database
   - Copy your Firebase config credentials

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🗄️ Firestore Collections

The application uses the following Firestore collections:

### Collections Structure
- `users` - User authentication metadata
- `patients` - Patient profiles and health data
- `doctors` - Doctor profiles and specializations
- `readings` - Health measurements (glucose, BP, steps, etc.)
- `reminders` - Task reminders with schedules
- `gamification` - Points, streaks, and badges
- `taskCompletions` - Daily task completion records
- `clinicalNotes` - Doctor notes and recommendations

## 📋 Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    // Users can only access their own data
    match /patients/{patientId} {
      allow read, write: if isAuthenticated() && isOwner(patientId);
    }
    
    match /readings/{readingId} {
      allow read, write: if isAuthenticated() && 
        resource.data.patientId == request.auth.uid;
    }
    
    match /reminders/{reminderId} {
      allow read, write: if isAuthenticated() && 
        resource.data.patientId == request.auth.uid;
    }
    
    // Add more rules as needed
  }
}
```

## 🎨 Project Structure

```
scout2/
├── app/
│   ├── (auth)/
│   │   └── login/          # Authentication pages
│   ├── (dashboard)/
│   │   ├── patient/        # Patient dashboard
│   │   └── doctor/         # Doctor dashboard
│   ├── layout.tsx          # Root layout with AuthProvider
│   └── page.tsx            # Home page with routing logic
├── components/
│   ├── providers/          # Context providers
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── services/           # Firebase services
│   ├── store/              # Zustand stores
│   ├── firebase.ts         # Firebase configuration
│   └── utils.ts            # Utility functions
├── types/
│   └── index.ts            # TypeScript interfaces
└── public/                 # Static assets
```

## 🔐 Authentication

The app supports role-based authentication:
- **Patients**: Can track health, set reminders, and view progress
- **Doctors**: Can manage patients and view health data

## 🎯 Key Features Implementation

### 1. Real-time Updates
Using Firestore's `onSnapshot` for live data synchronization:
```typescript
FirestoreService.subscribeToReadings(userId, (readings) => {
  setReadings(readings);
});
```

### 2. Gamification System
- Points awarded for completing tasks (10-20 points per task)
- Streak tracking for daily consistency
- Badge system for achievements

### 3. Health Data Entry
Support for multiple health metrics:
- Glucose levels (mg/dL)
- Blood pressure (systolic/diastolic)
- Heart rate (bpm)
- Steps (daily count)
- Weight (kg)

## 🚀 Deployment

### Deploy to Vercel
```bash
npm run build
vercel deploy
```

### Environment Variables
Make sure to add all Firebase environment variables in your deployment platform.

## 📝 TODO / Future Enhancements

- [ ] Add charts and data visualization with Recharts
- [ ] Implement doctor-patient assignment system
- [ ] Add clinical notes and recommendations
- [ ] Integrate with wearable devices (Google Fit, Apple Health)
- [ ] Add ABDM (Ayushman Bharat Digital Mission) integration
- [ ] Implement notifications system
- [ ] Add profile customization
- [ ] Export health data as PDF/CSV
- [ ] Add medication reminders with push notifications
- [ ] Implement doctor appointment scheduling

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- Original Flutter app: [Scouts2](https://github.com/ErwinJ1299/Scouts2)
- UI components: [shadcn/ui](https://ui.shadcn.com/)
- Firebase for backend services
- Next.js team for the amazing framework

## 📞 Support

For issues or questions, please open an issue in the GitHub repository.

---

**Note**: This is a conversion of the Flutter health monitoring app to a Next.js web application. Make sure to configure Firebase properly before running the application.
