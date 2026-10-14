# AI Interview Platform — Client

React 18 + Vite + Tailwind CSS v4 frontend for the AI Interview Platform backend, styled with a
lavender design system (Space Grotesk / Inter / JetBrains Mono).

## Setup

```bash
cd client
npm install
cp .env.example .env   # set VITE_API_URL if your backend isn't on :5000
npm run dev
```

In development, `/api` is proxied to `http://localhost:5000` by Vite. For a
deployed client, set `VITE_API_URL` to the backend API URL (for example,
`https://api.example.com/api`) before building.

## One required backend change

The public `GET /api/interviews/join/:token` endpoint originally returned only
`candidate_name`, `job_description`, `status` — no interview `id`. The live room needs that
`id` to join the correct Socket.IO room (`join-room` requires `interviewId`), so
`server/src/models/interview.model.js` → `getInterviewByToken` now also selects `id` and
`join_token`. This is the only backend file touched. Apply this diff to your server before
testing the room flow:

```js
const query = `
  SELECT id, candidate_name, job_description, status, join_token
  FROM interviews
  WHERE join_token = $1
`;
```

## What's implemented

- **Auth**: register / login / session bootstrap via `GET /auth/me`, JWT stored in
  `localStorage`, auto-redirect to `/login` on 401.
- **Dashboard**: live stats (`/interviews/dashboard`) + recent interviews.
- **Interviews**: searchable/filterable list, create (with instant join-link + copy),
  detail view with inline edit, delete (confirm modal), resume upload with progress and
  parsed-text preview.
- **Candidate join flow**: public `/interview/join/:token` page (no login) that looks up the
  interview, confirms the candidate's name, then enters the room.
- **Live room**: `/interview/room/:token`, used by both interviewer and candidate. Wires up
  the existing Socket.IO contract (`join-room` / `leave-room` / `room-state` / `user-joined` /
  `user-left`) for real-time presence, plus a local camera/mic preview via `getUserMedia` with
  mute/camera toggles and a room activity feed.
- **Post-interview reports**: candidates are sent to their public
  `/candidate/dashboard/:token` report dashboard; interviewers are sent to their authenticated
  `/interviews/:id/end` dashboard. Each dashboard shows that participant's own analysis and
  PDF download. Interviewers can retry failed report generation from their dashboard.

## Known limitation (by design, matches current backend)

The backend's Socket.IO layer only tracks **presence** (who's in the room) — there's no
WebRTC signaling (offer/answer/ICE relay) implemented yet, so remote participants render as
named placeholder tiles rather than live video. Your own camera preview is real; connecting
actual peer-to-peer video/audio between participants will need signaling events added to
`interview.socket.js` plus a `RTCPeerConnection` layer on the client — happy to build that
next if you want full video calling.
