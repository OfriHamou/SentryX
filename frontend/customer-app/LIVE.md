# Customer App — Live Page

Reference document covering the architecture, files, and design decisions of the Live page.

---

## What it is

The **Live** page is the main screen of the SentryX customer app. It lets the user:

- Watch the robot's live video feed
- See current detection status (face, smoke, fire, motion)
- Review recent events
- Drive the robot with a joystick
- Trigger Alarm / Emergency / Talk
- Enter fullscreen mode with a larger joystick overlay

Entry point: `src/pages/Live.tsx`.

---

## Stack

- **React 19** + **TypeScript**
- **Vite** — build tool and dev server
- **MUI v9** — design system (buttons, cards, grid, theming)
- **react-router-dom v7** — routing
- **react-joystick-component** — touch-friendly joystick
- **axios** — HTTP client
- **@fontsource/inter** — font

---

## Folder layout

```
frontend/customer-app/src/
├── main.tsx                    # entry — ThemeProvider + Router + CssBaseline
├── App.tsx                     # Routes: / → /dashboard, /dashboard, /live
├── theme.ts                    # MUI theme (primary #8B9BE8, Inter, borderRadius 12)
├── vite-env.d.ts               # TypeScript env declarations
│
├── api/
│   ├── client.ts               # axios instance (baseURL from VITE_ROBOT_API_URL)
│   └── robot.ts                # typed API wrappers for the robot
│
├── types/
│   └── robot.ts                # Detection, BatteryStatus, RobotEvent, MoveInput, ...
│
├── hooks/
│   ├── usePolling.ts           # generic polling (pauses when tab is hidden)
│   ├── useFullscreen.ts        # browser Fullscreen API wrapper
│   └── robot/
│       ├── useBattery.ts       # polling 10s
│       ├── useDetectionStatus.ts # polling 2s
│       ├── useEvents.ts        # polling 5s
│       ├── useRobot.ts         # mock — will become a real API call
│       └── useRobotMove.ts     # throttled move + stop
│
├── layouts/
│   └── AppLayout.tsx           # top navbar + Outlet
│
├── pages/
│   ├── Dashboard.tsx           # stub
│   └── Live.tsx                # the page we built
│
└── components/live/
    ├── JoystickControl.tsx     # react-joystick-component wrapper
    ├── video/
    │   ├── VideoPlayer.tsx     # MJPEG stream + overlays + fullscreen btn
    │   ├── VideoOverlay.tsx    # atom: positioned badge wrapper
    │   ├── LocationBadge.tsx   # atom (top-left)
    │   ├── ClockBadge.tsx      # atom (top-right, ticks every second)
    │   └── BatteryBadge.tsx    # atom (bottom-left)
    ├── actions/
    │   └── ActionPanel.tsx     # Talk / Alarm / Emergency / Volume / Joystick
    ├── detection/
    │   ├── DetectionStatusCard.tsx
    │   ├── DetectorRow.tsx
    │   └── StatusPill.tsx
    ├── activity/
    │   ├── RecentActivityCard.tsx
    │   ├── EventRow.tsx
    │   └── eventRegistry.tsx   # type → {icon, title, color} + fallback
    └── fullscreen/
        └── FullscreenControls.tsx # overlay with action icons + joystick
```

---

## Naming conventions

- **Component folders** — grouped by **page** or **area** (`live/`, `video/`, `actions/`)
- **Hook folders** — grouped by **data domain** (`robot/`), not by page. A hook may serve multiple pages.
- **Atoms** — small reusable components with no business logic (e.g. `VideoOverlay`, `StatusPill`)
- **File names** — `PascalCase` for components, `camelCase` for hooks and utilities
- **Hooks must start with `use`** (React requirement)

---

## Data flow

```
Robot (Jetson, Python)
  ├─ web_bridge.py        (port 5000, motor + battery)
  ├─ video_bridge.py      (port 5001, MJPEG stream)
  └─ detection_bridge.py  (port 5002, face detection + events)
        ↓
Backend (Node, Express, port 3001)
  backend/index.js — proxy to Jetson
        ↓
Frontend API layer
  api/robot.ts — typed axios wrappers
        ↓
React hooks
  hooks/robot/*.ts — polling, throttling, state
        ↓
Components
  components/live/* — render UI
```

