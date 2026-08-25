# BrewBook

A cross-platform app for logging coffee brews, tracking beans and brewers, and journaling tasting notes. Built with Expo and React Native, authenticated with Supabase, and backed by the BrewBook API (its own repo, at `BrewBook/`).

> Brew, log, refine. Keep a record of every cup so the next one is better.

Runs on **iOS, Android, and web** from a single codebase.

---

## Features

### Authentication
- Email + password sign-in and account creation, backed by Supabase Auth.
- Sessions persist in AsyncStorage and auto-refresh; the refresh timer pauses when the app backgrounds.
- A cold start waits for the session to hydrate, then lands on the Dashboard when signed in and Login when not.
- Auth gating lives on the entry route, the Dashboard (redirects to Login), and the Profile tab (renders a signed-out state). The Beans, Brewers, and Notes tabs are **not** gated — signed out, their requests simply fail or fall back to the API's public reads.

### Dashboard
- Last-brew card with bean, brewer, dose/yield, brew time, a 5-star rating, and a relative timestamp — tap through to the full tasting note.
- Bean supply bar showing grams remaining on the bean you last brewed.
- Daily statistics: brews today and current streak.
- Quick action into the brew flow.

### Bean inventory
- Searchable two-column grid of beans with roast-level icons and origin labels.
- Seven sort modes: name A–Z / Z–A, roast (light → dark), least → most used, least → most recently used, and roast date oldest / newest. Usage and recency are derived from the tasting-note feed.
- **Add bean** form covering identity, origin, varietal, process, altitude, roast date, roast level, tasting notes, and stock — validated against the API's schema limits before submitting.
- **Bean detail** with a static origin map (MapTiler, 22 coffee-origin countries mapped, with a graceful fallback card when the key or country is missing), an attribute grid, a stock bar, an auto-generated description, and a confirm-then-delete action.

> The grid reads `GET /beans`, which is **not** scoped to the signed-in user — see [Known issues](#known-issues).

### Brewer inventory
- **My Brewers** — searchable, sortable grid of the brewers in your collection, with type and filter-type icons.
- **Catalog** — browse every brewer the API knows about; ones you already own show an "ADDED" pill, the rest get a one-tap Add.
- **Brewer detail** — spec card, an editable filter-type selector that auto-saves, tracked parameters, and every recipe paired with that brewer.

### Guided brew flow
A four-step flow (`Brew/ selection → config → session → Log`):

1. **Selection** — shows the chosen recipe's number, ratio, and total brew time, then lists beans with sufficiently-stocked ones first. Anything below the recipe's dose is greyed out and unpickable, with a `Need ≥ Ng` hint in the section header.
2. **Config** — seeds every parameter from the recipe, then lets you tune it:
   - **Cup count (1–10)** rescales dose and water proportionally from the recipe's per-cup baseline.
   - Dose, water, temperature, grind, and bloom each open a horizontal wheel picker; grind reads as a band plus clicks (`Medium / 28 clicks`), and the coffee:water ratio updates live.
   - A stock guard compares the configured dose against the bean's remaining grams and blocks the button with `NOT ENOUGH BEANS` until it fits.
   - Confirming creates the tasting-note draft and decrements the bean's stock (best-effort — a failed decrement never blocks the brew).
3. **Session** — derives timed steps from the recipe's cumulative pour schedule (each step's duration is the gap to the next pour). Timed steps get a 10-second `GET READY` countdown then a live step timer; untimed steps just advance. `START NOW` skips the countdown, `SKIP STEP` abandons the current one. Finishing opens a completion overlay offering to log the brew or return home.
4. **Log** — four draggable 0–10 sliders (acidity, sweetness, body, finish) whose mean becomes the overall rating, plus a free-text field that is **also auto-split into `tastingNotes` chips** on commas, semicolons, and "and". Sweetness and finish are stored in `trackedParameters`, since the API's Notes schema carries `bitterness` rather than those two.

### Recipe editor
- Build a recipe for a brewer: name, optional bean, dose, water, temperature, bloom, and an agitation switch, with the coffee:water ratio computed live.
- **Paste a recipe as prose and split it into steps.** The parser reads each blank-line-separated paragraph and infers:
  - **step type** — bloom / pour / wait / swirl / stir / plunge / drawdown, from the wording
  - **duration** — `45s`, `1:30`, `2 min`
  - **pour target** — `to 120g`, `until 250g`
  A built-in Tetsu Kasuya 4:6 V60 example fills the field in one tap.
