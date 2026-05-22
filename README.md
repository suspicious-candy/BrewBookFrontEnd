# BrewBook — Mobile App

React Native / Expo frontend for the BrewBook coffee tracking platform. Connects to the [BrewBook API](../../BrewBook/README.md) for data and uses its OAuth 2.0 + PKCE server for authentication.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo 54 (SDK), React Native 0.81 |
| Language | TypeScript / JSX |
| Routing | Expo Router 6 (file-based) |
| Auth | OAuth 2.0 + PKCE via `expo-auth-session` |
| Token storage | `expo-secure-store` (native) / `localStorage` (web) |
| Data fetching | TanStack React Query v5 + Axios |
| State | Zustand |
| Platform | iOS, Android, Web |

---

## Project Structure

```
src/
├── app/
│   ├── _layout.tsx              # Root layout — wraps AuthProvider + ThemeProvider
│   ├── (home)/
│   │   └── index.jsx            # Dashboard — last brew, daily stats, quick actions
│   ├── BeanInventory/
│   │   ├── BeanInventory.jsx    # Bean grid with search + A-Z sort
│   │   ├── [BeanId].jsx         # Bean detail
│   │   └── _layout.jsx
│   ├── BrewerInventory/
│   │   ├── BrewerInventory.jsx  # Brewer list
│   │   ├── [BrewerId].jsx       # Brewer detail
│   │   └── _layout.jsx
│   ├── Brew/
│   │   ├── selection.jsx        # Step 1 — pick a bean for a recipe
│   │   ├── config.jsx           # Step 2 — adjust brew parameters (dose, temp, grind…)
│   │   ├── session.jsx          # Step 3 — live brew timer  ⚠️ NOT IMPLEMENTED
│   │   └── setup.jsx            # Step 4 — post-brew setup  ⚠️ NOT IMPLEMENTED
│   ├── Notes/
│   │   ├── Index.jsx            # Journal — list with bean/brewer filters
│   │   └── [NotesId].jsx        # Note detail
│   ├── Login/
│   │   ├── Login.jsx            # Login screen (triggers OAuth PKCE flow)
│   │   ├── createAccount.jsx    # Create account screen
│   │   └── forgotPassword.jsx   # Forgot password screen
│   └── User/
│       └── [UserId].jsx         # User profile
├── auth/
│   ├── AuthContext.tsx          # AuthProvider, useAuth hook, refreshTokens()
│   ├── api.ts                   # Axios instance with Bearer token + auto-refresh interceptors
│   ├── config.ts                # OAuth discovery, redirect URI, server URLs
│   └── tokenStore.ts           # Token persistence (SecureStore / localStorage)
├── components/
│   ├── app-tabs.tsx             # Bottom tab bar (native)
│   ├── app-tabs.web.tsx         # Bottom tab bar (web)
│   └── ui/collapsible.tsx
├── constants/
│   └── theme.ts                 # Color palette, font stack, spacing scale
└── hooks/
    ├── use-color-scheme.ts
    └── use-theme.ts
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli` (or use `npx expo`)
- iOS Simulator (macOS) or Android Emulator, or the [Expo Go](https://expo.dev/go) app
- The [BrewBook API](../../BrewBook/README.md) running locally

### Install

```bash
cd Brew/BrewBook
npm install
```

### Configure

The app reads server URLs from `app.json` under `expo.extra`:

```json
"extra": {
  "authServerUrl": "http://localhost:3000",
  "resourceServerUrl": "http://localhost:5001",
  "clientId": "demo-client"
}
```

> **Android emulator note:** The emulator cannot reach `localhost` on your machine. The app automatically swaps to `http://10.0.2.2` on Android when no `authServerUrl` is set in `app.json`.

### Run

```bash
# Start the Expo dev server (choose platform in the terminal)
npm start

# Open directly on a platform
npm run ios      # iOS simulator (macOS only)
npm run android  # Android emulator
npm run web      # Browser
```

---

## Authentication Flow

The app implements **OAuth 2.0 Authorization Code + PKCE** using `expo-auth-session`:

1. User taps **Login** → `AuthContext.signIn()` calls `promptAsync()` which opens the OAuth authorize URL in a browser
2. Auth server redirects back to `brewbook://callback` with an authorization code
3. `AuthContext` exchanges the code for tokens via `POST /oauth/token`
4. Tokens (access + refresh) are persisted to `expo-secure-store` (or `localStorage` on web)
5. Every API request via `src/auth/api.ts` attaches `Authorization: Bearer <token>` automatically
6. On a 401 response the interceptor silently refreshes the token once before retrying

---

## API Client

Import the pre-configured Axios instance from `src/auth/api.ts`:

```ts
import { api } from '@/auth/api';

const { data } = await api.get('/beans');
```

> **Note:** Several screens currently import from `@/src/api/client` which **does not exist** — this is a bug (see Known Issues below).

---

## Screens Overview

| Screen | Route | Status |
|---|---|---|
| Login | `/Login/Login` | Working — triggers OAuth PKCE |
| Dashboard | `/(home)` | UI done; calls `/dashboard` endpoint (not on backend yet) |
| Bean Inventory | `/BeanInventory/BeanInventory` | Working |
| Bean Detail | `/BeanInventory/[BeanId]` | Working |
| Brewer Inventory | `/BrewerInventory/BrewerInventory` | Working |
| Brewer Detail | `/BrewerInventory/[BrewerId]` | Working |
| Brew — Select Bean | `/Brew/selection` | Working |
| Brew — Configure | `/Brew/config` | Working |
| Brew — Session | `/Brew/session` | Not implemented |
| Brew — Setup | `/Brew/setup` | Not implemented |
| Notes Journal | `/Notes/Index` | Working |
| Note Detail | `/Notes/[NotesId]` | Working |
| User Profile | `/User/[UserId]` | Working |
| Create Account | `/Login/createAccount` | UI only |
| Forgot Password | `/Login/forgotPassword` | UI only |

---

## Known Issues / Bugs

| # | Severity | Location | Description |
|---|---|---|---|
| 1 | **Crash** | `(home)/index.jsx`, `BeanInventory.jsx`, `config.jsx`, `Notes/Index.jsx`, `selection.jsx` | All import `apiClient from '@/src/api/client'` — this file does not exist. Should be `import { api } from '@/auth/api'` |
| 2 | **Crash** | `(home)/index.jsx:64` | Destructures `isHydrating` from `useAuth()` but the context exports `isReady`. `isHydrating` is always `undefined`, so `!isHydrating` is always `true`, which immediately redirects unauthenticated users |
| 3 | **Logic** | `Login/Login.jsx` | Email and access code inputs are rendered and collected but never passed to the auth flow — `signIn()` launches the OAuth browser regardless of what the user typed |
| 4 | **Missing** | `Brew/session.jsx`, `Brew/setup.jsx` | Files exist but are empty (1 line). The live brew timer and post-brew setup screens are not implemented |
| 5 | **Backend** | `(home)/index.jsx` | Dashboard calls `GET /dashboard` which is not an endpoint on the API server |
| 6 | **Logic** | `Brew/config.jsx:73` | `fetchBrewer(brewerId ?? recipe?.Brewer)` — `recipe.Brewer` is a MongoDB ObjectId string, but the backend's `GET /brewers/:id` expects a numeric `BrewerID`. This call will always 404 |
| 7 | **Logic** | `Notes/Index.jsx` | Filters and display rely on `note.Recipe?.Brewer?.Name` and `note.Recipe?.bean?.Name` being populated, but `GET /notes` does not populate nested refs — these fields will always be `undefined` |

---

## TODO List

### Bugs to fix (blocking)

- [ ] Create `src/api/client.ts` that re-exports the `api` instance from `src/auth/api.ts` as a default export, **or** update all five import sites to `import { api } from '@/auth/api'`
- [ ] Fix Dashboard: rename `isHydrating` → `isReady` everywhere in `(home)/index.jsx`
- [ ] Fix `Brew/config.jsx` brewer fetch — pass numeric `BrewerID` not the ObjectId

### Features to build

- [ ] **Brew session screen** (`Brew/session.jsx`) — live countdown timer, pour step tracker, complete the brew flow
- [ ] **Post-brew setup** (`Brew/setup.jsx`) — tasting note entry after brew completes
- [ ] **`GET /dashboard` endpoint** on the backend (or replace dashboard fetch with individual API calls for user, last note, streak)
- [ ] **Populate refs** on `GET /notes` in the backend so `Recipe.Brewer.Name` and `Recipe.bean.Name` are available in the response
- [ ] **Create Account screen** — wire up `POST /users` API call
- [ ] **Forgot Password screen** — currently UI-only, needs backend support
- [ ] **Bean detail screen** — add/edit bean form
- [ ] **Brewer detail screen** — show associated recipes and notes
- [ ] **Note detail screen** — full tasting note view + edit
- [ ] **User profile screen** — display level, streak, brew count

### Code quality

- [ ] Replace inline `StyleSheet` color constants (duplicated across every screen) with the shared `theme.ts` palette
- [ ] Move `fetchBeans`, `fetchRecipe`, etc. out of screen files into a central `src/api/` layer
- [ ] Add TanStack Query `QueryClientProvider` wrapping to `_layout.tsx`
- [ ] Add error boundary around the route stack
