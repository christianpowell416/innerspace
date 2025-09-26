/**
 * Upload Sample Conversations Script
 * Creates sample conversation data in Supabase for testing conversation history functionality
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

// Sample conversations with realistic therapeutic dialogue
const sampleConversations = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    topic: 'anxiety',
    title: 'Job Interview Anxiety',
    messages: [
      {
        id: 'msg_001_1',
        type: 'user',
        text: "I have a job interview tomorrow and I'm feeling really anxious about it. I keep thinking about all the things that could go wrong.",
        timestamp: new Date('2024-09-15T10:00:00Z').getTime()
      },
      {
        id: 'msg_001_2',
        type: 'assistant',
        text: "It sounds like your mind is running through worst-case scenarios. That anticipatory anxiety can feel overwhelming. What specifically are you most worried about happening in the interview?",
        timestamp: new Date('2024-09-15T10:01:00Z').getTime()
      },
      {
        id: 'msg_001_3',
        type: 'user',
        text: "I'm worried I'll freeze up when they ask me questions, or that I'll say something stupid. I really need this job and I don't want to mess it up.",
        timestamp: new Date('2024-09-15T10:02:30Z').getTime()
      },
      {
        id: 'msg_001_4',
        type: 'assistant',
        text: "I hear how important this opportunity is to you, and how much pressure you're putting on yourself. What would it feel like to approach this interview with curiosity rather than fear? What if we practiced some grounding techniques you could use if you start to feel overwhelmed?",
        timestamp: new Date('2024-09-15T10:04:00Z').getTime()
      },
      {
        id: 'msg_001_5',
        type: 'user',
        text: "That would actually be really helpful. I tend to hold my breath when I get nervous.",
        timestamp: new Date('2024-09-15T10:05:15Z').getTime()
      },
      {
        id: 'msg_001_6',
        type: 'assistant',
        text: "Breathing is such a powerful anchor. Let's try the 4-7-8 technique: breathe in for 4 counts, hold for 7, exhale for 8. This activates your parasympathetic nervous system. You can do this discreetly even during the interview. What part of you needs the most reassurance right now?",
        timestamp: new Date('2024-09-15T10:06:30Z').getTime()
      }
    ],
    summary: 'Explored pre-interview anxiety and developed coping strategies including breathing techniques and self-compassion practices.',
    created_at: new Date('2024-09-15T10:00:00Z').toISOString()
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    topic: 'relationships',
    title: 'Childhood Rejection',
    messages: [
      {
        id: 'msg_002_1',
        type: 'user',
        text: "I've been thinking about how I always feel left out in groups, even with close friends. It's like I'm waiting for them to realize I don't belong.",
        timestamp: new Date('2024-09-12T14:00:00Z').getTime()
      },
      {
        id: 'msg_002_2',
        type: 'assistant',
        text: "That feeling of not belonging can be so painful. It sounds like there's a part of you that's always scanning for signs of rejection. When did you first notice this pattern?",
        timestamp: new Date('2024-09-12T14:01:00Z').getTime()
      },
      {
        id: 'msg_002_3',
        type: 'user',
        text: "Probably in elementary school. I remember being picked last for teams and eating lunch alone sometimes. My parents were going through a divorce and I felt like everything was my fault.",
        timestamp: new Date('2024-09-12T14:02:30Z').getTime()
      },
      {
        id: 'msg_002_4',
        type: 'assistant',
        text: "That little kid who felt responsible for the divorce and experienced rejection at school learned some powerful survival strategies. Can you see how that young part of you is still trying to protect you from being hurt again?",
        timestamp: new Date('2024-09-12T14:04:00Z').getTime()
      },
      {
        id: 'msg_002_5',
        type: 'user',
        text: "Yeah, it's like I pull away before they can pull away from me. But then I end up feeling lonely anyway.",
        timestamp: new Date('2024-09-12T14:05:15Z').getTime()
      },
      {
        id: 'msg_002_6',
        type: 'assistant',
        text: "What a wise observation. That protective part creates the very thing it's trying to prevent. What would it be like to stay present when that urge to withdraw comes up? What would you need to feel safe enough to stay connected?",
        timestamp: new Date('2024-09-12T14:06:30Z').getTime()
      }
    ],
    summary: 'Traced current relationship patterns back to childhood experiences of divorce and rejection, exploring protective mechanisms.',
    created_at: new Date('2024-09-12T14:00:00Z').toISOString()
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    topic: 'relationships',
    title: 'Partner Communication',
    messages: [
      {
        id: 'msg_003_1',
        type: 'user',
        text: "My partner and I had another fight last night. They said I never listen and always get defensive, but I feel like they're attacking me when they bring up problems.",
        timestamp: new Date('2024-09-10T19:00:00Z').getTime()
      },
      {
        id: 'msg_003_2',
        type: 'assistant',
        text: "It sounds like you both care deeply but are stuck in a painful cycle. When you hear 'you never listen,' what happens inside your body? What do you notice?",
        timestamp: new Date('2024-09-10T19:01:00Z').getTime()
      },
      {
        id: 'msg_003_3',
        type: 'user',
        text: "My chest gets tight and I feel this surge of anger. Like I want to defend myself and prove them wrong. But then I just end up saying things I regret.",
        timestamp: new Date('2024-09-10T19:02:30Z').getTime()
      },
      {
        id: 'msg_003_4',
        type: 'assistant',
        text: "That chest tightness and surge of anger - that sounds like a part of you that feels misunderstood and wants to be seen. What if we could slow down that moment when you feel attacked? What would help you stay curious about what your partner is really trying to tell you?",
        timestamp: new Date('2024-09-10T19:04:00Z').getTime()
      },
      {
        id: 'msg_003_5',
        type: 'user',
        text: "I guess I could try to breathe first. And maybe ask them to help me understand instead of immediately explaining why they're wrong.",
        timestamp: new Date('2024-09-10T19:05:15Z').getTime()
      }
    ],
    summary: 'Worked on communication patterns and reactive responses in romantic relationship, developing tools for staying present during conflict.',
    created_at: new Date('2024-09-10T19:00:00Z').toISOString()
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    topic: 'self-worth',
    title: 'Perfectionism Issues',
    messages: [
      {
        id: 'msg_004_1',
        type: 'user',
        text: "I spent three hours on a work email today that should have taken ten minutes. I keep rewriting everything because it never feels good enough.",
        timestamp: new Date('2024-09-08T16:00:00Z').getTime()
      },
      {
        id: 'msg_004_2',
        type: 'assistant',
        text: "Three hours for one email - that sounds exhausting. What happens if you imagine sending that email after just one revision? What comes up for you?",
        timestamp: new Date('2024-09-08T16:01:00Z').getTime()
      },
      {
        id: 'msg_004_3',
        type: 'user',
        text: "Panic, honestly. Like everyone will think I'm incompetent or lazy. My mom always said 'if you're going to do something, do it right the first time.'",
        timestamp: new Date('2024-09-08T16:02:30Z').getTime()
      },
      {
        id: 'msg_004_4',
        type: 'assistant',
        text: "Ah, so there's a part of you that learned early that your worth depends on getting things perfect. That's a heavy burden for any part to carry. What would it be like to appreciate that part for trying so hard to keep you safe and valued?",
        timestamp: new Date('2024-09-08T16:04:00Z').getTime()
      },
      {
        id: 'msg_004_5',
        type: 'user',
        text: "I never thought about thanking it. It does work really hard. But it's also making me miserable and slowing me down.",
        timestamp: new Date('2024-09-08T16:05:15Z').getTime()
      },
      {
        id: 'msg_004_6',
        type: 'assistant',
        text: "Exactly - it's been working overtime trying to protect you from criticism or failure. What if we could let that part know that your worth isn't dependent on perfection? What would 'good enough' look like for that email?",
        timestamp: new Date('2024-09-08T16:06:30Z').getTime()
      }
    ],
    summary: 'Explored perfectionist patterns and their childhood origins, working on self-compassion and "good enough" standards.',
    created_at: new Date('2024-09-08T16:00:00Z').toISOString()
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440005',
    topic: 'grief',
    title: 'Grief Processing',
    messages: [
      {
        id: 'msg_005_1',
        type: 'user',
        text: "It's been three months since my dad died and I feel like I should be doing better. People keep asking if I'm okay and I don't know how to answer.",
        timestamp: new Date('2024-09-05T11:00:00Z').getTime()
      },
      {
        id: 'msg_005_2',
        type: 'assistant',
        text: "Grief doesn't follow a timeline, and three months is still so recent. When people ask if you're okay, what do you wish you could tell them?",
        timestamp: new Date('2024-09-05T11:01:00Z').getTime()
      },
      {
        id: 'msg_005_3',
        type: 'user',
        text: "That I'm not okay and I might not be okay for a long time. That some days I can barely function and other days I almost forget he's gone, which makes me feel guilty.",
        timestamp: new Date('2024-09-05T11:02:30Z').getTime()
      },
      {
        id: 'msg_005_4',
        type: 'assistant',
        text: "Those moments when you almost forget - that's not betrayal, that's your psyche giving you small breaks from the intensity of grief. Your nervous system is actually protecting you. What was your relationship with your father like?",
        timestamp: new Date('2024-09-05T11:04:00Z').getTime()
      },
      {
        id: 'msg_005_5',
        type: 'user',
        text: "Complicated. We were just starting to get closer after years of distance. I keep thinking about all the conversations we'll never have.",
        timestamp: new Date('2024-09-05T11:05:15Z').getTime()
      },
      {
        id: 'msg_005_6',
        type: 'assistant',
        text: "Grieving someone you had a complicated relationship with adds another layer. You're mourning not just who he was, but who he could have become to you. What would you want to say to him now if you could?",
        timestamp: new Date('2024-09-05T11:06:30Z').getTime()
      }
    ],
    summary: 'Processed complicated grief and guilt around relationship dynamics, normalizing the non-linear nature of mourning.',
    created_at: new Date('2024-09-05T11:00:00Z').toISOString()
  }
];

// Sample detected data for each conversation
const sampleDetectedData = [
  {
    conversation_id: '550e8400-e29b-41d4-a716-446655440001',
    emotions: [
      { name: 'anxiety', confidence: 0.95, context: 'job interview preparation' },
      { name: 'fear', confidence: 0.88, context: 'fear of failure' },
      { name: 'hope', confidence: 0.72, context: 'learning coping strategies' }
    ],
    parts: [
      { name: 'anxious achiever', confidence: 0.91, context: 'perfectionist part driving success' },
      { name: 'inner critic', confidence: 0.84, context: 'catastrophizing thoughts' },
      { name: 'wise adult', confidence: 0.76, context: 'seeking healthy coping' }
    ],
    needs: [
      { name: 'security', confidence: 0.93, context: 'job stability and financial safety' },
      { name: 'competence', confidence: 0.87, context: 'feeling capable and skilled' },
      { name: 'self-compassion', confidence: 0.79, context: 'being kind to self' }
    ]
  },
  {
    conversation_id: '550e8400-e29b-41d4-a716-446655440002',
    emotions: [
      { name: 'loneliness', confidence: 0.96, context: 'feeling left out in groups' },
      { name: 'sadness', confidence: 0.89, context: 'childhood rejection memories' },
      { name: 'insight', confidence: 0.81, context: 'understanding protective patterns' }
    ],
    parts: [
      { name: 'wounded child', confidence: 0.94, context: 'hurt from childhood rejection' },
      { name: 'protector', confidence: 0.88, context: 'withdrawing to avoid hurt' },
      { name: 'observer', confidence: 0.75, context: 'gaining awareness of patterns' }
    ],
    needs: [
      { name: 'belonging', confidence: 0.97, context: 'feeling included and valued' },
      { name: 'safety', confidence: 0.91, context: 'emotional safety in relationships' },
      { name: 'understanding', confidence: 0.83, context: 'being seen and accepted' }
    ]
  },
  {
    conversation_id: '550e8400-e29b-41d4-a716-446655440003',
    emotions: [
      { name: 'anger', confidence: 0.92, context: 'defensive reactions in conflict' },
      { name: 'frustration', confidence: 0.88, context: 'communication breakdown' },
      { name: 'love', confidence: 0.76, context: 'caring about the relationship' }
    ],
    parts: [
      { name: 'defender', confidence: 0.91, context: 'protecting against criticism' },
      { name: 'reactive child', confidence: 0.85, context: 'feeling attacked and misunderstood' },
      { name: 'wise mediator', confidence: 0.72, context: 'seeking understanding' }
    ],
    needs: [
      { name: 'understanding', confidence: 0.94, context: 'feeling heard and seen' },
      { name: 'respect', confidence: 0.87, context: 'being valued in relationship' },
      { name: 'connection', confidence: 0.81, context: 'maintaining closeness' }
    ]
  },
  {
    conversation_id: '550e8400-e29b-41d4-a716-446655440004',
    emotions: [
      { name: 'anxiety', confidence: 0.93, context: 'perfectionist worry' },
      { name: 'shame', confidence: 0.87, context: 'not being good enough' },
      { name: 'relief', confidence: 0.74, context: 'understanding the pattern' }
    ],
    parts: [
      { name: 'perfectionist', confidence: 0.96, context: 'driving impossible standards' },
      { name: 'inner critic', confidence: 0.91, context: 'harsh self-judgment' },
      { name: 'compassionate witness', confidence: 0.78, context: 'developing self-kindness' }
    ],
    needs: [
      { name: 'self-acceptance', confidence: 0.95, context: 'accepting imperfection' },
      { name: 'efficiency', confidence: 0.82, context: 'getting things done without overwhelm' },
      { name: 'peace', confidence: 0.79, context: 'inner calm and ease' }
    ]
  },
  {
    conversation_id: '550e8400-e29b-41d4-a716-446655440005',
    emotions: [
      { name: 'grief', confidence: 0.98, context: 'mourning father\'s death' },
      { name: 'guilt', confidence: 0.89, context: 'complicated relationship feelings' },
      { name: 'acceptance', confidence: 0.71, context: 'normalizing grief process' }
    ],
    parts: [
      { name: 'grieving heart', confidence: 0.97, context: 'processing loss and pain' },
      { name: 'guilty conscience', confidence: 0.86, context: 'regret about missed opportunities' },
      { name: 'wise mourner', confidence: 0.73, context: 'honoring the complexity of grief' }
    ],
    needs: [
      { name: 'healing', confidence: 0.96, context: 'processing grief and loss' },
      { name: 'forgiveness', confidence: 0.88, context: 'self-forgiveness and acceptance' },
      { name: 'meaning', confidence: 0.82, context: 'finding purpose in loss' }
    ]
  }
];

async function uploadSampleConversations() {
  try {
    console.log('🚀 Starting sample conversation upload...');

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

    // Get the first complex for association
    const { data: complexes, error: complexError } = await supabase
      .from('complexes')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (complexError) {
      console.error('❌ Error fetching complexes:', complexError);
      return;
    }

    const complexId = complexes && complexes.length > 0 ? complexes[0].id : null;
    console.log('🏢 Using complex ID:', complexId || 'null (uncategorized)');

    // Upload conversations
    console.log('💾 Uploading conversations...');
    for (const conversation of sampleConversations) {
      const conversationData = {
        ...conversation,
        user_id: userId,
        complex_id: complexId,
        updated_at: conversation.created_at
      };

      const { error: convError } = await supabase
        .from('conversations')
        .upsert(conversationData, { onConflict: 'id' });

      if (convError) {
        console.error(`❌ Error uploading conversation ${conversation.title}:`, convError);
      } else {
        console.log(`✅ Uploaded conversation: ${conversation.title}`);
      }
    }

    // Upload detected data
    console.log('🧠 Uploading detected data...');
    for (const detectedItem of sampleDetectedData) {
      const { conversation_id, emotions, parts, needs } = detectedItem;

      // Upload emotions
      if (emotions.length > 0) {
        const { error: emotionError } = await supabase
          .from('detected_emotions')
          .insert({
            conversation_id,
            user_id: userId,
            emotions,
            created_at: new Date().toISOString()
          });

        if (emotionError && emotionError.code !== '23505') { // Ignore duplicate key errors
          console.error(`❌ Error uploading emotions for ${conversation_id}:`, emotionError);
        }
      }

      // Upload parts
      if (parts.length > 0) {
        const { error: partError } = await supabase
          .from('detected_parts')
          .insert({
            conversation_id,
            user_id: userId,
            parts,
            created_at: new Date().toISOString()
          });

        if (partError && partError.code !== '23505') { // Ignore duplicate key errors
          console.error(`❌ Error uploading parts for ${conversation_id}:`, partError);
        }
      }

      // Upload needs
      if (needs.length > 0) {
        const { error: needError } = await supabase
          .from('detected_needs')
          .insert({
            conversation_id,
            user_id: userId,
            needs,
            created_at: new Date().toISOString()
          });

        if (needError && needError.code !== '23505') { // Ignore duplicate key errors
          console.error(`❌ Error uploading needs for ${conversation_id}:`, needError);
        }
      }

      console.log(`✅ Uploaded detected data for conversation: ${conversation_id}`);
    }

    console.log('🎉 Sample conversation upload completed successfully!');
    console.log('📝 Created 5 conversations with detected emotions, parts, and needs');
    console.log('🔗 Conversations are linked to your first complex (if available)');
    console.log('✨ You can now test the conversation history functionality!');

  } catch (error) {
    console.error('❌ Upload failed:', error);
  }
}

// Run the upload
uploadSampleConversations();