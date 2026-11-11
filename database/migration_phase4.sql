-- ============================================================
-- Phase 4 Migration: AI Reports
-- ============================================================

-- Candidate report per interview
CREATE TABLE IF NOT EXISTS candidate_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id    UUID UNIQUE NOT NULL,
    overall_score   DECIMAL(5,2),
    recommendation  VARCHAR(50),
    report_json     JSONB,
    llm_model       VARCHAR(100),
    status          VARCHAR(20)
        CHECK (status IN ('not_started','processing','completed','failed'))
        DEFAULT 'not_started',
    error_message   TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_candidate_report_interview
        FOREIGN KEY (interview_id)
        REFERENCES interviews(id)
        ON DELETE CASCADE
);

-- Interviewer report per interview
CREATE TABLE IF NOT EXISTS interviewer_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id    UUID UNIQUE NOT NULL,
    overall_score   DECIMAL(5,2),
    report_json     JSONB,
    llm_model       VARCHAR(100),
    status          VARCHAR(20)
        CHECK (status IN ('not_started','processing','completed','failed'))
        DEFAULT 'not_started',
    error_message   TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_interviewer_report_interview
        FOREIGN KEY (interview_id)
        REFERENCES interviews(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_candidate_reports_interview   ON candidate_reports(interview_id);
CREATE INDEX IF NOT EXISTS idx_interviewer_reports_interview ON interviewer_reports(interview_id);
