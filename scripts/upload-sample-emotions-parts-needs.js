/**
 * Upload Sample Emotions, Parts, and Needs Script
 * Creates sample data for the emotions/parts/needs pages for testing
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Make sure EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Sample emotions data
const sampleEmotions = [
  {
    emotion_name: 'Anxiety',
    intensity: 7.5,
    frequency: 12,
    category: 'primary',
    color: '#FF6B6B',
    notes: 'Often triggered by work deadlines and social situations'
  },
  {
    emotion_name: 'Joy',
    intensity: 8.2,
    frequency: 8,
    category: 'primary',
    color: '#4ECDC4',
    notes: 'Strongest when spending time with loved ones'
  },
  {
    emotion_name: 'Frustration',
    intensity: 6.8,
    frequency: 15,
    category: 'secondary',
    color: '#FFA07A',
    notes: 'Usually stems from feeling misunderstood'
  },
  {
    emotion_name: 'Sadness',
    intensity: 5.5,
    frequency: 6,
    category: 'primary',
    color: '#87CEEB',
    notes: 'Connected to grief and loss experiences'
  },
  {
    emotion_name: 'Excitement',
    intensity: 9.1,
    frequency: 4,
    category: 'primary',
    color: '#FFD700',
    notes: 'Peaks during creative projects and new experiences'
  },
  {
    emotion_name: 'Overwhelm',
    intensity: 8.7,
    frequency: 10,
    category: 'complex',
    color: '#DDA0DD',
    notes: 'Mix of anxiety and exhaustion during busy periods'
  },
  {
    emotion_name: 'Contentment',
    intensity: 6.2,
    frequency: 9,
    category: 'secondary',
    color: '#98FB98',
    notes: 'Quiet satisfaction during peaceful moments'
  },
  {
    emotion_name: 'Anger',
    intensity: 7.8,
    frequency: 5,
    category: 'primary',
    color: '#FF4500',
    notes: 'Usually about injustice or boundary violations'
  }
];

// Sample parts data
const sampleParts = [
  {
    part_name: 'The Perfectionist',
    part_type: 'protector',
    intensity: 8.5,
    frequency: 20,
    description: 'Works tirelessly to avoid criticism and failure',
    role: 'Ensures everything is done to the highest standard',
    triggers: ['deadlines', 'presentations', 'being evaluated'],
    color: '#FF6B6B',
    notes: 'Very active during work projects, sometimes exhausting'
  },
  {
    part_name: 'Inner Child',
    part_type: 'exile',
    intensity: 7.2,
    frequency: 8,
    description: 'The young, wounded part that holds early pain',
    role: 'Carries creativity, wonder, and old hurts',
    triggers: ['rejection', 'abandonment', 'criticism'],
    color: '#4ECDC4',
    notes: 'Needs lots of care and reassurance'
  },
  {
    part_name: 'The Caretaker',
    part_type: 'protector',
    intensity: 9.0,
    frequency: 18,
    description: 'Always putting others\' needs before my own',
    role: 'Maintains relationships and avoids conflict',
    triggers: ['others in distress', 'conflict', 'saying no'],
    color: '#98FB98',
    notes: 'Sometimes leads to burnout and resentment'
  },
  {
    part_name: 'The Critic',
    part_type: 'protector',
    intensity: 7.8,
    frequency: 25,
    description: 'Harsh internal voice that points out flaws',
    role: 'Tries to prevent mistakes and embarrassment',
    triggers: ['making mistakes', 'being judged', 'vulnerability'],
    color: '#FF4500',
    notes: 'Very loud voice, often unhelpful'
  },
  {
    part_name: 'The Rebel',
    part_type: 'firefighter',
    intensity: 6.5,
    frequency: 3,
    description: 'Acts out when feeling constrained or controlled',
    role: 'Asserts independence and pushes boundaries',
    triggers: ['authority', 'rules', 'feeling trapped'],
    color: '#DDA0DD',
    notes: 'Emerges when other parts are overwhelmed'
  },
  {
    part_name: 'Wise Self',
    part_type: 'self',
    intensity: 8.8,
    frequency: 12,
    description: 'The centered, compassionate core self',
    role: 'Provides wisdom, leadership, and healing',
    triggers: ['meditation', 'nature', 'quiet reflection'],
    color: '#FFD700',
    notes: 'Strongest during mindful moments'
  },
  {
    part_name: 'The Achiever',
    part_type: 'protector',
    intensity: 8.2,
    frequency: 16,
    description: 'Driven to succeed and prove worthiness',
    role: 'Pursues goals and external validation',
    triggers: ['competition', 'opportunities', 'challenges'],
    color: '#87CEEB',
    notes: 'Can be both motivating and exhausting'
  }
];

// Sample needs data
const sampleNeeds = [
  {
    need_name: 'Connection',
    category: 'social',
    current_level: 6.5,
    desired_level: 8.5,
    priority: 9,
    strategies: ['regular friend meetups', 'join clubs', 'deeper conversations'],
    color: '#4ECDC4',
    notes: 'Feeling somewhat isolated lately'
  },
  {
    need_name: 'Autonomy',
    category: 'emotional',
    current_level: 7.2,
    desired_level: 9.0,
    priority: 8,
    strategies: ['set boundaries', 'make independent choices', 'self-advocacy'],
    color: '#FFD700',
    notes: 'Want more control over my schedule'
  },
  {
    need_name: 'Rest',
    category: 'physical',
    current_level: 4.8,
    desired_level: 8.0,
    priority: 10,
    strategies: ['better sleep hygiene', 'regular breaks', 'sabbaticals'],
    color: '#98FB98',
    notes: 'Chronically exhausted, need better rest'
  },
  {
    need_name: 'Creativity',
    category: 'spiritual',
    current_level: 5.5,
    desired_level: 8.5,
    priority: 7,
    strategies: ['art projects', 'writing', 'music', 'dance'],
    color: '#DDA0DD',
    notes: 'Missing creative expression in daily life'
  },
  {
    need_name: 'Safety',
    category: 'physical',
    current_level: 8.0,
    desired_level: 8.5,
    priority: 9,
    strategies: ['financial planning', 'self-defense', 'secure housing'],
    color: '#FF6B6B',
    notes: 'Generally feel safe but want financial security'
  },
  {
    need_name: 'Growth',
    category: 'emotional',
    current_level: 7.8,
    desired_level: 9.2,
    priority: 8,
    strategies: ['therapy', 'courses', 'challenges', 'feedback'],
    color: '#87CEEB',
    notes: 'Always seeking personal development'
  },
  {
    need_name: 'Fun',
    category: 'emotional',
    current_level: 5.2,
    desired_level: 7.5,
    priority: 6,
    strategies: ['games', 'adventures', 'humor', 'spontaneity'],
    color: '#FFA07A',
    notes: 'Life feels too serious lately'
  },
  {
    need_name: 'Purpose',
    category: 'spiritual',
    current_level: 6.8,
    desired_level: 9.0,
    priority: 9,
    strategies: ['volunteering', 'meaningful work', 'helping others'],
    color: '#FF4500',
    notes: 'Want to feel more impact in the world'
  }
];

// Sample emotion logs (recent experiences)
const generateEmotionLogs = (userId, emotions) => {
  const logs = [];
  const now = new Date();

  // Generate logs for the past 30 days
  for (let i = 0; i < 30; i++) {
    const logDate = new Date(now);
    logDate.setDate(logDate.getDate() - i);

    // Randomly select 1-3 emotions for this day
    const dailyEmotions = emotions.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);

    dailyEmotions.forEach(emotion => {
      logs.push({
        user_id: userId,
        emotion_name: emotion.emotion_name,
        intensity: Math.max(1, Math.min(10, emotion.intensity + (Math.random() - 0.5) * 3)),
        context: generateContext(),
        triggers: generateTriggers(),
        duration_minutes: Math.floor(Math.random() * 120) + 15,
        coping_strategies: generateCopingStrategies(),
        logged_at: logDate.toISOString()
      });
    });
  }

  return logs;
};

const generateContext = () => {
  const contexts = [
    'Work meeting',
    'Family dinner',
    'Social gathering',
    'Alone time',
    'Exercise',
    'Commuting',
    'Morning routine',
    'Evening wind-down',
    'Weekend activities',
    'Unexpected situation'
  ];
  return contexts[Math.floor(Math.random() * contexts.length)];
};

const generateTriggers = () => {
  const triggers = [
    'stress', 'deadline', 'conflict', 'success', 'surprise', 'memory',
    'music', 'weather', 'interaction', 'achievement', 'setback', 'change'
  ];
  return triggers.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);
};

const generateCopingStrategies = () => {
  const strategies = [
    'deep breathing', 'talking to friend', 'journaling', 'exercise', 'meditation',
    'music', 'nature walk', 'creative activity', 'rest', 'problem-solving'
  ];
  return strategies.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 2) + 1);
};

async function uploadSampleEmotionsPartsNeeds() {
  try {
    console.log('🚀 Starting emotions, parts, and needs data upload...');

    // Get the user ID from the profiles table
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (profileError) {
      console.error('❌ Error fetching user profile:', profileError);
      return;
    }

    if (!profiles || profiles.length === 0) {
      console.error('❌ No user profiles found. Please create a user account first.');
      return;
    }

    const userId = profiles[0].id;
    console.log('👤 Using user ID:', userId);

    // Upload emotions
    console.log('💾 Uploading emotions...');
    for (const emotion of sampleEmotions) {
      const emotionData = {
        ...emotion,
        user_id: userId,
        last_experienced: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: emotionError } = await supabase
        .from('user_emotions')
        .insert(emotionData);

      if (emotionError && emotionError.code !== '23505') {
        console.error(`❌ Error uploading emotion ${emotion.emotion_name}:`, emotionError);
      } else {
        console.log(`✅ Uploaded emotion: ${emotion.emotion_name}`);
      }
    }

    // Upload parts
    console.log('🧩 Uploading parts...');
    for (const part of sampleParts) {
      const partData = {
        ...part,
        user_id: userId,
        last_active: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: partError } = await supabase
        .from('user_parts')
        .insert(partData);

      if (partError && partError.code !== '23505') {
        console.error(`❌ Error uploading part ${part.part_name}:`, partError);
      } else {
        console.log(`✅ Uploaded part: ${part.part_name}`);
      }
    }

    // Upload needs
    console.log('🎯 Uploading needs...');
    for (const need of sampleNeeds) {
      const needData = {
        ...need,
        user_id: userId,
        last_assessed: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: needError } = await supabase
        .from('user_needs')
        .insert(needData);

      if (needError && needError.code !== '23505') {
        console.error(`❌ Error uploading need ${need.need_name}:`, needError);
      } else {
        console.log(`✅ Uploaded need: ${need.need_name}`);
      }
    }

    // Upload emotion logs
    console.log('📝 Uploading emotion logs...');
    const emotionLogs = generateEmotionLogs(userId, sampleEmotions);

    for (const log of emotionLogs) {
      const { error: logError } = await supabase
        .from('emotion_logs')
        .insert(log);

      if (logError && logError.code !== '23505') {
        console.error(`❌ Error uploading emotion log:`, logError);
      }
    }
    console.log(`✅ Uploaded ${emotionLogs.length} emotion logs`);

    console.log('🎉 Sample emotions, parts, and needs upload completed successfully!');
    console.log('📊 Created:');
    console.log(`   • ${sampleEmotions.length} emotions`);
    console.log(`   • ${sampleParts.length} parts`);
    console.log(`   • ${sampleNeeds.length} needs`);
    console.log(`   • ${emotionLogs.length} emotion logs`);
    console.log('✨ You can now test the emotions/parts/needs functionality with real data!');

  } catch (error) {
    console.error('❌ Upload failed:', error);
  }
}

// Run the upload
uploadSampleEmotionsPartsNeeds();