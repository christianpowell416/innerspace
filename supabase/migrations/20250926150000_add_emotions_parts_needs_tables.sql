-- Migration: Add tables for emotions, parts, and needs pages
-- Date: 2025-09-26
-- Description: Adds comprehensive tables for user emotions, parts, needs, and their tracking

-- Create user_emotions table for tracking user's emotional states over time
CREATE TABLE IF NOT EXISTS user_emotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    emotion_name TEXT NOT NULL,
    intensity NUMERIC(4,2) NOT NULL CHECK (intensity >= 0 AND intensity <= 10),
    frequency INTEGER DEFAULT 1,
    category TEXT, -- e.g., 'primary', 'secondary', 'complex'
    color TEXT, -- Hex color for visualization
    notes TEXT,
    last_experienced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_parts table for tracking IFS parts
CREATE TABLE IF NOT EXISTS user_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    part_name TEXT NOT NULL,
    part_type TEXT NOT NULL, -- 'protector', 'exile', 'firefighter', 'self'
    intensity NUMERIC(4,2) NOT NULL CHECK (intensity >= 0 AND intensity <= 10),
    frequency INTEGER DEFAULT 1,
    description TEXT,
    role TEXT, -- What role this part plays
    triggers TEXT[], -- Array of triggers that activate this part
    color TEXT, -- Hex color for visualization
    notes TEXT,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_needs table for tracking human needs
CREATE TABLE IF NOT EXISTS user_needs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    need_name TEXT NOT NULL,
    category TEXT, -- e.g., 'physical', 'emotional', 'social', 'spiritual'
    current_level NUMERIC(4,2) CHECK (current_level >= 0 AND current_level <= 10),
    desired_level NUMERIC(4,2) CHECK (desired_level >= 0 AND desired_level <= 10),
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    strategies TEXT[], -- Array of strategies to meet this need
    color TEXT, -- Hex color for visualization
    notes TEXT,
    last_assessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create emotion_logs table for daily/periodic emotion tracking
CREATE TABLE IF NOT EXISTS emotion_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    emotion_id UUID REFERENCES user_emotions(id) ON DELETE CASCADE,
    emotion_name TEXT NOT NULL, -- Denormalized for flexibility
    intensity NUMERIC(4,2) NOT NULL CHECK (intensity >= 0 AND intensity <= 10),
    context TEXT, -- What was happening when this emotion was felt
    triggers TEXT[], -- What triggered this emotion
    duration_minutes INTEGER, -- How long the emotion lasted
    coping_strategies TEXT[], -- What helped manage the emotion
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create parts_sessions table for tracking parts work sessions
CREATE TABLE IF NOT EXISTS parts_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    part_id UUID REFERENCES user_parts(id) ON DELETE CASCADE,
    part_name TEXT NOT NULL, -- Denormalized for flexibility
    session_type TEXT, -- 'check-in', 'dialogue', 'integration', 'healing'
    intensity_before NUMERIC(4,2) CHECK (intensity_before >= 0 AND intensity_before <= 10),
    intensity_after NUMERIC(4,2) CHECK (intensity_after >= 0 AND intensity_after <= 10),
    notes TEXT,
    insights TEXT,
    next_steps TEXT,
    session_duration_minutes INTEGER,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create needs_assessments table for tracking needs fulfillment over time
CREATE TABLE IF NOT EXISTS needs_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    need_id UUID REFERENCES user_needs(id) ON DELETE CASCADE,
    need_name TEXT NOT NULL, -- Denormalized for flexibility
    current_level NUMERIC(4,2) NOT NULL CHECK (current_level >= 0 AND current_level <= 10),
    satisfaction NUMERIC(4,2) CHECK (satisfaction >= 0 AND satisfaction <= 10),
    strategies_used TEXT[], -- What strategies were used to meet this need
    barriers TEXT[], -- What prevented meeting this need
    support_received TEXT, -- Support from others
    reflection TEXT,
    assessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create aggregated_insights table for storing calculated insights
