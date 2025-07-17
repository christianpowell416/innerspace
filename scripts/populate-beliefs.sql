-- Populate beliefs table with sample data
-- Run this in your Supabase SQL editor

-- First, let's clear any existing data (optional)
-- DELETE FROM beliefs;

-- Insert sample beliefs with updated noun labels
INSERT INTO beliefs (
  id, 
  user_id, 
  emotion, 
  notes, 
  "feminine-masculine", 
  "dark-light", 
  "child-parent", 
  frequency, 
  ai_conversation_summary,
  belief, 
  released, 
  created_at, 
  updated_at
) VALUES
  (
    'sample-1',
    'sample-user-id', -- Replace with actual user ID
    'Confidence',
    'Feeling ready to tackle the day ahead',
    2, 1, -1, 7,
    'You expressed feeling energized and prepared for upcoming challenges. We explored how your inner strength (masculine energy) and optimism (light) are balancing with some protective awareness (slight child energy). This confidence seems rooted in recent accomplishments and self-trust.',
    'I need to prove my worth through achievements to be valuable',
    false,
    '2024-01-15T09:30:00Z',
    '2024-01-15T09:30:00Z'
  ),
  (
    'sample-2',
    'sample-user-id',
    'Overwhelm',
    'Too many tasks at once',
    -1, -2, 2, 4,
    'We discussed how multiple demands are creating internal chaos. Your feminine energy is seeking flow and connection, while the darker emotions reflect feeling lost. The child part is trying to play and feel safe. We identified breaking tasks into smaller pieces as a path forward.',
    'I must handle everything perfectly or I''ll disappoint everyone',
    false,
    '2024-01-15T14:15:00Z',
    '2024-01-15T14:15:00Z'
  ),
  (
    'sample-3',
    'sample-user-id',
    'Peace',
    'Evening meditation session',
    0, 3, 1, 9,
    'Your meditation practice created a beautiful balance between all parts of yourself. The light energy is strong, indicating clarity and spiritual connection. The gentle child energy suggests openness and wonder. This state represents harmony between your inner masculine and feminine aspects.',
    'I must constantly seek inner peace or I''ll lose myself to chaos',
    false,
    '2024-01-14T20:45:00Z',
    '2024-01-14T20:45:00Z'
  ),
  (
    'sample-4',
    'sample-user-id',
    'Frustration',
    'Meeting didn''t go as planned',
    1, -1, -2, 6,
    null,
    'When things don''t go as planned, it means I''m not good enough',
    false,
    '2024-01-14T12:00:00Z',
    '2024-01-14T12:00:00Z'
  ),
  (
    'sample-5',
    'sample-user-id',
    'Joy',
    'Spending time with friends',
    -2, 2, 3, 8,
    null,
    'I need others'' approval and company to feel truly happy',
    false,
    '2024-01-13T18:30:00Z',
    '2024-01-13T18:30:00Z'
  ),
  (
    'sample-6',
    'sample-user-id',
    'Neutrality',
    'Just woke up, feeling balanced',
    0, 0, 0, 5,
    null,
    'Being emotionally neutral means I''m not living life fully',
    false,
    '2024-01-13T07:00:00Z',
    '2024-01-13T07:00:00Z'
  ),
  (
    'sample-7',
    'sample-user-id',
    'Anger',
    'Traffic jam made me late',
    3, -3, -3, 3,
    null,
    'External circumstances have complete control over my emotional state',
    false,
    '2024-01-12T16:20:00Z',
    '2024-01-12T16:20:00Z'
  ),
  (
    'sample-8',
    'sample-user-id',
    'Curiosity',
    'Learning something new',
    -1, 1, 2, 7,
    null,
    'I must understand everything immediately or I''m not smart enough',
    false,
    '2024-01-12T10:15:00Z',
    '2024-01-12T10:15:00Z'
  ),
  (
    'sample-9',
    'sample-user-id',
    'Melancholy',
    'Reflecting on the past',
    -3, -1, 1, 6,
    null,
    'My past defines who I am and limits what I can become',
    false,
    '2024-01-11T22:00:00Z',
    '2024-01-11T22:00:00Z'
  ),
  (
    'sample-10',
    'sample-user-id',
    'Determination',
    'Working on an important project',
    2, 2, -1, 8,
    null,
    'I must achieve success at all costs or I''m a failure',
    false,
    '2024-01-11T15:45:00Z',
    '2024-01-11T15:45:00Z'
  );

-- Note: Replace 'sample-user-id' with your actual user ID
-- You can find your user ID by running: SELECT id FROM auth.users WHERE email = 'your-email@example.com';