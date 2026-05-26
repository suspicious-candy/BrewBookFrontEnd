# BrewBook

A cross-platform mobile app for logging coffee brews, tracking beans and brewers, and journaling tasting notes. Built with Expo and React Native, with a Supabase backend.

> Brew, log, refine. Keep a record of every cup so the next one is better.

---

## Features

- **Bean inventory** — track origin, roast date, and roaster details with search and A–Z sort
- **Brewer inventory** — manage your kit (V60, Aeropress, espresso machine, etc.) and link recipes to each
- **Guided brew flow** — pick a bean, configure parameters (dose, ratio, temperature, grind), and log the session
- **Tasting notes journal** — record flavor notes per brew with filters by bean and brewer
- **Dashboard** — at-a-glance view of your last brew and daily stats
- **Authentication** — email/password sign-in backed by Supabase Auth
- **Runs on iOS, Android, and web** from a single codebase

---

## Tech stack

| Layer            | Technology                                       |
| ---------------- | ------------------------------------------------ |
| Framework        | [Expo](https://expo.dev) SDK 54, React Native 0.81 |
| Language         | TypeScript / JSX                                 |
| Routing          | [Expo Router 6](https://docs.expo.dev/router/introduction/) (file-based) |
| Auth & data      | [Supabase](https://supabase.com) (`@supabase/supabase-js`) |
| Data fetching    | [TanStack Query v5](https://tanstack.com/query) + [Axios](https://axios-http.com) |
| State            | [Zustand](https://zustand-demo.pmnd.rs)          |
| Storage          | `@react-native-async-storage/async-storage`      |
| Platforms        | iOS · Android · Web                              |

---

## Project structure

```
src/
├── app/                         # Expo Router file-based routes
│   ├── _layout.jsx              # Root layout — AuthProvider, theme
│   ├── (tabs)/
│   │   ├── _layout.jsx          # Bottom tab navigator
│   │   ├── (home)/index.jsx     # Dashboard
│   │   ├── BeanInventory/       # Bean list + detail
│   │   ├── BrewerInventory/     # Brewer list + detail
│   │   ├── Notes/               # Tasting notes journal
│   │   └── User/                # Profile
│   ├── Brew/                    # Brew flow (select → configure → session → log)
│   ├── Recipe/                  # Recipe editor
│   └── Login/                   # Login, create account, forgot password
├── auth/
│   ├── AuthContext.tsx          # AuthProvider + useAuth hook
│   ├── api.ts                   # Axios instance with bearer-token interceptor
│   └── config.ts                # Supabase client
├── components/                  # Shared UI (themed text/view, tab bar, etc.)
├── constants/theme.ts           # Color palette + spacing scale
└── hooks/                       # use-theme, use-color-scheme
```

---

## Getting started

### Prerequisites

- Node.js 18+
- npm (or yarn / pnpm)
- A [Supabase](https://supabase.com) project (free tier works)
- One of:
  - iOS Simulator (macOS only) via Xcode
  - Android Emulator via Android Studio
  - The [Expo Go](https://expo.dev/go) app on a physical device

### 1. Install

```bash
git clone <your-fork-url>
cd BrewBook
npm install
```

### 2. Configure environment

Secrets are loaded from a local `.env` file (gitignored) and injected into `Constants.expoConfig.extra` at build time via [`app.config.js`](app.config.js).

Copy the template and fill in your own values:

```bash
cp .env.example .env
```

```dotenv
# .env
EXPO_PUBLIC_API_BASE_URL=http://localhost:5001
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

| Variable                          | Description                                                                 |
| --------------------------------- | --------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_BASE_URL`        | Base URL of the BrewBook API server                                         |
| `EXPO_PUBLIC_SUPABASE_URL`        | Your Supabase project URL (`https://<ref>.supabase.co`)                     |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`   | Your Supabase project's public anon key (safe to ship in the client bundle) |

> **Android emulator:** the emulator cannot reach `localhost` on your machine. Use `http://10.0.2.2:<port>` for `EXPO_PUBLIC_API_BASE_URL`, or your machine's LAN IP when testing on a physical device on the same network.

### 3. Run

```bash
npm start          # Start the Expo dev server (pick a platform interactively)

npm run ios        # iOS simulator (macOS only)
npm run android    # Android emulator
npm run web        # Browser
```

---

## Authentication

Auth is handled by Supabase via `@supabase/supabase-js`:

- `src/auth/config.ts` creates the Supabase client with AsyncStorage as the session store and auto-refresh enabled.
- `src/auth/AuthContext.tsx` exposes `useAuth()` with `session`, `user`, `isAuthenticated`, `signIn`, `signUp`, and `signOut`.
- `src/auth/api.ts` is a pre-configured Axios instance that attaches `Authorization: Bearer <access_token>` to every request, refreshing the session token as needed.

```ts
import { api } from '@/auth/api';

const { data } = await api.get('/beans');
```

---

## Scripts

| Command            | What it does                          |
| ------------------ | ------------------------------------- |
| `npm start`        | Start the Expo dev server             |
| `npm run ios`      | Open in iOS simulator                 |
| `npm run android`  | Open in Android emulator              |
| `npm run web`      | Open in browser                       |
| `npm run lint`     | Run Expo's ESLint config              |
| `npm run reset-project` | Reset the starter project state  |

---

## Contributing

Pull requests are welcome. For larger changes, please open an issue first to discuss the direction.

1. Fork the repo and create your branch from `main`
2. Run `npm install`, copy `.env.example` → `.env`, and add your own Supabase credentials
3. Make your changes and ensure `npm run lint` passes
4. Open a PR with a clear description of what changed and why

---

## License

Released under the [MIT License](LICENSE).
