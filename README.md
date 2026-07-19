<p align="center">
  <img src="docs/logo.svg" width="84" alt="Canopy logo: two trees connected by a zipline" />
</p>

# 🌲 Canopy — a study planner for exam season

<p align="center">
  <img src="https://img.shields.io/badge/React_19-4f8a55?style=flat&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-1c3b5a?style=flat&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Firebase-d6a93f?style=flat&logo=firebase&logoColor=white" alt="Firebase" />
  <img src="https://img.shields.io/badge/Hebrew_·_RTL-4f8a55?style=flat" alt="Hebrew RTL" />
  <img src="https://img.shields.io/badge/Mobile--first-1c3b5a?style=flat" alt="Mobile first" />
</p>

*A calm, mobile-first app that turns exam season into a visible route: every task you finish extends a zipline strung between two trees.*

Built for students who open their planner forty times a day, usually stressed. Every design decision optimizes for lowering anxiety, not gamifying it: counts instead of invented percentages, a daily summary instead of a punishing streak, and one warm accent color reserved for "what's next".

**Live app:** [canopy-b9c49.web.app](https://canopy-b9c49.web.app)

<p align="center">
  <img src="docs/home.png" width="380" alt="Canopy home screen: the zipline progress scene, today's tasks and upcoming exams" />
</p>

---

## Contents

- [⭐ Highlights](#-highlights)
- [📥 Installation](#-installation)
- [🚀 How to use](#-how-to-use)
- [⬆ Updating](#-updating)
- [🔒 Privacy & data](#-privacy--data)
- [🛠️ Engineering challenges solved](#%EF%B8%8F-engineering-challenges-solved)
- [Advanced: the scheduling algorithm](#advanced-the-scheduling-algorithm)
- [📁 Project structure](#-project-structure)
- [📜 License & credits](#-license--credits)

## ⭐ Highlights

- 🧗 **Zipline progress scene** — completed tasks become checkpoints on a rope between two trees; a small rider marks where you are right now.
- 🗓️ **Automatic scheduling** — tasks without a fixed day are spread across the days before each course's exam, capped by a configurable daily study budget.
- 📌 **Fixed-day tasks** — assign a task to a specific day and it stays there, like a calendar event; missed days roll forward to today instead of piling up in red.
- ☁️ **Cloud sync** — one tap Google sign-in; courses, tasks and exams sync live between phone, tablet and desktop via Firestore.
- 📅 **Month & week views** — exams appear by name on the month grid; the week view lays out every scheduled task per day.
- 🎚️ **Per-course calendar filter** — toggle courses on and off in the schedule, Google Calendar style.
- ⏱️ **Focus timer** — a 25-minute countdown with a progress ring, right on the home screen.
- 🧮 **Counts, not scores** — "4 of 7 done today", never an invented 57%; completion is always a deliberate tap, never inferred.
- 🌘 **Full dark mode** — every color is a CSS variable; the whole theme follows the system preference.
- 🇮🇱 **Hebrew-first, RTL throughout** — dates, weekday grids and relative times ("עוד יומיים") all render natively.

## 📥 Installation

1. Clone and install:
   ```bash
   git clone https://github.com/itaylot/canopy.git
   cd canopy && npm install
   ```
2. Create a free [Firebase project](https://console.firebase.google.com) (enable **Google sign-in** and **Firestore**), then paste its web config into [`src/firebaseConfig.ts`](src/firebaseConfig.ts).
3. ```bash
   npm run dev
   ```
   That's it.

> No Firebase project yet? The app detects the missing config and shows a friendly setup screen instead of crashing — you can still explore the code.

## 🚀 How to use

1. Sign in with Google.
2. In **קורסים** (Courses), add a course, then add its tasks — each with an estimated duration; optionally pin a task to a specific day.
3. In **לוח זמנים** (Schedule), add each course's exam date.
4. Open **בית** (Home): today's plan is already there. Canopy spread the unpinned tasks across the days before each exam, respecting your daily budget.
5. Tap the circle on a task when you finish it — the zipline grows, and tomorrow's plan rebalances automatically.

## ⬆ Updating

```bash
git pull && npm install && npm run build
```

Your data never lives in this folder — it's in your Firebase project — so updating the code can't touch it.

## 🔒 Privacy & data

- All of your data lives in **your own Firebase project**, in a single Firestore document per user (`users/{uid}`), locked by [security rules](firestore.rules) so only you can read or write it.
- Sign-in is Google OAuth only — the app never sees or stores a password.
- No analytics, no telemetry, no third-party trackers. The only network calls are to your Firebase project.
- The Firebase keys in [`src/firebaseConfig.ts`](src/firebaseConfig.ts) are public by design (they identify the project; the security rules are what protect the data).

## 🛠️ Engineering challenges solved

<details>
<summary>Five real bugs and how they were hunted down</summary>

**1. Tab navigation froze and screens mounted invisible**
- *Symptom:* tapping a tab did nothing; the new screen was in the DOM but never appeared.
- *Cause:* the screen switch was wrapped in `AnimatePresence mode="wait"`, which blocks the incoming screen until the outgoing exit animation finishes — and the browser pauses animation loops in background tabs, so `opacity` stayed at `0` forever.
- *Diagnosis:* dumping the mounted element's inline style showed `opacity: 0; transform: translateY(8px)` frozen in place while `document.visibilityState` was `hidden`.
- *Fix:* never gate navigation or content visibility on an animation. The swap is instant; a transform-only slide keeps the motion hint and stays visible even if the animation loop is paused.

**2. Courses synced to the cloud, but tasks silently didn't**
- *Symptom:* after signing in on a second device, courses appeared but every task was gone.
- *Cause:* auto-scheduled tasks store `dueDate: undefined`, and Firestore rejects any write containing `undefined` — the fire-and-forget `setDoc` failed silently on every task write.
- *Diagnosis:* attaching `.catch(console.error)` to the sync writes surfaced the rejection immediately.
- *Fix:* `initializeFirestore(app, { ignoreUndefinedProperties: true })`, plus permanent error logging on every sync write so the next silent failure isn't silent.

**3. Sign-in looped forever on iPad**
- *Symptom:* tapping "Sign in with Google" opened a window that closed instantly, returning to the login screen every time.
- *Cause:* the app is served from `canopy-b9c49.web.app` but Firebase's default `authDomain` is `canopy-b9c49.firebaseapp.com`. Safari's ITP partitions storage between the two "different sites", so the auth result could never travel back.
- *Diagnosis:* the behavior only reproduced on Safari/iOS; desktop Chrome worked — the classic cross-site-storage fingerprint.
- *Fix:* set `authDomain` to the Hosting domain itself. Firebase Hosting serves `/__/auth/handler` from the same origin, so the whole flow stays same-site.

**4. Google replied "access blocked, this app's request is invalid"**
- *Symptom:* after fixing #3, iPhone sign-in reached Google but was rejected with `invalid_request`.
- *Cause:* the new domain wasn't listed in the OAuth client's authorized JavaScript origins / redirect URIs, and the OAuth consent screen had never been completed.
- *Diagnosis:* the error page is Google's own, which points at OAuth client configuration rather than app code.
- *Fix:* complete the consent screen, publish it, and add `https://canopy-b9c49.web.app` (+ `/__/auth/handler`) to the authorized lists.

**5. Trusting the scheduler**
- *Symptom:* none yet — and that's the point. A scheduler that quietly drops a task the night before an exam is the worst possible bug.
- *Approach:* the algorithm is a pure function (`buildSchedule`) with no stored state — the calendar is always derived, never persisted, so it can't go stale. A runnable self-check ([`schedule.check.mjs`](schedule.check.mjs), `npm run check`) asserts the six behaviors that could actually hurt: cap overflow spills forward, fixed days ignore the cap, nothing lands on or after exam day, done tasks vanish, overdue work resurfaces today.

</details>

## Advanced: the scheduling algorithm

<details>
<summary>How tasks land on days</summary>

Every render, [`src/schedule.ts`](src/schedule.ts) rebuilds the whole plan from scratch:

1. **Fixed tasks** (`dueDate` set) go exactly on their day — no cap applied. A date in the past is pulled up to today so missed work resurfaces instead of disappearing behind you.
2. **Auto tasks** get a deadline of one buffer day before their course's next exam, then are placed greedily — earliest deadline first, longest task first on ties — filling each day up to the daily budget (default 3h, configurable in the profile) and spilling overflow forward, but never past the deadline.
3. Because the function is pure, completing a task instantly rebalances every future day with zero sync logic.

</details>

## 📁 Project structure

```
index.html            App shell: RTL, Hebrew, Rubik font
src/
  main.tsx            React entry point
  index.css           Design tokens (light + dark) as CSS variables
  App.tsx             Auth gate + four-tab shell
  store.ts            Zustand store: courses, tasks, exams
  schedule.ts         The pure scheduling algorithm
  utils.ts            Local-time date helpers, Hebrew formatting
  ui.tsx              Shared pieces: logo mark, cards, task row, bottom sheet
  CanopyScene.tsx     The zipline progress illustration (SVG + Motion)
  firebase.ts         Firebase init + Google sign-in
  firebaseConfig.ts   Your Firebase web config goes here
  cloud.ts            Two-way Firestore <-> store sync
  screens/
    Login.tsx         Google sign-in screen
    Home.tsx          Greeting, scene, today's tasks, exams, focus timer
    CalendarScreen.tsx  Month/week views + course filter
    Courses.tsx       Course list, progress, task management
    Profile.tsx       Account, stats, daily study budget
schedule.check.mjs    Runnable self-check for the scheduler (npm run check)
firestore.rules       Per-user data isolation
firebase.json         Hosting + rules deployment config
docs/                 README assets only
```

## 📜 License & credits

[MIT](LICENSE).

Built on the shoulders of:
- [React](https://react.dev) + [Vite](https://vite.dev) — UI runtime and build tooling
- [Tailwind CSS v4](https://tailwindcss.com) — utility styling over the CSS-variable tokens
- [Motion](https://motion.dev) — the spring animations and layout transitions
- [Zustand](https://zustand.docs.pmnd.rs) — the small global store the cloud sync hooks into
- [Firebase](https://firebase.google.com) — auth, Firestore sync and hosting
- [Phosphor Icons](https://phosphoricons.com) — the icon family used throughout
- [Rubik](https://fonts.google.com/specimen/Rubik) — the Hebrew-friendly typeface

---

<sub>A student side project, designed and built with the help of Claude Code.</sub>
