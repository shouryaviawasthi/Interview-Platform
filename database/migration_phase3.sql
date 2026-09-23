-- ============================================================
-- Phase 3 Migration: Audio + Transcript (Phase 3 shape)
-- ============================================================

-- Audio file storage (metadata only, binary in filesystem)
CREATE TABLE IF NOT EXISTS interview_audio (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id  UUID UNIQUE NOT NULL,
    file_path     TEXT NOT NULL,
    file_name     TEXT NOT NULL,
    mime_type     VARCHAR(100),
    file_size     BIGINT,
    status        VARCHAR(20)
        CHECK (status IN ('uploaded', 'processing', 'completed', 'failed'))
        DEFAULT 'uploaded',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at  TIMESTAMP,
    error_message TEXT,

    CONSTRAINT fk_audio_interview
        FOREIGN KEY (interview_id)
        REFERENCES interviews(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audio_interview ON interview_audio(interview_id);

-- Extend existing transcripts table with Phase 3 columns
ALTER TABLE transcripts
    ADD COLUMN IF NOT EXISTS speaker_type  VARCHAR(20)
        CHECK (speaker_type IN ('interviewer', 'candidate', 'unknown')),
    ADD COLUMN IF NOT EXISTS start_time    NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS end_time      NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS sequence_num  INTEGER,
    ADD COLUMN IF NOT EXISTS confidence    NUMERIC(5,4),
    ADD COLUMN IF NOT EXISTS language      VARCHAR(20);

-- Speaker assignment tracking (maps Deepgram speaker_0/speaker_1 to roles)
-- Stored as JSONB on interview_audio so we don't need a separate table
-- { "speaker_0": "interviewer", "speaker_1": "candidate" } or null if unassigned
ALTER TABLE interview_audio
    ADD COLUMN IF NOT EXISTS speaker_map JSONB;