CREATE TABLE IF NOT EXISTS aggregated_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    insight_type TEXT NOT NULL, -- 'emotion_pattern', 'part_trend', 'need_correlation'
    insight_data JSONB NOT NULL,
    time_period TEXT, -- 'daily', 'weekly', 'monthly', 'all_time'
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- For caching
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user preferences table for customization
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    preference_category TEXT NOT NULL, -- 'emotions', 'parts', 'needs', 'general'
    preference_key TEXT NOT NULL,
    preference_value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, preference_category, preference_key)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_emotions_user_id ON user_emotions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_emotions_emotion_name ON user_emotions(emotion_name);
CREATE INDEX IF NOT EXISTS idx_user_emotions_last_experienced ON user_emotions(last_experienced DESC);

CREATE INDEX IF NOT EXISTS idx_user_parts_user_id ON user_parts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_parts_part_type ON user_parts(part_type);
CREATE INDEX IF NOT EXISTS idx_user_parts_last_active ON user_parts(last_active DESC);

CREATE INDEX IF NOT EXISTS idx_user_needs_user_id ON user_needs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_needs_category ON user_needs(category);
CREATE INDEX IF NOT EXISTS idx_user_needs_priority ON user_needs(priority DESC);

CREATE INDEX IF NOT EXISTS idx_emotion_logs_user_id ON emotion_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_emotion_logs_emotion_id ON emotion_logs(emotion_id);
CREATE INDEX IF NOT EXISTS idx_emotion_logs_logged_at ON emotion_logs(logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_parts_sessions_user_id ON parts_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_parts_sessions_part_id ON parts_sessions(part_id);
CREATE INDEX IF NOT EXISTS idx_parts_sessions_logged_at ON parts_sessions(logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_needs_assessments_user_id ON needs_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_needs_assessments_need_id ON needs_assessments(need_id);
CREATE INDEX IF NOT EXISTS idx_needs_assessments_assessed_at ON needs_assessments(assessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_aggregated_insights_user_id ON aggregated_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_aggregated_insights_type ON aggregated_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_aggregated_insights_expires_at ON aggregated_insights(expires_at);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_category ON user_preferences(preference_category);

-- Create updated_at triggers for automatic timestamp updates
CREATE TRIGGER update_user_emotions_updated_at BEFORE UPDATE ON user_emotions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_parts_updated_at BEFORE UPDATE ON user_parts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_needs_updated_at BEFORE UPDATE ON user_needs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE user_emotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE needs_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE aggregated_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user data isolation

-- User emotions policies
CREATE POLICY "Users can view their own emotions" ON user_emotions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own emotions" ON user_emotions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own emotions" ON user_emotions
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own emotions" ON user_emotions
    FOR DELETE USING (auth.uid() = user_id);

-- User parts policies
CREATE POLICY "Users can view their own parts" ON user_parts
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own parts" ON user_parts
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own parts" ON user_parts
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own parts" ON user_parts
    FOR DELETE USING (auth.uid() = user_id);

-- User needs policies
CREATE POLICY "Users can view their own needs" ON user_needs
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own needs" ON user_needs
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own needs" ON user_needs
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own needs" ON user_needs
    FOR DELETE USING (auth.uid() = user_id);

-- Emotion logs policies
CREATE POLICY "Users can view their own emotion logs" ON emotion_logs
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own emotion logs" ON emotion_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own emotion logs" ON emotion_logs
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own emotion logs" ON emotion_logs
    FOR DELETE USING (auth.uid() = user_id);

-- Parts sessions policies
CREATE POLICY "Users can view their own parts sessions" ON parts_sessions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own parts sessions" ON parts_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own parts sessions" ON parts_sessions
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own parts sessions" ON parts_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- Needs assessments policies
CREATE POLICY "Users can view their own needs assessments" ON needs_assessments
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own needs assessments" ON needs_assessments
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own needs assessments" ON needs_assessments
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own needs assessments" ON needs_assessments
    FOR DELETE USING (auth.uid() = user_id);

-- Aggregated insights policies
CREATE POLICY "Users can view their own insights" ON aggregated_insights
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own insights" ON aggregated_insights
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own insights" ON aggregated_insights
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own insights" ON aggregated_insights
    FOR DELETE USING (auth.uid() = user_id);

-- User preferences policies
CREATE POLICY "Users can view their own preferences" ON user_preferences
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own preferences" ON user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own preferences" ON user_preferences
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own preferences" ON user_preferences
    FOR DELETE USING (auth.uid() = user_id);