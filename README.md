# AI Interview Platform

An end-to-end interview platform for scheduling and running live technical or behavioral interviews. Interviewers manage interviews from a protected dashboard, candidates join through a tokenized link, and the system supports browser audio/video, live transcription, AI-assisted reports, conversation analytics, and downloadable PDFs.

## What The Platform Does

- Interviewer registration, login, JWT authentication, and protected dashboard routes.
- Interview creation, listing, editing, deletion, status updates, and candidate join links.
- Candidate access through an interview join token without requiring an interviewer account.
- One-to-one live interview rooms with camera and microphone access.
- WebRTC peer-to-peer media with Socket.IO signaling.
- Live transcript streaming through Deepgram and persisted transcript data.
- Uploaded interview audio processing and background transcription after server restart.
- Resume upload and resume text extraction.
- Candidate and interviewer AI reports powered by Groq.
- Deterministic interview analytics such as speaking time, turns, pauses, filler words, and question counts.
- Report and analytics pages in the client plus PDF report downloads.

## Architecture

```mermaid
flowchart LR
    Browser[React client] -->|HTTP JSON and multipart| API[Express API]
    Browser -->|Socket.IO events| Socket[Socket.IO server]
    Browser -->|WebRTC media| Peer[Other interview participant]
    API --> DB[(PostgreSQL)]
    Socket --> DB
    API --> Deepgram[Deepgram speech-to-text]
    API --> Groq[Groq LLM]
    API --> Files[server/src/uploads]
```

The repository has two independently installed Node.js applications:

```text
client/       React + Vite single-page application
server/       Express API, Socket.IO server, AI and transcription services
database/     PostgreSQL schema and phase migrations
docs/         Project documentation
```

The root folder does not contain a `package.json`. Install dependencies and run commands separately in `client` and `server`.

## How An Interview Works

1. An interviewer registers or logs in. The client stores the JWT and uses it for protected API calls.
2. The interviewer creates an interview with the candidate details and job description. The server creates a UUID interview ID and join token.
3. The candidate opens the join URL. The server validates the token and returns the interview context.
4. Both participants enter the interview room and join a Socket.IO room identified by the interview ID.
5. The interviewer and candidate exchange WebRTC offer, answer, and ICE-candidate messages through Socket.IO. Media flows directly between browsers.
6. Microphone audio can be sent as live chunks to the server. Deepgram returns transcript segments, which are broadcast to the room and stored in PostgreSQL.
7. When the interview ends, uploaded audio and transcript data can be processed. The server calculates conversation analytics and sends transcript/context to Groq for candidate and interviewer evaluations.
8. Reports are saved with processing status and model metadata. The interviewer can view reports, analytics, transcripts, and download generated PDFs.

## Client Modules

The client is a Vite-powered React 18 application. Routing and authenticated UI composition are handled in `client/src/App.jsx`.

| Module | Responsibility | Main libraries and browser APIs |
| --- | --- | --- |
| `src/App.jsx`, `src/routes/` | Route definitions, guest-only pages, protected pages | `react-router-dom` |
| `src/context/AuthContext.jsx` | Login state, registration, logout, token bootstrap | React Context and Hooks, `localStorage` |
| `src/services/`, `src/lib/api.js` | HTTP calls for authentication, interviews, transcripts, reports, and PDFs | `axios`, `FormData`, Blob APIs |
| `src/lib/config.js`, `src/lib/axios.js` | API URL and client configuration | Vite environment variables |
| `src/socket/`, `src/hooks/useInterviewSocket.js` | Socket connection and interview room events | `socket.io-client` |
| `src/hooks/useWebRTC.js` | Peer connection, offer/answer handling, ICE candidates, remote stream | Browser `RTCPeerConnection`, WebRTC APIs |
| `src/hooks/useLocalMedia.js` | Camera and microphone permissions and local media stream | `navigator.mediaDevices.getUserMedia` |
| `src/hooks/useAudioRecorder.js`, `useMicRecorder.js` | Captures audio and emits or uploads audio chunks | Browser `MediaRecorder` API |
| `src/hooks/useLiveTranscript.js` | Consumes live transcript events and updates the room UI | React Hooks, Socket.IO events |
| `src/hooks/useInterviewSession.js` | Interview lifecycle, participant/session state, and end flow | React Hooks, API service |
| `src/pages/` | Landing, auth, dashboard, interview room, transcript, report, and analytics screens | React |
| `src/components/interview/` | Participant tiles, timers, transcript feed, room controls, end screen | React, WebRTC media elements |
| `src/components/report/` | Candidate and interviewer report presentation | React |
| `src/components/dashboard/`, `src/components/layout/` | Dashboard rows, statistics, navigation, and authenticated layout | React |
| `src/components/ui/` | Reusable buttons, inputs, loaders, score dials, status indicators, and waveform UI | React, `react-icons` |
| `src/styles/`, `src/index.css` | Global styling and UI presentation | CSS, Tailwind/PostCSS tooling |

