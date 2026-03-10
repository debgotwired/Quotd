-- Case Study Interrogator - Supabase Schema
-- Run this in the Supabase SQL Editor (supabase.com/dashboard → SQL Editor)

-- Interviews table
CREATE TABLE interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_company TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT DEFAULT 'Time Savings',
  status TEXT DEFAULT 'draft',
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  extraction_state JSONB DEFAULT '{"metrics":[],"quotes":[],"facts":{},"question_count":0}',
  draft_content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('assistant', 'user')),
  content TEXT NOT NULL,
  audio_url TEXT,
  audio_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: Add audio columns to existing messages table
-- Run this if the table already exists:
-- ALTER TABLE messages ADD COLUMN IF NOT EXISTS audio_url TEXT;
-- ALTER TABLE messages ADD COLUMN IF NOT EXISTS audio_path TEXT;

-- Indexes
CREATE INDEX idx_interviews_user_id ON interviews(user_id);
CREATE INDEX idx_interviews_share_token ON interviews(share_token);
CREATE INDEX idx_messages_interview_id ON messages(interview_id);

-- Enable Row Level Security
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policies for interviews
CREATE POLICY "Users can view own interviews" ON interviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own interviews" ON interviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own interviews" ON interviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own interviews" ON interviews FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view by share_token" ON interviews FOR SELECT USING (share_token IS NOT NULL);
CREATE POLICY "Service role can update any" ON interviews FOR UPDATE USING (true);

-- Policies for messages
CREATE POLICY "Anyone can view messages" ON messages FOR SELECT USING (true);
CREATE POLICY "Anyone can insert messages" ON messages FOR INSERT WITH CHECK (true);

-- =============================================================================
-- Profiles table (for multi-customer onboarding)
-- =============================================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_user_id ON profiles(user_id);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- OTP tokens table (for passwordless auth)
-- =============================================================================
CREATE TABLE otp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_otp_tokens_email ON otp_tokens(email);
ALTER TABLE otp_tokens ENABLE ROW LEVEL SECURITY;
-- No public policies - service role only
