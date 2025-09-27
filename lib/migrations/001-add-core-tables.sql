-- Migration: Add core tables for conversations, complexes, and detected data
-- Date: 2025-09-26
-- Description: Adds tables for persisting conversations, user complexes, and detected emotions/parts/needs

-- Create complexes table for user-created emotional complexes
CREATE TABLE IF NOT EXISTS complexes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create conversations table for storing full conversation history
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    complex_id UUID REFERENCES complexes(id) ON DELETE SET NULL,
    topic TEXT NOT NULL,
    title TEXT,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create detected_emotions table for storing AI-detected emotions from conversations
CREATE TABLE IF NOT EXISTS detected_emotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    emotions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create detected_parts table for storing AI-detected IFS parts from conversations
CREATE TABLE IF NOT EXISTS detected_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    parts JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create detected_needs table for storing AI-detected needs from conversations
CREATE TABLE IF NOT EXISTS detected_needs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    needs JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_complexes_user_id ON complexes(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_complex_id ON conversations(complex_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_detected_emotions_conversation_id ON detected_emotions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_detected_emotions_user_id ON detected_emotions(user_id);
CREATE INDEX IF NOT EXISTS idx_detected_parts_conversation_id ON detected_parts(conversation_id);
CREATE INDEX IF NOT EXISTS idx_detected_parts_user_id ON detected_parts(user_id);
CREATE INDEX IF NOT EXISTS idx_detected_needs_conversation_id ON detected_needs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_detected_needs_user_id ON detected_needs(user_id);

-- Create updated_at triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_complexes_updated_at BEFORE UPDATE ON complexes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE complexes ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE detected_emotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE detected_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE detected_needs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user data isolation
-- Users can only access their own complexes
CREATE POLICY "Users can view their own complexes" ON complexes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own complexes" ON complexes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own complexes" ON complexes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own complexes" ON complexes
    FOR DELETE USING (auth.uid() = user_id);

-- Users can only access their own conversations
CREATE POLICY "Users can view their own conversations" ON conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations" ON conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" ON conversations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" ON conversations
    FOR DELETE USING (auth.uid() = user_id);

-- Users can only access their own detected emotions
CREATE POLICY "Users can view their own detected emotions" ON detected_emotions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own detected emotions" ON detected_emotions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own detected emotions" ON detected_emotions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own detected emotions" ON detected_emotions
    FOR DELETE USING (auth.uid() = user_id);

-- Users can only access their own detected parts
CREATE POLICY "Users can view their own detected parts" ON detected_parts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own detected parts" ON detected_parts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own detected parts" ON detected_parts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own detected parts" ON detected_parts
    FOR DELETE USING (auth.uid() = user_id);

-- Users can only access their own detected needs
CREATE POLICY "Users can view their own detected needs" ON detected_needs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own detected needs" ON detected_needs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own detected needs" ON detected_needs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own detected needs" ON detected_needs
    FOR DELETE USING (auth.uid() = user_id);