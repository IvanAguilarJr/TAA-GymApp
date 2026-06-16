# QINETIC — Training Activity App

A personal gym tracking app built with React Native and Expo. Log your workouts, track your progress, and beat your personal records.

## Features

- **Today's Workout** — Opens to your scheduled exercises for the current day
- **Per-Set Tracking** — Log individual weight and reps for each set
- **Personal Records** — Automatically tracks your best lift per exercise
- **Progress Chart** — Visual weight progression across sessions
- **Weekly Schedule** — Assign exercises to specific days of the week
- **Session History** — Full log of every session with per-set breakdown
- **Edit & Delete** — Long press any history entry to correct or remove it
- **Rest Day Detection** — Shows a motivational message when no exercises are scheduled
- **Streak Tracking** — Consecutive training days based on scheduled completion
- **Notes** — Add a daily workout note, viewable in the Summary tab
- **Summary Tab** — Overview of total sessions, PRs, weekly schedule, and notes
- **Settings** — Edit display name, weight unit (kg/lbs), profile photo, email, and password
- **Google Sign-In** — OAuth via `@react-native-google-signin/google-signin` + Supabase
- **Account Deletion** — Full data wipe via a Supabase Edge Function

## Tech Stack

- **Framework** — React Native + Expo Router
- **Language** — TypeScript
- **Auth** — Supabase Auth (email/password + Google OAuth via native ID-token exchange)
- **Database** — Supabase (PostgreSQL)
- **Storage** — Supabase Storage (private `profile-pictures` bucket)
- **Server Logic** — Supabase Edge Functions (account deletion)
- **Animations** — React Native Reanimated
- **Gestures** — React Native Gesture Handler
- **Charts** — React Native Chart Kit

## Project Structure

```
app/
├── (auth)/
│   ├── login.tsx          # Email/password + Google Sign-In
│   ├── signup.tsx         # Email/password registration
│   └── verify-email.tsx   # Post-signup email verification
├── (tabs)/
│   ├── home.tsx           # Today's workout + streak + notes
│   ├── exercises.tsx      # All exercises grid
│   ├── schedule.tsx       # Weekly schedule builder
│   └── summary.tsx        # Stats, PRs, notes, and schedule overview
├── exercise/
│   └── [id].tsx           # Exercise detail, logging, history, chart
├── context/
│   └── WeightUnitContext.tsx  # kg/lbs conversion context (reads from profiles table)
├── settings.tsx           # Profile, account, and danger zone
└── _layout.tsx            # Session-gated routing via supabase.auth.onAuthStateChange
lib/
├── supabase.ts            # Supabase client (AsyncStorage persistence)
├── types.ts               # Shared TypeScript types (Exercise, Day, SetEntry, WeightEntry)
├── streaks.ts             # Streak calculation logic (pure TS, no server calls)
└── googleAuth.ts          # Google Sign-In adapter (native SDK → Supabase ID-token exchange)
supabase/
├── exercises.ts           # Exercise CRUD + session logging against Supabase
├── notes.ts               # Daily notes upsert/fetch
├── profile.ts             # User profile read/write (profiles table)
├── storage.ts             # Profile photo upload → signed URL
└── functions/
    └── delete-account/
        └── index.ts       # Edge Function: JWT verify → storage delete → admin.deleteUser (cascades DB)
```

## Getting Started

### Prerequisites

- Node.js >= 20.19.4
- Expo CLI
- A Supabase project with the schema from `supabase_schema.sql`
- Google OAuth credentials (Web Client ID + iOS Client ID) configured in Supabase Auth → Providers → Google

### Installation

```bash
git clone https://github.com/IvanAguilarJr/TAA-GymApp.git
cd TAA-GymApp
npm install
```

### Environment Variables

Create a `.env` file in the root of the project:

```
# Google Sign-In iOS
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_web_client_id
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your_ios_client_id
EXPO_PUBLIC_GOOGLE_IOS_REVERSED_CLIENT_ID=com.googleusercontent.apps.<your_ios_client_id_without_prefix>

# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

**Where to find credentials:**

1. **Supabase URL + Anon Key** — Supabase Dashboard → Project Settings → API
2. **Google Web Client ID** — Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client (type: Web)
3. **Google iOS Client ID** — same page, OAuth 2.0 Client (type: iOS, for your bundle ID)
4. Enable Google as a provider in Supabase Dashboard → Authentication → Providers → Google, and paste the Web Client ID + Secret there

### Database Setup

Run `supabase_schema.sql` against your Supabase project:

```bash
supabase db push   # or paste into the Supabase SQL editor
```

The schema creates:
- `profiles` — auto-created via trigger on `auth.users` INSERT
- `exercises` — per-user exercise definitions with schedule days and max weight
- `set_entries` — individual logged sets; grouped by `logged_at` timestamp into sessions
- `notes` — one note per user per date (UNIQUE constraint)

Row Level Security is enabled on all tables. All deletes cascade from `auth.users`.

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

### Supabase schema (simplified)

```
profiles          (id FK→auth.users, display_name, photo_url, weight_unit)
exercises         (id, user_id FK, name, target_sets, target_reps, max_weight, days[], order, muscle_tag, type_tag, emoji)
set_entries       (id, exercise_id FK→exercises, set_number, weight, reps, logged_at)
notes             (id, user_id FK, date, text, UNIQUE(user_id, date))
```

Sessions are implicit: all `set_entries` sharing the same `logged_at` timestamp belong to one session.

## Auth Flows

| Flow | What happens |
|---|---|
| Email sign-up | `supabase.auth.signUp` → confirmation email sent → user lands on verify-email screen |
| Email confirmation | User clicks link in email → account active → directed to sign in |
| Email sign-in | `supabase.auth.signInWithPassword` → `onAuthStateChange` flips layout to tabs |
| Unconfirmed sign-in | Error contains "email not confirmed" → routed to verify-email with resend option |
| Google sign-in | Native Google Sign-In → ID token exchanged with `supabase.auth.signInWithIdToken` |
| Sign-out | `supabase.auth.signOut()` + `GoogleSignin.signOut()` → `onAuthStateChange(null)` → back to login |
| Delete account | Edge Function: JWT verify → storage objects deleted → `admin.deleteUser` (DB cascade) → client signs out |

## License

MIT
