import { supabase } from './supabase';
import { sampleEmotions } from '../data/sampleEmotions';

export async function seedEmotions() {
  try {
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('User must be authenticated to seed emotions');
      return { error: 'User not authenticated' };
    }

    console.log('Seeding emotions for user:', user.email);

    // Transform sample emotions to match database schema
    const emotionsToInsert = sampleEmotions.map(emotion => ({
      user_id: user.id,
      label: emotion.label,
      notes: emotion.notes,
      'feminine-masculine': emotion['feminine-masculine'],
      'dark-light': emotion['dark-light'],
      'child-parent': emotion['child-parent'],
      frequency: emotion.frequency,
      ai_conversation_summary: emotion.aiConversationSummary,
      created_at: emotion.timestamp.toISOString(),
    }));

    // Insert emotions in batches to avoid rate limits
    const batchSize = 5;
    const results = [];
    
    for (let i = 0; i < emotionsToInsert.length; i += batchSize) {
      const batch = emotionsToInsert.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('emotions')
        .insert(batch)
        .select();
      
      if (error) {
        console.error('Error inserting batch:', error);
        results.push({ batch: i / batchSize + 1, error });
      } else {
        console.log(`Inserted batch ${i / batchSize + 1}: ${data.length} emotions`);
        results.push({ batch: i / batchSize + 1, data });
      }
    }

    const totalInserted = results
      .filter(r => r.data)
      .reduce((sum, r) => sum + r.data.length, 0);

    console.log(`Successfully seeded ${totalInserted} emotions`);
    
    return {
      success: true,
      totalInserted,
      results
    };
  } catch (error) {
    console.error('Error seeding emotions:', error);
    return { error };
  }
}

// Function to clear all emotions for the current user
export async function clearUserEmotions() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { error: 'User not authenticated' };
    }

    const { error } = await supabase
      .from('emotions')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Error clearing emotions:', error);
      return { error };
    }

    console.log('Successfully cleared all emotions for user');
    return { success: true };
  } catch (error) {
    console.error('Error clearing emotions:', error);
    return { error };
  }
}