### Client dependencies

- **React / React DOM**: component rendering and UI state.
- **React Router DOM**: public, candidate, authenticated, and fallback routes.
- **Axios**: API requests, JWT headers, candidate join-token headers, multipart uploads, and PDF blobs.
- **Socket.IO Client**: room membership, WebRTC signaling, live transcript events, and room state.
- **React Hot Toast**: success and error notifications.
- **React Icons**: interface icons.
- **Vite**: development server and production bundling.
- **Tailwind/PostCSS, Autoprefixer**: CSS processing and browser compatibility.
- **TypeScript React type packages**: editor and tooling type definitions; the application source is JavaScript/JSX.

## Server Modules

The server is a CommonJS Node.js application. `server/src/server.js` connects to PostgreSQL, verifies the phase tables, resumes pending audio processing, creates the HTTP server, initializes Socket.IO, and starts listening.

| Module | Responsibility | Main libraries and integrations |
| --- | --- | --- |
| `src/app.js` | Express application, middleware, static uploads, API mounting, error handling | `express`, `cors`, `helmet`, `morgan`, `cookie-parser` |
| `src/server.js` | Startup orchestration and idempotent report/analytics table verification | Node `http`, `pg` pool |
| `src/config/` | Environment values, PostgreSQL pool, and logging | `dotenv`, `pg`, console/logger utilities |
| `src/routes/` | Maps HTTP endpoints to controllers | Express Router |
| `src/controllers/` | Validates request flow and coordinates services/models for API responses | Express request/response objects |
| `src/middleware/auth.middleware.js` | Checks interviewer JWTs and candidate join-token access | `jsonwebtoken` |
| `src/middleware/upload.middleware.js` | Handles resume uploads | `multer` |
| `src/middleware/audio.upload.middleware.js` | Handles interview audio uploads | `multer` |
| `src/models/` | SQL queries and persistence for users, interviews, resumes, audio, transcripts, reports, and analytics | `pg` |
| `src/services/auth/` | Password hashing and authentication workflow | `bcrypt`, `jsonwebtoken` |
| `src/services/interview/` | Interview lifecycle and business rules | PostgreSQL models |
| `src/services/socket/` | In-memory participant and room state | Socket.IO room IDs |
| `src/sockets/` | Room membership, WebRTC signaling, live audio chunks, and disconnect handling | `socket.io` |
| `src/services/transcription/` | Uploaded-audio processing and live transcription sessions | `@deepgram/sdk`, filesystem streams, PostgreSQL |
| `src/services/ai/` | Prompting, Groq client calls, response validation, candidate/interviewer analysis, and metrics | `groq-sdk` |
| `src/services/analytics/` | Deterministic transcript metrics plus AI-assisted analytics | JavaScript calculations, `groq-sdk` |
| `src/services/report/` | Report orchestration and report data preparation | PostgreSQL, AI services |
| `src/services/pdf/` | Candidate and interviewer PDF generation | `pdfkit` |
| `src/utils/` | Password, JWT, error, and helper utilities | `bcrypt`, `jsonwebtoken`, `uuid` |

### Server dependencies

- **Express**: HTTP API framework.
- **PostgreSQL (`pg`)**: relational persistence for users, interviews, resumes, audio metadata, transcripts, reports, and analytics.
- **Socket.IO**: real-time rooms, WebRTC signaling, live transcript events, and participant state.
- **Deepgram SDK**: speech-to-text, diarization, and live transcription.
- **Groq SDK**: candidate/interviewer evaluation and semantic analytics using the configured LLM.
- **Multer**: multipart form parsing for resumes and audio.
- **PDFKit**: server-side PDF report generation.
- **bcrypt**: password hashing.
- **jsonwebtoken**: interviewer JWT creation and verification.
- **express-validator**: request validation rules.
- **cors**: cross-origin client/server requests during local development.
- **helmet**: common HTTP security headers.
- **morgan**: HTTP request logging.
- **cookie-parser**: cookie parsing middleware.
- **dotenv**: loading local environment variables.
- **uuid**: UUID-related utilities used by server code.
- **nodemon**: development-only server restart on file changes.

## HTTP API Groups

All API routes are mounted below `/api`.

| Route group | Purpose |
| --- | --- |
| `/api/health` | Server health checks |
| `/api/auth` | Registration, login, and current-user lookup |
| `/api/interviews` | Create, list, read, update, delete, join, start/end, and resume operations |
| `/api/interviews/:id/transcript` | Read and upload transcript/audio data |
| `/api/interviews/:id/report` | Generate, read, and download interview reports |
| `/api/interviews/:id/analytics` | Read and generate interview analytics |
| `/api/interviews/public/:token/candidate-report` | Candidate report access through a public join token |