- Steps are then editable, reorderable, and deletable, with running totals for elapsed time and water poured against the target.
- Saving is gated on: at least one step, a name of 2+ characters, positive dose and water, and a final pour within 1g of the total water (matching the API's pre-save rule).
- Bottom-sheet wheel picker for temperature and bloom time.

### Tasting notes journal
- Searchable feed of rated brews — the search covers bean, brewer, tasting line, and free-text notes — with bean and brewer filter chips, a bottom-sheet filter picker, a RESET action, and pull-to-refresh. Only brews carrying a numeric rating are listed.
- **Note detail** — full brew parameters, tasting profile, free-text notes, tracked parameters, and a confirm-then-delete flow.

> The feed reads `GET /notes`, which is **not** scoped to the signed-in user — see [Known issues](#known-issues).

### Profile
- Four metrics: total brews, unique beans, active streak, and average rating.
- Favourite bean, brewer, and most-used recipe (display-only text — the API returns IDs for deep-linking, but the screen does not use them yet).
- Account metadata: member-since and last-login dates.

---

## Tech stack

| Layer            | Technology                                       |
| ---------------- | ------------------------------------------------ |
| Framework        | [Expo](https://expo.dev) SDK 54, React Native 0.81 |
| Language         | TypeScript / JSX                                 |
| Routing          | [Expo Router 6](https://docs.expo.dev/router/introduction/) (file-based, typed routes) |
| Auth             | [Supabase](https://supabase.com) (`@supabase/supabase-js`) |
| Data fetching    | [TanStack Query v5](https://tanstack.com/query) + [Axios](https://axios-http.com) |
| Session storage  | `@react-native-async-storage/async-storage`      |
| Maps             | MapTiler static-map images (bean origin)         |
| Icons            | `@expo/vector-icons` (Ionicons)                  |
| Platforms        | iOS · Android · Web                              |

---

## Project structure

```
src/
├── app/                         # Expo Router file-based routes
│   ├── _layout.jsx              # Root layout — safe area, AuthProvider, React Query, theme
│   ├── index.jsx                # Entry redirect: Dashboard when signed in, else Login
│   ├── (tabs)/
│   │   ├── _layout.jsx          # Bottom tabs: Beans · Brewers · Dashboard · Notes · Profile
│   │   ├── Dashboard/           # Last brew, bean supply, daily stats, quick actions
│   │   ├── BeanInventory/       # Bean grid, detail, add form
│   │   ├── BrewerInventory/     # My brewers, brewer detail, full catalog
│   │   ├── Notes/               # Tasting notes journal (list + detail)
│   │   └── User/                # Profile (tab gate + detail)
│   ├── Brew/                    # Brew flow: selection → config → session → Log
│   ├── Recipe/                  # Recipe editor (addRecipe)
│   └── Login/                   # Sign in, create account
├── api/
│   └── client.ts                # Re-exports the configured Axios instance as `apiClient`
├── auth/
│   ├── AuthContext.tsx          # AuthProvider + useAuth hook
│   ├── api.ts                   # Axios instance with bearer-token interceptor
│   └── config.ts                # Supabase client (AsyncStorage session, auto-refresh)
├── components/                  # WheelPickerModal (the only one screens import);
│                                #   ThemedText/ThemedView + Expo-starter leftovers are unused
├── constants/                   # fonts.js (used app-wide) + theme.ts (reached only via unused components)
├── hooks/                       # use-color-scheme, use-theme (unused — see above)
└── scripts/                     # reset-project (Expo starter leftover)
```

Screens style themselves with local `StyleSheet` blocks and a shared cream/ink/accent palette rather than the themed components — every screen imports `FONT_SERIF` from `constants/fonts`, and nothing outside `src/components/` imports `ThemedText`, `ThemedView`, or `use-theme`.

Path aliases: `@/*` → `./src/*`, `@/assets/*` → `./assets/*` (see [tsconfig.json](tsconfig.json)).

---

## Getting started

### Prerequisites

- Node.js 18+
- npm (or yarn / pnpm)
- A [Supabase](https://supabase.com) project (free tier works)
- A running BrewBook API instance (the `BrewBook/` repo)
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
EXPO_PUBLIC_MAPTILER_KEY=your-maptiler-key
```

| Variable                          | Required | Description                                                                 |
| --------------------------------- | :------: | --------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_BASE_URL`        | Yes      | Base URL of the BrewBook API server — the app throws at startup without it   |
| `EXPO_PUBLIC_SUPABASE_URL`        | Yes      | Your Supabase project URL (`https://<ref>.supabase.co`)                     |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`   | Yes      | Your Supabase project's public anon key (safe to ship in the client bundle) |
| `EXPO_PUBLIC_MAPTILER_KEY`        | No       | [MapTiler](https://www.maptiler.com) key for the bean-origin map; without it the detail screen shows a fallback card |

> `EXPO_PUBLIC_MAPTILER_KEY` is read by `app.config.js` and the bean detail screen but is not yet listed in `.env.example` — add it by hand.

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

- `src/auth/config.ts` creates the Supabase client with AsyncStorage as the session store, auto-refresh enabled, and the refresh timer tied to app foreground/background state.
- `src/auth/AuthContext.tsx` exposes `useAuth()` with `isReady`, `isAuthenticated`, `session`, `user`, `accessToken`, `signIn`, `signUp`, and `signOut`. (`signOut` is defined but never called — see [Known issues](#known-issues).)
- `src/auth/api.ts` is a pre-configured Axios instance that attaches `Authorization: Bearer <access_token>` to every request, pulling the current token from Supabase (and refreshing it) on each call. `src/api/client.ts` re-exports it as the default import used across screens.

```jsx
import apiClient from '@/api/client';

const { data } = await apiClient.get('/beans');
```

---

## Scripts

| Command            | What it does                          |
| ------------------ | ------------------------------------- |
| `npm start`        | Start the Expo dev server             |
| `npm run ios`      | Open in iOS simulator                 |
| `npm run android`  | Open in Android emulator              |
| `npm run web`      | Open in browser                       |
| `npm run lint`     | Run `expo lint` (no ESLint config is committed — Expo offers to create one on first run) |

---

## Not implemented

Things visible in the UI or the dependency list that are **not** finished features:

| Area | Status |
|---|---|
| **Bean scanner / OCR** | Stubbed. The "Open Scanner" option in the bean add-menu and the "Scan Beans" quick action on the Dashboard are placeholders — there is no scanner screen. |
| **News reader** | Stubbed. The Dashboard's "Read News" quick action is disabled, even though the API exposes `/news`. |
| **Interactive maps** | `react-native-maps` is installed but unused. The bean-origin map is a static MapTiler image — no pan, zoom, or markers. |
| **Zustand** | Installed but unused; all server state goes through TanStack Query and auth state through React context. |
| **`npm run reset-project`** | Removed from the script table above: `package.json` points at `./scripts/reset-project.js`, but the file lives at `src/scripts/reset-project.js`. |
| **Themed components** | `ThemedText`, `ThemedView`, `use-theme`, and `constants/theme.ts` are wired to each other but reach no screen — every screen styles itself locally. |
| **Unused starter components** | `app-tabs`, `hint-row`, `web-badge`, `collapsible`, `external-link`, and `animated-icon` are Expo-starter leftovers kept for reference; nothing in `src/app/` imports them. |

---

## Known issues

Real behaviour that differs from what the screens imply. None of these are fixed yet.

| Issue | Detail |
|---|---|
| **Beans and notes are not user-scoped** | The bean grid, the brew-flow bean list, and the notes journal call `GET /beans` and `GET /notes`, which return **every** bean and note in the database rather than the signed-in user's. Only `GET /beans/user/:email` (used by the brew config and recipe editor) filters by owner. |
| **Sign out does not sign out** | The Profile screen's SIGN OUT button calls `router.replace('/Login/Login')` without calling `signOut()` from `useAuth`. The Supabase session stays active and persisted, so the user is still authenticated. `signOut` is defined in `AuthContext` but invoked nowhere in the app. |
| **Type-check errors** | `npx tsc --noEmit` reports 17 errors, all inside the unused components above (`app-tabs`, `app-tabs.web`, `ui/collapsible`) and `hooks/use-theme`. No app screen is affected. |
| **`/explore` dead link** | `components/app-tabs.web.tsx` links to `/explore`, which is not a route. (Unused component, so unreachable.) |

Further pre-release checks are tracked in `QA_CHECKLIST.md` (in the parent workspace folder, outside this repo).

---

## Contributing

Pull requests are welcome. For larger changes, please open an issue first to discuss the direction.

1. Fork the repo and create your branch from `main`
2. Run `npm install`, copy `.env.example` → `.env`, and add your own Supabase credentials
3. Make your changes and check them with `npx tsc --noEmit`
4. Open a PR with a clear description of what changed and why

---

## License

MIT. (No `LICENSE` file is committed yet.)
