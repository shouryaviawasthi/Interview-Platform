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

In development, `/api` and `/socket.io` are proxied to the backend on port `5000`.
Open the Vite server from another device using the development computer's LAN address
(for example, `http://192.168.1.20:5173`). Socket.IO follows the page's host automatically;
do not set it to `localhost` for a phone, because `localhost` refers to that phone.
If the interviewer uses `localhost` on the computer, set `VITE_CLIENT_URL` to the
browser-accessible LAN or deployed client origin (for example,
`https://192.168.1.20:5173`) so copied candidate links point to the correct device.
If a candidate's URL is incomplete or no longer valid, open that interview's details,
select **New link**, and share the complete new URL. This invalidates the old candidate link.

For a deployed client, set `VITE_API_URL` to the backend API URL (for example,
`https://api.example.com/api`) before building. If the socket/backend host differs from
the API-derived host, set `VITE_SERVER_URL` to its origin.

## Mobile camera and microphone access

Mobile browsers require a trusted HTTPS page before exposing `getUserMedia`; using the
same Wi-Fi network does not make an HTTP LAN address secure. For phone testing, use a
trusted HTTPS deployment or HTTPS development URL. For local development, generate a
certificate trusted by the phones and whose SAN includes the development computer's LAN
IP, then set `VITE_HTTPS_CERT` and `VITE_HTTPS_KEY` in `client/.env` to the certificate
and key paths. Restart Vite and open `https://<computer-lan-ip>:5173` on both phones.
The room reports the HTTPS requirement when media devices are unavailable. It will
not let a participant join without both camera and microphone access. If either device
is unavailable or permission is denied, enable both permissions and retry.

The room uses WebRTC for remote audio/video, Socket.IO for offer/answer/ICE signaling, and
the interviewer uploads a mixed local-and-remote audio recording to the backend when the
interview ends. Public STUN servers are used by default. Networks that block direct
peer-to-peer connections need a TURN relay; set `VITE_ICE_SERVERS` to a JSON array of
WebRTC ICE server objects before building. TURN credentials are delivered to browsers, so
use short-lived credentials from your TURN provider rather than embedding a permanent
secret.

## What's implemented

- **Auth**: register / login / session bootstrap via `GET /auth/me`, JWT stored in
  `localStorage`, auto-redirect to `/login` on 401.
- **Dashboard**: live stats (`/interviews/dashboard`) + recent interviews.
- **Interviews**: searchable/filterable list, create (with instant join-link + copy),
  detail view with inline edit, delete (confirm modal), resume upload with progress and
  parsed-text preview.
- **Candidate join flow**: public `/interview/join/:token` page (no login) that looks up the
  interview, confirms the candidate's name, then enters the room.
- **Live room**: `/interview/room/:token`, used by both interviewer and candidate. Uses
  Socket.IO for room presence and WebRTC signaling, with local and remote media, mute/camera
  toggles, live transcript capture, and interviewer-side mixed audio recording.
- **Post-interview reports**: candidates are sent to their public
  `/candidate/dashboard/:token` report dashboard; interviewers are sent to their authenticated
  `/interviews/:id/end` dashboard. Each dashboard shows that participant's own analysis and
  PDF download. Interviewers can retry failed report generation from their dashboard.
