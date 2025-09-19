import { FlowchartStructure } from '../types/flowchart';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { promptContent } from '../../assets/flowchart/prompt_instructions.js';
import { requirementsContent } from '../../assets/flowchart/requirements.js';
// Note: OpenAI SDK requires polyfills for React Native
// We'll use fetch API directly instead

/**
 * AI Flowchart Generator Service
 * 
 * This service integrates with ChatGPT to generate flowcharts
 * based on markdown requirements and IFS/Jungian psychology principles.
 */


// OpenAI API configuration
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export interface AIGenerationRequest {
  requirements: string;
  existingStructure?: FlowchartStructure;
  context?: {
    framework: 'IFS' | 'Jungian' | 'Mixed';
    focusArea?: string;
    userGoals?: string[];
  };
}

export interface AIGenerationResponse {
  flowchart: FlowchartStructure;
  explanation: string;
  suggestions: string[];
}

/**
 * Read flowchart prompt from bundled JavaScript file
 */
export const readFlowchartPrompt = async (): Promise<{ systemPrompt: string; userInstructions: string; jsonFormat: string; finalInstructions: string }> => {
  try {
    let contentToUse = promptContent;
    
    // First try to read from document directory (updated prompt)
    const documentPath = `${FileSystem.documentDirectory}prompt_instructions.js`;
    try {
      const documentContent = await FileSystem.readAsStringAsync(documentPath);
      if (documentContent.trim()) {
        console.log('📝 Reading flowchart prompt from document directory...');
        // Extract content from the JavaScript export
        const match = documentContent.match(/export const promptContent = `(.+?)`;/s);
        if (match) {
          contentToUse = match[1].replace(/\\`/g, '`');
        }
      }
    } catch (documentError) {
      console.log('📝 No prompt found in document directory, using bundled version...');
    }
    
    console.log('📝 Using prompt content...');
    
    // Validate content before parsing
    if (!contentToUse || typeof contentToUse !== 'string') {
      console.error('❌ Prompt content is invalid:', typeof contentToUse, contentToUse);
      throw new Error('Prompt content is undefined or not a string');
    }
    
    console.log('📝 Content preview:', contentToUse.substring(0, 100) + '...');
    
    // Parse the markdown content to extract sections
    const lines = contentToUse.split('\n');
    let currentSection = '';
    let systemPrompt = '';
    let userInstructions = '';
    let jsonFormat = '';
    let finalInstructions = '';
    let inCodeBlock = false;
    
    for (const line of lines) {
      if (line.startsWith('## System Prompt')) {
        currentSection = 'system';
        continue;
      } else if (line.startsWith('## User Instructions')) {
        currentSection = 'user';
        continue;
      } else if (line.startsWith('## JSON Format Template')) {
        currentSection = 'json';
        continue;
      } else if (line.startsWith('## Final Instructions')) {
        currentSection = 'final';
        continue;
      } else if (line.startsWith('#') || line.trim() === '') {
        continue;
      }
      
      // Handle code blocks for JSON
      if (line.trim() === '```json' || line.trim() === '```') {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      
      // Add content to appropriate section
      const content = line + '\n';
      switch (currentSection) {
        case 'system':
          systemPrompt += content;
          break;
        case 'user':
          userInstructions += content;
          break;
        case 'json':
          if (inCodeBlock) {
            jsonFormat += content;
          }
          break;
        case 'final':
          finalInstructions += content;
          break;
      }
    }
    
    const result = {
      systemPrompt: (systemPrompt || '').trim(),
      userInstructions: (userInstructions || '').trim(),
      jsonFormat: (jsonFormat || '').trim(),
      finalInstructions: (finalInstructions || '').trim()
    };
    
    console.log('📝 Parsed sections:', {
      systemPrompt: result.systemPrompt.length,
      userInstructions: result.userInstructions.length,
      jsonFormat: result.jsonFormat.length,
      finalInstructions: result.finalInstructions.length
    });
    
    return result;
  } catch (error) {
    throw new Error(`Failed to read flowchart prompt: ${error.message}`);
  }
};

/**
 * Read flowchart requirements from bundled JavaScript file
 */
export const readFlowchartRequirements = async (): Promise<string> => {
  try {
    // First try to read from document directory (updated requirements)
    const documentPath = `${FileSystem.documentDirectory}requirements.js`;
    try {
      const documentContent = await FileSystem.readAsStringAsync(documentPath);
      if (documentContent.trim()) {
        console.log('📄 Reading flowchart requirements from document directory...');
        // Extract content from the JavaScript export
        const match = documentContent.match(/export const requirementsContent = `(.+?)`;/s);
        if (match) {
          const content = match[1].replace(/\\`/g, '`');
          console.log('📝 Content preview:', content.substring(0, 100) + '...');
          return content;
        }
      }
    } catch (documentError) {
      console.log('📄 No requirements found in document directory, using bundled version...');
    }

    console.log('📄 Reading flowchart requirements from bundled file...');
    console.log('📝 Content preview:', requirementsContent.substring(0, 100) + '...');
    
    return requirementsContent;
  } catch (error) {
    throw new Error(`Failed to read flowchart requirements: ${error.message}`);
  }
};

/**
 * Update flowchart requirements by modifying the JavaScript file
 */
export const updateFlowchartRequirements = async (newContent: string): Promise<void> => {
  try {
    // Update the requirements.js file with new content
    const jsContent = `// This file exports the flowchart requirements content
// It's automatically generated from flowchart_requirements.md
// DO NOT EDIT THIS FILE DIRECTLY - edit flowchart_requirements.md instead

export const requirementsContent = \`${newContent.replace(/`/g, '\\`')}\`;

export default requirementsContent;
`;
    
    const filePath = `${FileSystem.documentDirectory}requirements.js`;
    await FileSystem.writeAsStringAsync(filePath, jsContent);
    console.log('✅ Updated flowchart requirements at:', filePath);
  } catch (error) {
    throw new Error(`Failed to update flowchart requirements: ${error.message}`);
  }
};

/**
 * Update flowchart prompt by modifying the JavaScript file
 */
export const updateFlowchartPrompt = async (newContent: string): Promise<void> => {
  try {
    // Update the prompt_instructions.js file with new content
    const jsContent = `// This file exports the flowchart prompt content
// Updated: ${new Date().toISOString().split('T')[0]} - Modified via in-app editor
// You can edit this file directly

export const promptContent = \`${newContent.replace(/`/g, '\\`')}\`;

export default promptContent;
`;
    
    const filePath = `${FileSystem.documentDirectory}prompt_instructions.js`;
    await FileSystem.writeAsStringAsync(filePath, jsContent);
    console.log('✅ Updated flowchart prompt at:', filePath);
  } catch (error) {
    throw new Error(`Failed to update flowchart prompt: ${error.message}`);
  }
};

