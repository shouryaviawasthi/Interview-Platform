-- Phase 5 Migration: Interview Analytics
-- Stores deterministic conversational metrics, pauses, turns, filler words, language stats,
-- and AI semantic evaluations (topics, timeline, Q&A mapping, insights).

CREATE TABLE IF NOT EXISTS interview_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID UNIQUE NOT NULL,
  
  -- Speaking Time & Duration
  total_duration INTEGER,
  interviewer_speaking_time INTEGER,
  candidate_speaking_time INTEGER,
  interviewer_speaking_percentage DECIMAL(5,2),
  candidate_speaking_percentage DECIMAL(5,2),
  silence_duration INTEGER,
  
  -- Turns & Dynamics
  interviewer_turn_count INTEGER,
  candidate_turn_count INTEGER,
  total_turns INTEGER,
  average_interviewer_turn_duration DECIMAL(6,2),
  average_candidate_turn_duration DECIMAL(6,2),
  longest_turn_duration DECIMAL(6,2),
  
  -- Question & Answer Counts
  question_count INTEGER,
  follow_up_count INTEGER,
  
  -- Speech & Language Patterns
  candidate_filler_count INTEGER,
  interviewer_filler_count INTEGER,
  candidate_language_stats JSONB,
  interviewer_language_stats JSONB,
  
  -- Granular Nested Analytics (pauses, timeline, topics, Q&A mapping, insights)
  analytics_json JSONB,
  
  -- Processing Status
  status VARCHAR(20) CHECK (status IN ('not_started', 'processing', 'completed', 'failed')) DEFAULT 'not_started',
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_analytics_interview FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_interview_analytics_interview ON interview_analytics(interview_id);
