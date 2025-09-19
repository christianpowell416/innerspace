import { supabase } from '../supabase';
import { Database } from '../database.types';
import { FlowchartStructure } from '../types/flowchart';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';

export type FlowchartRow = Database['public']['Tables']['flowcharts']['Row'];
export type FlowchartInsert = Database['public']['Tables']['flowcharts']['Insert'];
export type FlowchartUpdate = Database['public']['Tables']['flowcharts']['Update'];

// Get user's default flowchart with ID
export const getUserFlowchartWithId = async (): Promise<{ structure: FlowchartStructure; id: string | null }> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    // For non-authenticated users, generate AI flowchart instead of hardcoded default
    console.log('🤖 No user authenticated, generating AI flowchart...');
    try {
      const structure = await generateFlowchartFromRequirements();
      return { structure, id: null };
    } catch (error) {
      console.log('❌ AI generation failed, using minimal fallback');
      // Return minimal structure instead of the 8-node default
      const structure = {
        nodes: [
          { id: 'self', x: 200, y: 200, type: 'self', description: 'Your centered, authentic self', transcripts: [] }
        ],
        edges: [],
        metadata: {
          version: '1.0',
          lastModified: new Date().toISOString(),
          notes: 'Minimal flowchart - AI generation failed'
        }
      };
      return { structure, id: null };
    }
  }

  // Try to get user's default flowchart from Supabase
  const { data, error } = await supabase
    .from('flowcharts')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_default', true)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error fetching user flowchart:', error);
    throw error;
  }

  if (data) {
    return { structure: data.structure, id: data.id };
  }

  // No default flowchart exists, generate one with AI instead of hardcoded default
  console.log('🤖 No saved flowchart found, generating AI flowchart for user...');
  try {
    const aiStructure = await generateFlowchartFromRequirements();
    const newFlowchart = await createFlowchart('My Flowchart', aiStructure, true);
    return { structure: aiStructure, id: newFlowchart.id };
  } catch (error) {
    console.log('❌ AI generation failed, using minimal fallback');
    // Use minimal structure instead of the 8-node default
    const minimalStructure = {
      nodes: [
        { id: 'self', label: 'Self', x: 200, y: 200, type: 'self', description: 'Your centered, authentic self' }
      ],
      edges: [],
      metadata: {
        version: '1.0',
        lastModified: new Date().toISOString(),
        notes: 'Minimal flowchart - AI generation failed'
      }
    };
    const newFlowchart = await createFlowchart('My Flowchart', minimalStructure, true);
    return { structure: minimalStructure, id: newFlowchart.id };
  }
};

// Get user's default flowchart
export const getUserFlowchart = async (): Promise<FlowchartStructure> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    // For non-authenticated users, generate AI flowchart instead of hardcoded default
    console.log('🤖 No user authenticated, generating AI flowchart...');
    try {
      return await generateFlowchartFromRequirements();
    } catch (error) {
      console.log('❌ AI generation failed, using minimal fallback');
      // Return minimal structure instead of the 8-node default
      return {
        nodes: [
          { id: 'self', x: 200, y: 200, type: 'self', description: 'Your centered, authentic self', transcripts: [] }
        ],
        edges: [],
        metadata: {
          version: '1.0',
          lastModified: new Date().toISOString(),
          notes: 'Minimal flowchart - AI generation failed'
        }
      };
    }
  }

  // Try to get user's default flowchart from Supabase
  const { data, error } = await supabase
    .from('flowcharts')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_default', true)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error fetching user flowchart:', error);
    throw error;
  }

  if (data) {
    return data.structure;
  }

  // No default flowchart exists, generate one with AI instead of hardcoded default
  console.log('🤖 No saved flowchart found, generating AI flowchart for user...');
  try {
    const aiStructure = await generateFlowchartFromRequirements();
    await createFlowchart('My Flowchart', aiStructure, true);
    return aiStructure;
  } catch (error) {
    console.log('❌ AI generation failed, using minimal fallback');
    // Use minimal structure instead of the 8-node default
    const minimalStructure = {
      nodes: [
        { id: 'self', label: 'Self', x: 200, y: 200, type: 'self', description: 'Your centered, authentic self' }
      ],
      edges: [],
      metadata: {
        version: '1.0',
        lastModified: new Date().toISOString(),
        notes: 'Minimal flowchart - AI generation failed'
      }
    };
    await createFlowchart('My Flowchart', minimalStructure, true);
    return minimalStructure;
  }
};

// Create a new flowchart
export const createFlowchart = async (
  name: string, 
  structure: FlowchartStructure, 
  isDefault: boolean = false
): Promise<FlowchartRow> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to create flowchart');
  }

  // If setting as default, unset any existing default
  if (isDefault) {
    await supabase
      .from('flowcharts')
      .update({ is_default: false })
      .eq('user_id', user.id)
      .eq('is_default', true);
  }

  const { data, error } = await supabase
    .from('flowcharts')
    .insert({
      user_id: user.id,
      name,
      structure,
      is_default: isDefault,
      last_updated: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating flowchart:', error);
    throw error;
  }

  return data;
};

