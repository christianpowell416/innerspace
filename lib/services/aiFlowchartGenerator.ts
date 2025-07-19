import { FlowchartStructure } from '../types/flowchart';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
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
 * Read flowchart requirements from markdown file
 */
export const readFlowchartRequirements = async (): Promise<string> => {
  try {
    const documentPath = `${FileSystem.documentDirectory}flowchart_requirements.md`;
    
    try {
      const content = await FileSystem.readAsStringAsync(documentPath);
      console.log('📄 Reading from document directory:', documentPath);
      console.log('📝 Content preview:', content.substring(0, 100) + '...');
      
      // Delete the old document file to force using bundled version
      await FileSystem.deleteAsync(documentPath);
      console.log('🗑️ Deleted old document directory file, will use bundled version next time');
      
      return content;
    } catch (pathError) {
      // Fallback to bundled requirements
      console.log('📄 Reading from bundled requirements.js');
      const { requirementsContent } = await import('../../assets/flowchart/requirements.js');
      console.log('📝 Content preview:', requirementsContent.substring(0, 100) + '...');
      return requirementsContent;
    }
    
  } catch (error) {
    throw new Error(`Failed to read flowchart requirements: ${error.message}`);
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
    
    // Read requirements document
    const requirements = await readFlowchartRequirements();
    
    // Read and encode the image file using Asset API
    let imageBase64 = '';
    let hasImage = false;
    try {
      // Load the asset and download it
      const asset = Asset.fromModule(require('../../assets/flowchart/theory_flowchart_1.jpg'));
      await asset.downloadAsync();
      
      // Read the downloaded file as base64
      const imageData = await FileSystem.readAsStringAsync(asset.localUri!, { encoding: FileSystem.EncodingType.Base64 });
      imageBase64 = `data:image/jpeg;base64,${imageData}`;
      hasImage = true;
      console.log('✅ Successfully loaded and encoded image');
    } catch (imageError) {
      console.log('⚠️ Could not load image, proceeding without it:', imageError);
      hasImage = false;
    }
    
    // Send requirements directly to OpenAI with directive system prompt
    const systemPrompt = `You are a helpful assistant that generates flowchart data structures in JSON format.`;
    const userPrompt = hasImage 
      ? `Analyze the provided flowchart diagram image and recreate it as a JSON data structure with the following format:

{
  "nodes": [
    {
      "id": "unique_id",
      "label": "Node Label", 
      "x": 200,
      "y": 150,
      "type": "self",
      "description": "Optional description"
    }
  ],
  "edges": [
    {
      "from": "node1_id",
      "to": "node2_id", 
      "type": "protection",
      "label": "optional label"
    }
  ]
}


Please examine the image carefully and recreate the exact structure, positions, and connections shown.

Requirements: ${requirements}`
      : `Generate a JSON flowchart structure with the following format:

{
  "nodes": [
    {
      "id": "unique_id",
      "label": "Node Label", 
      "x": 200,
      "y": 150,
      "type": "self",
      "description": "Optional description"
    }
  ],
  "edges": [
    {
      "from": "node1_id",
      "to": "node2_id", 
      "type": "protection",
      "label": "optional label"
    }
  ]
}

Requirements: ${requirements}

Create a simple flowchart with 3-5 nodes that represents a basic emotional system.`;

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
        model: hasImage ? "gpt-4o" : "gpt-3.5-turbo",
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

    // Check if coordinates need scaling to fit 400x400 viewbox
    const allX = parsedResponse.nodes.map((n: any) => n.x);
    const allY = parsedResponse.nodes.map((n: any) => n.y);
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);
    
    console.log(`📐 Coordinate bounds: X(${minX} to ${maxX}), Y(${minY} to ${maxY})`);
    
    // Scale and translate coordinates to fit within 50-350 range (with 50px margin)
    const targetWidth = 300; // 400 - 100 for margins
    const targetHeight = 300;
    const currentWidth = maxX - minX;
    const currentHeight = maxY - minY;
    
    if (currentWidth > 0 && currentHeight > 0) {
      const scaleX = targetWidth / currentWidth;
      const scaleY = targetHeight / currentHeight;
      const scale = Math.min(scaleX, scaleY); // Use smaller scale to fit both dimensions
      
      console.log(`🔧 Applying scale factor: ${scale}`);
      
      // Apply scaling and translation
      parsedResponse.nodes.forEach((node: any) => {
        const scaledX = (node.x - minX) * scale + 50; // Add 50px margin
        const scaledY = (node.y - minY) * scale + 50;
        console.log(`  ${node.id}: (${node.x}, ${node.y}) -> (${scaledX}, ${scaledY})`);
        node.x = scaledX;
        node.y = scaledY;
      });

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