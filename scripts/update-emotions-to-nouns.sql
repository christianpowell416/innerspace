-- Update any adjective emotion labels to noun forms in the beliefs table
-- Run this in your Supabase SQL editor

UPDATE beliefs
SET emotion = CASE emotion
  -- Common adjective to noun conversions
  WHEN 'Confident' THEN 'Confidence'
  WHEN 'Peaceful' THEN 'Peace'
  WHEN 'Joyful' THEN 'Joy'
  WHEN 'Frustrated' THEN 'Frustration'
  WHEN 'Angry' THEN 'Anger'
  WHEN 'Curious' THEN 'Curiosity'
  WHEN 'Determined' THEN 'Determination'
  WHEN 'Melancholic' THEN 'Melancholy'
  WHEN 'Overwhelmed' THEN 'Overwhelm'
  WHEN 'Neutral' THEN 'Neutrality'
  WHEN 'Anxious' THEN 'Anxiety'
  WHEN 'Sad' THEN 'Sadness'
  WHEN 'Happy' THEN 'Happiness'
  WHEN 'Fearful' THEN 'Fear'
  WHEN 'Grateful' THEN 'Gratitude'
  WHEN 'Hopeful' THEN 'Hope'
  WHEN 'Loving' THEN 'Love'
  WHEN 'Excited' THEN 'Excitement'
  WHEN 'Calm' THEN 'Calmness'
  WHEN 'Content' THEN 'Contentment'
  WHEN 'Disappointed' THEN 'Disappointment'
  WHEN 'Ashamed' THEN 'Shame'
  WHEN 'Guilty' THEN 'Guilt'
  WHEN 'Proud' THEN 'Pride'
  WHEN 'Embarrassed' THEN 'Embarrassment'
  WHEN 'Jealous' THEN 'Jealousy'
  WHEN 'Envious' THEN 'Envy'
  WHEN 'Disgusted' THEN 'Disgust'
  WHEN 'Surprised' THEN 'Surprise'
  WHEN 'Confused' THEN 'Confusion'
  WHEN 'Bored' THEN 'Boredom'
  WHEN 'Lonely' THEN 'Loneliness'
  WHEN 'Empowered' THEN 'Empowerment'
  WHEN 'Vulnerable' THEN 'Vulnerability'
  WHEN 'Nostalgic' THEN 'Nostalgia'
  WHEN 'Inspired' THEN 'Inspiration'
  WHEN 'Motivated' THEN 'Motivation'
  WHEN 'Relaxed' THEN 'Relaxation'
  WHEN 'Stressed' THEN 'Stress'
  WHEN 'Worried' THEN 'Worry'
  WHEN 'Tense' THEN 'Tension'
  WHEN 'Restless' THEN 'Restlessness'
  WHEN 'Impatient' THEN 'Impatience'
  WHEN 'Patient' THEN 'Patience'
  WHEN 'Compassionate' THEN 'Compassion'
  WHEN 'Sympathetic' THEN 'Sympathy'
  WHEN 'Empathetic' THEN 'Empathy'
  ELSE emotion -- Keep as-is if not in the list
END
WHERE emotion IN (
  'Confident', 'Peaceful', 'Joyful', 'Frustrated', 'Angry', 
  'Curious', 'Determined', 'Melancholic', 'Overwhelmed', 'Neutral',
  'Anxious', 'Sad', 'Happy', 'Fearful', 'Grateful',
  'Hopeful', 'Loving', 'Excited', 'Calm', 'Content',
  'Disappointed', 'Ashamed', 'Guilty', 'Proud', 'Embarrassed',
  'Jealous', 'Envious', 'Disgusted', 'Surprised', 'Confused',
  'Bored', 'Lonely', 'Empowered', 'Vulnerable', 'Nostalgic',
  'Inspired', 'Motivated', 'Relaxed', 'Stressed', 'Worried',
  'Tense', 'Restless', 'Impatient', 'Patient', 'Compassionate',
  'Sympathetic', 'Empathetic'
);

-- Show the count of updated records
SELECT COUNT(*) as updated_count 
FROM beliefs 
WHERE emotion IN (
  'Confident', 'Peaceful', 'Joyful', 'Frustrated', 'Angry', 
  'Curious', 'Determined', 'Melancholic', 'Overwhelmed', 'Neutral',
  'Anxious', 'Sad', 'Happy', 'Fearful', 'Grateful',
  'Hopeful', 'Loving', 'Excited', 'Calm', 'Content',
  'Disappointed', 'Ashamed', 'Guilty', 'Proud', 'Embarrassed',
  'Jealous', 'Envious', 'Disgusted', 'Surprised', 'Confused',
  'Bored', 'Lonely', 'Empowered', 'Vulnerable', 'Nostalgic',
  'Inspired', 'Motivated', 'Relaxed', 'Stressed', 'Worried',
  'Tense', 'Restless', 'Impatient', 'Patient', 'Compassionate',
  'Sympathetic', 'Empathetic'
);