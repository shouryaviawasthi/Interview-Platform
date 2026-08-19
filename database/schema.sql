-- ============================================================
-- AI Interview Platform Database Schema
-- PostgreSQL (Neon)
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS TABLE
-- ============================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL,

    email VARCHAR(255) UNIQUE NOT NULL,

    password VARCHAR(255) NOT NULL,

    role VARCHAR(20)
        CHECK (role IN ('interviewer', 'admin'))
        DEFAULT 'interviewer',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- INTERVIEWS TABLE
-- ============================================================

CREATE TABLE interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    interviewer_id UUID NOT NULL,

    candidate_name VARCHAR(100) NOT NULL,

    candidate_email VARCHAR(255) NOT NULL,

    job_description TEXT NOT NULL,

    join_token UUID UNIQUE DEFAULT gen_random_uuid(),

    status VARCHAR(20)
        CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled'))
        DEFAULT 'scheduled',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    started_at TIMESTAMP,

    ended_at TIMESTAMP,

    CONSTRAINT fk_interviewer
        FOREIGN KEY (interviewer_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- ============================================================
-- RESUMES TABLE
-- ============================================================

CREATE TABLE resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    interview_id UUID UNIQUE NOT NULL,

    resume_file_url TEXT NOT NULL,

    resume_text TEXT NOT NULL,

    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_resume_interview
        FOREIGN KEY (interview_id)
        REFERENCES interviews(id)
        ON DELETE CASCADE
);

-- ============================================================
-- TRANSCRIPTS TABLE
-- ============================================================

CREATE TABLE transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    interview_id UUID NOT NULL,

    speaker VARCHAR(20)
        CHECK (speaker IN ('interviewer', 'candidate'))
        NOT NULL,

    time_offset_seconds NUMERIC(10,2) NOT NULL,

    transcript_text TEXT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_transcript_interview
        FOREIGN KEY (interview_id)
        REFERENCES interviews(id)
        ON DELETE CASCADE
);

-- ============================================================
-- REPORTS TABLE
-- ============================================================

CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    interview_id UUID UNIQUE NOT NULL,

    -- Candidate AI Evaluation
    candidate_report JSONB NOT NULL,
    candidate_score DECIMAL(5,2),

    candidate_recommendation VARCHAR(20)
        CHECK (candidate_recommendation IN ('Hire', 'Maybe', 'Reject')),

    -- Interviewer AI Evaluation
    interviewer_report JSONB NOT NULL,
    interviewer_score DECIMAL(5,2),

    -- AI Metadata
    llm_model VARCHAR(100) NOT NULL,

    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_report_interview
        FOREIGN KEY (interview_id)
        REFERENCES interviews(id)
        ON DELETE CASCADE
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_users_email
ON users(email);

CREATE INDEX idx_interviews_interviewer
ON interviews(interviewer_id);

CREATE INDEX idx_interviews_status
ON interviews(status);

CREATE INDEX idx_resumes_interview
ON resumes(interview_id);

CREATE INDEX idx_transcripts_interview
ON transcripts(interview_id);

CREATE INDEX idx_reports_interview
ON reports(interview_id);