// Update an existing flowchart
export const updateFlowchart = async (
  id: string, 
  updates: Partial<FlowchartUpdate>
): Promise<FlowchartRow> => {
  console.log('🔧 updateFlowchart called with:', { id, updates: Object.keys(updates) });
  
  const { data, error } = await supabase
    .from('flowcharts')
    .update({
      ...updates,
      last_updated: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('❌ Error updating flowchart in Supabase:', error);
    throw error;
  }

  console.log('✅ Supabase update successful:', { id: data.id, last_updated: data.last_updated });
  return data;
};

// Update flowchart structure and append change description to markdown
export const updateFlowchartWithDescription = async (
  id: string,
  newStructure: FlowchartStructure,
  changeDescription: string
): Promise<FlowchartRow> => {
  console.log('🔧 updateFlowchartWithDescription called with:', {
    id,
    nodeCount: newStructure.nodes.length,
    edgeCount: newStructure.edges.length,
    changeDescription
  });

  try {
    // Update the flowchart in Supabase
    console.log('🔧 Calling updateFlowchart...');
    const updatedFlowchart = await updateFlowchart(id, { 
      structure: newStructure 
    });
    console.log('✅ updateFlowchart successful:', updatedFlowchart.id);

    // Append change description to markdown file
    console.log('🔧 Calling appendToFlowchartRequirements...');
    await appendToFlowchartRequirements(changeDescription);
    console.log('✅ appendToFlowchartRequirements successful');

    return updatedFlowchart;
  } catch (error) {
    console.error('❌ Error in updateFlowchartWithDescription:', error);
    throw error;
  }
};

// Get all flowcharts for the current user
export const getUserFlowcharts = async (): Promise<FlowchartRow[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('flowcharts')
    .select('*')
    .eq('user_id', user.id)
    .order('last_updated', { ascending: false });

  if (error) {
    console.error('Error fetching user flowcharts:', error);
    throw error;
  }

  return data || [];
};

// Delete a flowchart
export const deleteFlowchart = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('flowcharts')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting flowchart:', error);
    throw error;
  }
};

// Append change description to flowchart requirements markdown
export const appendToFlowchartRequirements = async (changeDescription: string): Promise<void> => {
  try {
    // For now, just log the change instead of writing to file
    // File system writes in React Native require careful permission handling
    console.log('📝 Flowchart change logged:', changeDescription);
    console.log('📅 Timestamp:', new Date().toISOString());
  } catch (error) {
    console.error('❌ Error logging change:', error);
    // Don't throw - this is a nice-to-have feature
  }
};

import { generateFlowchartWithAI, AIGenerationRequest } from './aiFlowchartGenerator';

// Generate flowchart from markdown requirements using AI
export const generateFlowchartFromRequirements = async (
  existingStructure?: FlowchartStructure,
  context?: AIGenerationRequest['context']
): Promise<FlowchartStructure> => {
  const aiResponse = await generateFlowchartWithAI({
    requirements: '', // Will be read by the AI generator
    existingStructure,
    context
  });
  
  return aiResponse.flowchart;
};

// Subscribe to flowchart changes (real-time)
export const subscribeToFlowchartChanges = (
  callback: (flowcharts: FlowchartRow[]) => void
) => {
  const channel = supabase
    .channel('flowchart-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'flowcharts'
      },
      async () => {
        // Refetch all flowcharts when any change occurs
        try {
          const flowcharts = await getUserFlowcharts();
          callback(flowcharts);
        } catch (error) {
          console.error('Error refetching flowcharts:', error);
        }
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    }
  };
};

/**
 * Export flowchart structure as JSON template file
 */
export const exportFlowchartAsTemplate = async (
  flowchart: FlowchartStructure,
  flowchartName: string = 'flowchart-template'
): Promise<void> => {
  try {
    console.log('📄 Exporting flowchart as template:', flowchartName);
    
    // Create a clean template structure
    const template = {
      templateName: flowchartName,
      createdAt: new Date().toISOString(),
      description: 'Flowchart template exported from Empart app',
      structure: {
        nodes: flowchart.nodes.map(node => ({
          id: node.id,
          label: node.label,
          type: node.type,
          description: node.description || '',
          x: node.x,
          y: node.y
        })),
        edges: flowchart.edges.map(edge => ({
          from: edge.from,
          to: edge.to,
          type: edge.type,
          label: edge.label || ''
        })),
        metadata: {
          version: '1.0',
          lastModified: new Date().toISOString(),
          notes: flowchart.metadata?.notes || 'Exported template for AI generation'
        }
      },
      usage: {
        instructions: 'Use this template structure as a reference when generating new flowcharts',
        nodeTypes: [...new Set(flowchart.nodes.map(n => n.type))],
        edgeTypes: [...new Set(flowchart.edges.map(e => e.type))]
      }
    };
    
    // Convert to formatted JSON
    const jsonContent = JSON.stringify(template, null, 2);
    
    // Create filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `${flowchartName}-template-${timestamp}.json`;
    
    // Write to temporary file
    const fileUri = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, jsonContent);
    
    console.log('✅ Template file created:', fileUri);
    
    // Check if sharing is available and share the file
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Flowchart Template',
        UTI: 'public.json'
      });
      console.log('✅ Template shared successfully');
    } else {
      Alert.alert(
        'Export Complete',
        `Template saved to: ${filename}\n\nYou can find it in your app's documents folder.`,
        [{ text: 'OK' }]
      );
    }
    
  } catch (error) {
    console.error('❌ Error exporting flowchart template:', error);
    Alert.alert('Export Error', 'Failed to export flowchart template. Please try again.');
    throw error;
  }
};