Interviewer requests use `Authorization: Bearer <JWT>`. Candidate requests use the interview join token, either in the URL flow or through the `x-join-token` header used by the client API wrapper.

## Socket.IO Events

The interview room uses the interview ID as the Socket.IO room ID. Important events include:

- `join-room`, `leave-room`
- `room-joined`, `room-state`, `user-joined`, `user-left`
- `webrtc-offer`, `webrtc-answer`, `webrtc-ice-candidate`
- `start-live-transcript`, `audio-chunk`, `stop-live-transcript`
- `live-transcript-started`, `live-transcript-stopped`, `live-transcript-error`

Socket.IO relays signaling and transcript data. It does not carry the ongoing WebRTC video/audio stream; browsers exchange that media through the WebRTC peer connection.

## Database

PostgreSQL is the system of record. The base schema in `database/schema.sql` creates:

- `users`
- `interviews`
- `resumes`
- `transcripts`
- `reports`

The later migrations add:

- **Phase 3**: `interview_audio` metadata and transcript diarization fields.
- **Phase 4**: separate `candidate_reports` and `interviewer_reports` tables.
- **Phase 5**: `interview_analytics` metrics and nested analytics JSON.

The server also verifies the Phase 4 and Phase 5 report/analytics tables at startup using idempotent `CREATE TABLE IF NOT EXISTS` statements.

## Local Setup

### Prerequisites

- Node.js 18 or newer recommended.
- npm.
- A PostgreSQL database. The project was designed to work with hosted PostgreSQL providers such as Neon.
- Deepgram API credentials for transcription features.
- Groq API credentials for AI reports and AI analytics.

### 1. Clone and install

```bash
git clone https://github.com/shouryaviawasthi/Interview-Platform.git
cd Interview-Platform

cd client
npm install

cd ../server
npm install
```

### 2. Configure the server

Copy `server/.env.example` to `server/.env` and set real values:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=1d

DEEPGRAM_API_KEY=your_deepgram_api_key
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
```

Never commit `server/.env`. Environment files are ignored by `.gitignore`.

### 3. Initialize the database

Run `database/schema.sql` against the configured PostgreSQL database. Apply the phase migrations in order when using the corresponding features:

```text
database/schema.sql
database/migration_phase3.sql
database/migration_phase4.sql
database/migration_phase5.sql
```

The server startup also verifies the Phase 4 and Phase 5 tables, but running the migrations explicitly keeps database setup reproducible.

### 4. Start the applications

Use two terminals from the repository root:

```bash
# Terminal 1
cd server
npm run dev
```

```bash
# Terminal 2
cd client
npm run dev
```

The Vite client normally runs at `http://localhost:5173` and the API normally runs at `http://localhost:5000`.

If the API reports that port `5000` is already in use, check for another server
instance before starting a second one. In PowerShell, identify the process with:

```powershell
Get-NetTCPConnection -LocalPort 5000 -State Listen |
  Select-Object LocalAddress, LocalPort, OwningProcess
```

Stop that process only if you recognize it as a stale server instance. Otherwise,
choose another API port in `server/.env` and set `VITE_API_URL` in the client to
the matching URL (for example, `http://localhost:5001/api`).

## Available Scripts

### Client

```bash
npm run dev       # Start Vite development server
npm run build     # Create a production build
npm run preview   # Preview the production build
npm run lint      # Run ESLint
```

### Server

```bash
npm start         # Start the API server with Node
npm run dev       # Start with Nodemon
```

The server package currently has no automated test script; `npm test` is a placeholder that exits with an error.

## Runtime Files And Security

- Uploaded files are stored under `server/src/uploads/` during local development. The directory is ignored by Git except for its `.gitkeep` placeholder.
- Resume and audio files may contain personal information. Use object storage and access controls for production deployments instead of relying on a local filesystem.
- Use a strong random `JWT_SECRET` and keep Deepgram, Groq, and database credentials outside source control.
- The current WebRTC configuration uses a public Google STUN server. Add TURN servers in `client/src/hooks/useWebRTC.js` for reliable connections across restrictive networks.
- Configure a restricted CORS policy and HTTPS in production. Browser camera, microphone, and WebRTC features generally require a secure context outside localhost.
- The current Socket.IO room participant state is in memory, so multiple server instances require a shared Socket.IO adapter and coordinated session state.

## Project Status

The platform includes the core live interview, transcription, AI report, analytics, and PDF workflows. Deployment-specific concerns such as durable object storage, TURN infrastructure, background job queues, centralized socket state, and production observability should be addressed before a multi-instance production deployment.