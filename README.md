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
- **Settings** — Edit display name, weight unit (kg/lbs), email, and password
- **Google Sign-In** — OAuth via `@react-native-google-signin/google-signin`
- **Unified Sign-Out** — Signs out of both Firebase and Google simultaneously

## Tech Stack

- **Framework** — React Native + Expo Router
- **Language** — TypeScript
- **Auth** — Firebase Authentication (email/password + Google OAuth)
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
├── settings.tsx          # Profile, account, and danger zone
├── _layout.tsx
└── index.tsx
firebase/
├── config.ts
├── types.ts
├── exercises.ts
├── profile.ts            # User profile CRUD
└── googleAuth.ts         # Google Sign-In + unified sign-out
```

## Getting Started

### Prerequisites

- Node.js >= 20.19.4
- Expo CLI
- A Firebase project with Authentication and Firestore enabled
- Google OAuth credentials (Web Client ID + iOS Client ID)

### Installation

```bash
git clone https://github.com/IvanAguilarJr/TAA-GymApp.git
cd TAA-GymApp
npm install
```

### Environment Variables

Create a `.env` file in the root of the project:

```
# Firebase
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Google OAuth
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_web_client_id
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your_ios_client_id
```

**Where to find the Google OAuth credentials:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. **Web Client ID** — the OAuth 2.0 client of type "Web application" (also shown in Firebase Console → Authentication → Sign-in method → Google)
3. **iOS Client ID** — the OAuth 2.0 client of type "iOS" created for your bundle ID

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
    ├── profile/
    │   └── settings/
    │       ├── displayName: string
    │       ├── photoURL: string | null
    │       ├── weightUnit: "kg" | "lbs"
    │       ├── createdAt: number (Unix ms)
    │       └── updatedAt: number (Unix ms)
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

### Profile model notes

- Created automatically on first sign-up (email) or first Google login
- `weightUnit` defaults to `"kg"` and is editable in Settings
- `photoURL` is stored but currently unused in the UI (reserved for future avatar support)
- Google sign-in bootstraps the profile from the Google account's `displayName`; email sign-up uses the name entered at registration

## Auth Flows

| Flow                        | Profile created? | How                                                                             |
| --------------------------- | ---------------- | ------------------------------------------------------------------------------- |
| Email sign-up               | Yes              | `createUserProfile(uid, displayName)` called immediately after account creation |
| Email sign-in               | No               | Profile already exists from sign-up                                             |
| Google sign-in (first time) | Yes              | Bootstrapped from Google account data if `profile/settings` doesn't exist       |
| Google sign-in (returning)  | No               | Profile exists, skipped                                                         |

Sign-out calls both `firebaseSignOut` and `GoogleSignin.signOut()` together, so the Google account picker appears fresh on the next login.

## License

MIT
