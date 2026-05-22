# TAA — Training Activity App

A personal gym tracking app built with React Native and Expo. Log your workouts, track your progress, and beat your personal records.

## Features

- **Today's Workout** — Opens to your scheduled exercises for the current day
- **Per-Set Tracking** — Log individual weight and reps for each set
- **Personal Records** — Automatically tracks your best lift per exercise
- **Progress Chart** — Visual weight progression across sessions
- **Weekly Schedule** — Assign exercises to specific days of the week
- **Drag to Reorder** — Long press to reorder exercises within a day
- **Move Day** — Swipe left on any exercise to move it to a different day
- **Session History** — Full log of every session with per-set breakdown
- **Edit & Delete** — Long press any history entry to correct or remove it
- **Rest Day Detection** — Shows a motivational message when no exercises are scheduled
- **Summary Tab** — Overview of total sessions, PRs, and weekly schedule

## Tech Stack

- **Framework** — React Native + Expo Router
- **Language** — TypeScript
- **Auth** — Firebase Authentication
- **Database** — Cloud Firestore
- **Animations** — React Native Reanimated
- **Gestures** — React Native Gesture Handler
- **Drag & Drop** — React Native Draggable FlatList
- **Charts** — React Native Chart Kit

## Project Structure

```
app/
├── (auth)/
│   ├── login.tsx
│   └── signup.tsx
├── (tabs)/
│   ├── home.tsx          # Today's workout
│   ├── exercises.tsx     # All exercises grouped by day
│   └── summary.tsx       # Stats and PR overview
├── exercise/
│   └── [id].tsx          # Exercise detail, logging, history
├── _layout.tsx
└── index.tsx
firebase/
├── config.ts
├── types.ts
└── exercises.ts
```

## Getting Started

### Prerequisites

- Node.js >= 20.19.4
- Expo CLI
- A Firebase project with Authentication and Firestore enabled

### Installation

```bash
git clone https://github.com/IvanAguilarJr/TAA-GymApp.git
cd TAA-GymApp
npm install
```

### Environment Variables

Create a `.env` file in the root of the project:

```
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### Firestore Security Rules

In your Firebase Console → Firestore → Rules, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Running the App

```bash
npx expo start --clear
```

Press `i` for iOS simulator or scan the QR code with Expo Go on your phone.

For a native build (required after adding new native packages):

```bash
npx expo run:ios
```

## Data Model

```
users/
└── {userId}/
    └── exercises/
        └── {exerciseId}/
            ├── name: string
            ├── sets: number
            ├── reps: number
            ├── day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun" | "None"
            ├── order: number
            ├── maxWeight: number
            ├── createdAt: string (ISO)
            └── history: [
                  {
                    date: string (ISO),
                    sets: [
                      { setNumber: number, weight: number, reps: number }
                    ]
                  }
                ]
```

## License

MIT