/**
 * Generate flowchart using ChatGPT API
 */
export const generateFlowchartWithAI = async (
  request: AIGenerationRequest
): Promise<AIGenerationResponse> => {
  
  try {
    console.log('🤖 Generating flowchart with ChatGPT...');
    
    // Validate API key before proceeding
    if (!OPENAI_API_KEY || !OPENAI_API_KEY.startsWith('sk-')) {
      throw new Error('OpenAI API key is not configured or invalid. Please add EXPO_PUBLIC_OPENAI_API_KEY to your .env.local file.');
    }
    
    // Debug API key (show only first and last 4 characters for security)
    const apiKeyDebug = `${OPENAI_API_KEY.substring(0, 7)}...${OPENAI_API_KEY.substring(OPENAI_API_KEY.length - 4)}`;
    console.log('🔑 API Key status:', apiKeyDebug);
    
    // Read requirements document and prompt template
    const requirements = await readFlowchartRequirements();
    const promptData = await readFlowchartPrompt();
    
    // No automatic image loading - images should only be included if explicitly configured
    let imageBase64 = '';
    let hasImage = false;
    
    // Validate prompt data
    if (!promptData || typeof promptData !== 'object') {
      throw new Error('Invalid prompt data received');
    }
    
    console.log('🔍 Prompt data validation:', {
      systemPrompt: typeof promptData.systemPrompt,
      userInstructions: typeof promptData.userInstructions,
      jsonFormat: typeof promptData.jsonFormat,
      finalInstructions: typeof promptData.finalInstructions
    });
    
    // Validate that all required sections are present in prompt file
    if (!promptData.systemPrompt) {
      throw new Error('Missing "## System Prompt" section in prompt_instructions.js');
    }
    if (!promptData.userInstructions) {
      throw new Error('Missing "## User Instructions" section in prompt_instructions.js');
    }
    if (!promptData.jsonFormat) {
      throw new Error('Missing "## JSON Format Template" section in prompt_instructions.js');
    }
    if (!promptData.finalInstructions) {
      throw new Error('Missing "## Final Instructions" section in prompt_instructions.js');
    }

    // Use system prompt from file (no fallbacks - file must contain valid prompt)
    const systemPrompt = promptData.systemPrompt;
    
    // Combine user instructions with requirements (no hardcoded text)
    const userPrompt = `${promptData.userInstructions}

## Requirements
${requirements}

${promptData.jsonFormat}

${promptData.finalInstructions}`;

    // Log what we're actually sending to OpenAI
    console.log('📤 PROMPT BEING SENT TO OPENAI:');
    console.log('System:', systemPrompt);
    console.log('User:', userPrompt);
    if (hasImage) {
      console.log('Image base64 length:', imageBase64.length);
    }

    // Prepare messages based on whether we have an image
    const messages = hasImage 
      ? [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: imageBase64 } }
            ]
          }
        ]
      : [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ];

    // Call ChatGPT API using fetch
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: hasImage ? "gpt-4o" : "gpt-4o-mini",
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🚨 OpenAI API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        url: OPENAI_API_URL,
        headers: response.headers,
        body: errorText
      });
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('🔍 OpenAI API Response Data:', JSON.stringify(data, null, 2));
    
    // Parse the response
    const aiResponse = data.choices?.[0]?.message?.content;
    if (!aiResponse) {
      console.error('❌ No content in OpenAI response. Full response:', data);
      throw new Error('No response from ChatGPT');
    }

    // Log the OpenAI response
    console.log('🤖 OpenAI Response:', aiResponse);


    // Try to parse JSON response, handle potential formatting issues
    let parsedResponse;
    try {
      // Clean up markdown formatting from AI response
      let cleanedResponse = aiResponse.trim();
      
      // Remove markdown code blocks - handle multiple patterns
      cleanedResponse = cleanedResponse.replace(/^```json\s*/gm, '').replace(/^```\s*/gm, '').replace(/```\s*$/gm, '');
      
      // Find JSON object boundaries more reliably
      const jsonStart = cleanedResponse.indexOf('{');
      const jsonEnd = cleanedResponse.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd + 1);
      } else {
        throw new Error('No valid JSON object found in AI response');
      }
      
      parsedResponse = JSON.parse(cleanedResponse);
    } catch (parseError) {
      throw new Error('AI returned invalid JSON format');
    }
    
    // Validate the structure
    if (!parsedResponse.nodes || !parsedResponse.edges) {
      throw new Error('Invalid flowchart structure from AI');
    }

    // Log the generated coordinates for debugging
    console.log('📊 Generated node coordinates:');
    parsedResponse.nodes.forEach((node: any) => {
      console.log(`  ${node.id}: (${node.x}, ${node.y}) - ${node.label}`);
    });


    // Check if coordinates need scaling to fit viewport
    const allX = parsedResponse.nodes.map((n: any) => n.x);
    const allY = parsedResponse.nodes.map((n: any) => n.y);
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);
    
    console.log(`📐 Coordinate bounds: X(${minX} to ${maxX}), Y(${minY} to ${maxY})`);
    
    // Scale coordinates to fit within the FlowchartViewer's viewport
    // Most mobile screens are around 390-430px wide, so we'll target a safe area
    const screenWidth = 350; // Target a smaller area to ensure it fits on all screens
    const screenHeight = 350; // Keep it square for consistent layout
    const nodeRadius = 50; // Approximate max node radius to ensure full visibility
    const margin = nodeRadius + 30; // Larger margin from screen edges
    const targetWidth = screenWidth - (margin * 2); // Safe visible area (~220px)
    const targetHeight = screenHeight - (margin * 2);
    const currentWidth = maxX - minX;
    const currentHeight = maxY - minY;
    
    if (currentWidth > 0 && currentHeight > 0) {
      const scaleX = targetWidth / currentWidth;
      const scaleY = targetHeight / currentHeight;
      let scale = Math.min(scaleX, scaleY); // Use smaller scale to fit both dimensions
      
      // Don't scale down if nodes are already well-spaced (prevent over-compression)
      // Only scale if the content is larger than our target area or much smaller
      if (scale > 0.8 && scale < 1.2) {
        scale = 1; // Don't scale if the size is already reasonable
        console.log('🔧 Skipping scaling - content size is already appropriate');
      }
      
      console.log(`🔧 Applying scale factor: ${scale} (target: ${targetWidth}x${targetHeight})`);
      
      // Apply scaling and translation to center content in safe visible area
      parsedResponse.nodes.forEach((node: any) => {
        const scaledX = (node.x - minX) * scale + margin;
        const scaledY = (node.y - minY) * scale + margin;
        console.log(`  ${node.id}: (${node.x}, ${node.y}) -> (${scaledX}, ${scaledY})`);
        node.x = scaledX;
        node.y = scaledY;
      });
      
      console.log(`📐 Final scaled bounds: X(${margin} to ${targetWidth + margin}), Y(${margin} to ${targetHeight + margin})`);

    }

    return {
      flowchart: parsedResponse as FlowchartStructure,
      explanation: '',
      suggestions: []
    };
    
  } catch (error) {
    throw error;
  }
};



/**
 * Export flowchart to markdown format
 */
export const exportFlowchartToMarkdown = (flowchart: FlowchartStructure): string => {
  const timestamp = new Date().toISOString();
  
  let markdown = `# Flowchart Export - ${timestamp}\n\n`;
  
  markdown += `## Nodes (${flowchart.nodes.length})\n\n`;
  flowchart.nodes.forEach(node => {
    markdown += `- **${node.label}** (${node.type}) at (${node.x}, ${node.y})\n`;
    if (node.description) {
      markdown += `  - ${node.description}\n`;
    }
  });
  
  markdown += `\n## Relationships (${flowchart.edges.length})\n\n`;
  flowchart.edges.forEach(edge => {
    const fromNode = flowchart.nodes.find(n => n.id === edge.from);
    const toNode = flowchart.nodes.find(n => n.id === edge.to);
    markdown += `- ${fromNode?.label || edge.from} ${edge.type} ${toNode?.label || edge.to}\n`;
  });
  
  if (flowchart.metadata?.notes) {
    markdown += `\n## Notes\n\n${flowchart.metadata.notes}\n`;
  }
  
  return markdown;
};