---

## Architecture decisions

### 1. Generic polling hook

`usePolling<T>(fetcher, intervalMs)` wraps every polling pattern:

- immediate fetch on mount
- repeated interval
- cleanup on unmount
- **automatic pause when the tab is hidden** (`document.hidden`)

Each feature hook (`useBattery`, `useEvents`, etc.) is a 3-line wrapper around it.

### 2. Throttling for robot movement

The joystick fires dozens of events per second. `useRobotMove` **caps the rate at 10 requests/second** while always sending the latest value:

```ts
const MAX_SENDS_PER_SECOND = 10;
const MIN_INTERVAL_MS = 1000 / MAX_SENDS_PER_SECOND;
```

If an event arrives inside the window, we store it. When the window closes, the most recent value is sent.

### 3. Event registry with fallback

`eventRegistry.tsx` is a map of `event.type → {icon, title, color}` with a `fallbackEventDisplay` for unknown types. Benefits:

- The backend can add new event types **without breaking the frontend**
- Presentation lives on the frontend — easy to change without coordination

### 4. Central types

`types/robot.ts` defines the shape of every piece of data flowing through the system. Every layer (API, hooks, components) references the same types. Rename a field in one place → TypeScript finds every call site.

### 5. Fullscreen: browser event as source of truth

`useFullscreen` listens to the browser's `fullscreenchange` event — this means Esc, our exit button, or any other trigger all update the state correctly. We never manage fullscreen state manually.

---

## How to run

**Prerequisites:**

- Node 20+
- backend running on port 3001 (`cd backend && npm run dev`)
- Network access to the robot (VPN or same LAN) — otherwise the page loads but without data or video

**Development:**

```powershell
cd frontend/customer-app
npm install
npm run dev
```

Open `http://localhost:5173/live`.

**Production build:**

```powershell
npm run build
```

Output goes to `dist/`.

**Environment variables (`.env`):**

```
VITE_ROBOT_API_URL=http://localhost:3001/api
```

---

## What has been implemented

- ✅ **Commit 1** — Types + API layer + axios
- ✅ **Commit 2** — usePolling + useBattery
- ✅ **Commit 3** — VideoPlayer + overlays (Location / Clock / Battery)
- ✅ **Commit 4** — ActionPanel + two-column layout
- ✅ **Commit 5** — DetectionStatusCard + RecentActivityCard
- ✅ **Commit 6** — useFullscreen + FullscreenControls (shell)
- ✅ **Commit 7** — Joystick + useRobotMove (throttled)

---

## Deferred / not yet implemented

- **Talk audio** (WebRTC/mic) — button is a visual toggle only
- **Alarm / Call Emergency backend calls** — no endpoints yet; handlers only `console.log`
- **Volume persistence** — local state only, not saved
- **Event thumbnails on click** — `eventImageUrl()` is exported but unused
- **WebSocket push** — still polling
- **Authentication** — Logout button is a stub
- **Mobile responsive** — desktop-first per the mockups
- **Broken-video placeholder** — the browser's default broken image appears when the stream is unreachable

---

## Known limitations

- The robot runs on private IP `10.10.248.123`. Local development needs VPN or an SSH tunnel.
- `react-joystick-component` is older than React 19; any warnings are non-blocking.
- Battery percentage is a linear map of `9.9–12.0V` — suitable for the 12V pack used today; different batteries would need different thresholds.

---

## Maintenance tips

| Task | Where to edit |
|---|---|
| Point the app to a different backend | `VITE_ROBOT_API_URL` in `.env` |
| Add a new event type (visual only) | `components/live/activity/eventRegistry.tsx` |
| Add a new detector (Smoke/Fire/Motion) | `DetectionStatusCard.tsx` + a dedicated hook if there's a new endpoint |
| Change polling frequency | The relevant hook in `hooks/robot/` (`10_000`, `5_000`, etc.) |
| Migrate to a new TypeScript backend | Change `VITE_ROBOT_API_URL`; if response shapes differ, update `types/robot.ts` |
| Change the app width | `AppLayout.tsx` — `<Container maxWidth="..." />` |
