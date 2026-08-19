User
│
├── id
├── name
├── email
├── password
└── created_at


Interview
│
├── id
├── interviewer_id
├── candidate_name
├── candidate_email
├── job_description
├── join_token
├── status
├── created_at
└── ended_at


Resume
│
├── id
├── interview_id
├── resume_url
├── resume_text
└── uploaded_at


Transcript
│
├── id
├── interview_id
├── speaker
├── timestamp
└── text


Report
│
├── id
├── interview_id
├── candidate_report
├── interviewer_report
├── candidate_score
└── generated_at





User
 │
 │ 1
 │
 │ N
Interview
 │
 ├──────── Resume (1 : 1)
 │
 ├──────── Transcript (1 : N)
 │
 └──────── Report (1 : 1)