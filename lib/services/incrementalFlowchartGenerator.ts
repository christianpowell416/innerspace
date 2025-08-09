import { FlowchartStructure } from '@/lib/types/flowchart';
import { loadFlowchartTemplate } from './voiceFlowchartGenerator';
import { incrementalAnalysisInstructions } from '../../assets/flowchart/incremental_analysis_instructions.js';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface IncrementalFlowchartCallbacks {
  onFlowchartUpdate?: (flowchart: FlowchartStructure, isPartial: boolean) => void;
  onAnalysisUpdate?: (analysis: string) => void;
  onError?: (error: Error) => void;
}

class IncrementalFlowchartGenerator {
  private apiKey: string;
  private conversationHistory: ConversationMessage[] = [];
  private currentFlowchart: FlowchartStructure | null = null;
  private lastAnalysisTime = 0;
  private analysisDebounceMs = 3000; // Wait 3 seconds after last message before analyzing
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isAnalyzing = false;

  /**
   * Load template1.json to get exact validation requirements
   */
  private loadTemplate(): any {
    try {
      const template = require('../../assets/flowchart/templates/template1.json');
      return template;
    } catch (error) {
      console.error('❌ Error loading template1.json:', error);
      return null;
    }
  }

  /**
   * Generate analysis instructions from the centralized prompt file
   */
  private generateAnalysisInstructions(): string {
    try {
      // Extract the core analysis instructions
      const lines = incrementalAnalysisInstructions.split('\n');
      let systemPrompt = '';
      let analysisProcess = '';
      let currentSection = '';
      
      for (const line of lines) {
        if (line.startsWith('## System Prompt')) {
          currentSection = 'system';
          continue;
        } else if (line.startsWith('## Analysis Process')) {
          currentSection = 'process';
          continue;
        } else if (line.startsWith('##') && currentSection) {
          currentSection = '';
          continue;
        }
        
        if (currentSection === 'system') {
          systemPrompt += line + '\n';
        } else if (currentSection === 'process') {
          analysisProcess += line + '\n';
        }
      }
      
      const finalInstructions = `${systemPrompt.trim()}\n\n${analysisProcess.trim()}`;
      console.log('📊 FLOWCHART AGENT: Generated system instructions:', finalInstructions.substring(0, 300) + '...');
      return finalInstructions;
    } catch (error) {
      console.error('❌ Error generating analysis instructions:', error);
      return 'You are a specialized AI analyst for therapeutic conversations. Analyze the conversation and create flowchart structures.';
    }
  }

  constructor() {
    this.apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('📊 FLOWCHART AGENT: OpenAI API key not configured - flowchart generation disabled');
    } else {
      console.log('📊 FLOWCHART AGENT: Initialized successfully with API key');
    }
  }

  /**
   * Add a new message to the conversation and trigger incremental analysis
   * This operates completely independently from the voice conversation system
   */
  async addMessage(message: ConversationMessage, callbacks?: IncrementalFlowchartCallbacks): Promise<void> {
    try {
      this.conversationHistory.push(message);
      console.log('📊 FLOWCHART AGENT: Added message from', message.role, '- Total messages:', this.conversationHistory.length);
      
      // Clear existing debounce timer
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        console.log('📊 FLOWCHART AGENT: Cleared previous analysis timer');
      }
      
      // Debounce the analysis to avoid excessive API calls
      console.log('📊 FLOWCHART AGENT: Setting analysis timer for', this.analysisDebounceMs, 'ms');
      this.debounceTimer = setTimeout(async () => {
        try {
          await this.analyzeAndUpdateFlowchart(callbacks);
        } catch (error) {
          console.log('📊 FLOWCHART AGENT: Analysis error -', error);
          callbacks?.onError?.(error as Error);
        }
      }, this.analysisDebounceMs);
    } catch (error) {
      console.log('📊 FLOWCHART AGENT: Error adding message -', error);
      callbacks?.onError?.(error as Error);
    }
  }

  /**
   * Analyze the current conversation and update the flowchart
   * This is a completely SILENT background process - no voice output
   */
  private async analyzeAndUpdateFlowchart(callbacks?: IncrementalFlowchartCallbacks): Promise<void> {
    if (this.isAnalyzing) {
      console.log('📊 FLOWCHART AGENT: Already analyzing, skipping');
      return;
    }
    
    if (!this.apiKey) {
      console.log('📊 FLOWCHART AGENT: No API key configured, skipping analysis');
      return;
    }
    
    // Don't analyze if we don't have enough conversation content
    if (this.conversationHistory.length === 0) {
      console.log('📊 FLOWCHART AGENT: No conversation history, skipping analysis');
      return;
    }
    
    this.isAnalyzing = true;
    console.log('📊 FLOWCHART AGENT: Starting analysis with', this.conversationHistory.length, 'messages');
    callbacks?.onAnalysisUpdate?.('Analyzing conversation...');
    
    try {
      // Generate analysis instructions
      const instructions = this.generateAnalysisInstructions();
      
      // Create conversation summary for analysis
      const conversationSummary = this.conversationHistory
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');
      
      console.log('📊 FLOWCHART AGENT: Conversation summary:', conversationSummary);

      // Check if we have enough meaningful content to analyze
      const totalContent = conversationSummary.length;
      console.log('📊 FLOWCHART AGENT: Conversation content length:', totalContent, 'chars');
      
      // Basic length check
      if (totalContent < 100) {
        console.log('📊 FLOWCHART AGENT: Not enough content for analysis (< 100 chars)');
        callbacks?.onAnalysisUpdate?.('Waiting for more conversation...');
        return;
      }
      
      // Check for therapeutic content indicators
      const therapeuticScore = this.calculateTherapeuticScore(conversationSummary);
      console.log('📊 FLOWCHART AGENT: Therapeutic content score:', therapeuticScore);
      
      if (therapeuticScore < 2) {
        console.log('📊 FLOWCHART AGENT: Not enough therapeutic content for flowchart generation');
        callbacks?.onAnalysisUpdate?.('Listening for emotional content and parts work...');
        return;
      }

      // Load template for exact structure reference
      const template = this.loadTemplate();
      const templateStructure = template?.structure ? JSON.stringify(template.structure, null, 2) : 'Template not available';
      
      const analysisPrompt = `CONVERSATION TO ANALYZE:
${conversationSummary}

${this.currentFlowchart ? `\nEXISTING FLOWCHART TO UPDATE:\n${JSON.stringify(this.currentFlowchart, null, 2)}\n` : ''}

Analyze this therapeutic conversation and ${this.currentFlowchart ? 'update the existing flowchart with any new' : 'create a complete flowchart representing the'} therapeutic elements, parts, needs, and relationships discussed.

CRITICAL: Your response must be ONLY valid JSON matching EXACTLY the structure from template1.json shown below:

EXACT TEMPLATE STRUCTURE TO FOLLOW:
${templateStructure}

STRICT VALIDATION REQUIREMENTS:
1. Node types: EXACTLY "Need", "Self", "Manager", "Exile", "Firefighter" (case-sensitive)
2. Edge types: EXACTLY "💚", "💔", "❌", "🚨" (these specific emojis only)
3. Required node fields: id, label, type, description, x, y (all required)
4. Required edge fields: from, to, type, label (all required)
5. Coordinates: Numbers between 0-1000
6. Edge references: from/to must match existing node ids
7. String fields: Non-empty except edge labels (can be "")

OUTPUT FORMAT: Raw JSON only - no markdown, no code blocks, no explanations.`;
      
      console.log('📊 FLOWCHART AGENT: Analysis prompt:', analysisPrompt.substring(0, 500) + '...');

      console.log('📊 FLOWCHART AGENT: Sending analysis request to OpenAI');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: instructions
            },
            {
              role: 'user',
              content: analysisPrompt
            }
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('📊 FLOWCHART AGENT: OpenAI API error:', response.status, errorText);
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('📊 FLOWCHART AGENT: Received response from OpenAI');
      
      const content = result.choices[0]?.message?.content;

      if (!content) {
        console.log('📊 FLOWCHART AGENT: No content in API response');
        callbacks?.onError?.(new Error('No content in API response'));
        return;
      }
      
      console.log('📊 FLOWCHART AGENT: Received content:', content.substring(0, 200) + '...');
      console.log('📊 FLOWCHART AGENT: Full response content:', content);
      

      try {
        
        let flowchartData = null;
        
        // Try multiple JSON extraction methods
        try {
          // Method 1: Look for complete JSON object
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            flowchartData = JSON.parse(jsonMatch[0]);
          }
        } catch (parseError1) {
          // Method 2: Look for JSON between code blocks
          try {
            const codeBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
            if (codeBlockMatch) {
              flowchartData = JSON.parse(codeBlockMatch[1]);
            }
          } catch (parseError2) {
            // Method 3: Try parsing the entire content as JSON
            try {
              flowchartData = JSON.parse(content.trim());
            } catch (parseError3) {
              console.log('📊 FLOWCHART AGENT: Failed to parse JSON response. Raw content:', content.substring(0, 500));
            }
          }
        }
        
        if (flowchartData) {
          // Fix the structure if needed
          const fixedData = this.fixFlowchartStructure(flowchartData);
          
          // Validate the flowchart structure
          const validationResult = this.validateFlowchartWithDetails(fixedData);
          if (validationResult.isValid) {
            const wasFirstAnalysis = !this.currentFlowchart;
            this.currentFlowchart = fixedData;
            
            console.log('📊 FLOWCHART AGENT: Updated flowchart with', fixedData.nodes.length, 'nodes');
            callbacks?.onFlowchartUpdate?.(fixedData, !wasFirstAnalysis);
            
            // Generate analysis summary
            const analysis = this.generateAnalysisSummary(fixedData, wasFirstAnalysis);
            callbacks?.onAnalysisUpdate?.(analysis);
          } else {
            console.log('📊 FLOWCHART AGENT: Structure validation failed -', validationResult.errors.join(', '));
            callbacks?.onError?.(new Error(`Invalid flowchart structure: ${validationResult.errors.join(', ')}`));
          }
        } else {
          console.log('📊 FLOWCHART AGENT: No valid flowchart data found in response');
          // Create a minimal fallback flowchart if we have enough conversation
          if (this.conversationHistory.length > 0 && !this.currentFlowchart) {
            console.log('📊 FLOWCHART AGENT: Creating fallback flowchart');
            const fallbackFlowchart = this.createMinimalFallbackFlowchart();
            
            this.currentFlowchart = fallbackFlowchart;
            callbacks?.onFlowchartUpdate?.(fallbackFlowchart, false);
            callbacks?.onAnalysisUpdate?.('Created basic flowchart structure (analysis pending)');
          } else {
            console.log('📊 FLOWCHART AGENT: Cannot create flowchart - insufficient data or already exists');
            callbacks?.onError?.(new Error('No valid JSON in response'));
          }
        }
      } catch (parseError) {
        console.log('📊 FLOWCHART AGENT: Parse error -', parseError);
        callbacks?.onError?.(parseError as Error);
      }

    } catch (error) {
      console.log('📊 FLOWCHART AGENT: Analysis error -', error);
      callbacks?.onError?.(error as Error);
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * Create a minimal fallback flowchart when analysis fails
   */
  private createMinimalFallbackFlowchart(): FlowchartStructure {
    
    return {
      nodes: [
        {
          id: 'self_center',
          label: 'Self',
          type: 'self' as const,
          description: 'Core self - centered, curious, compassionate',
          x: 300,
          y: 200
        },
        {
          id: 'basic_need',
          label: 'Basic Need',
          type: 'need' as const,
          description: 'Fundamental human need identified in conversation',
          x: 100,
          y: 100
        }
      ],
      edges: [
        {
          from: 'self_center',
          to: 'basic_need',
          type: '💚',
          label: 'supports'
        }
      ]
    };
  }

  /**
   * Attempt to fix common flowchart structure issues to match template1.json exactly
   */
  private fixFlowchartStructure(data: any): any {
    // Define template compliance requirements
    const VALID_NODE_TYPES = ['Need', 'Self', 'Manager', 'Exile', 'Firefighter'];
    const VALID_EDGE_TYPES = ['💚', '💔', '❌', '🚨'];
    const TYPE_MAPPING: Record<string, string> = {
      'need': 'Need',
      'self': 'Self', 
      'manager': 'Manager',
      'exile': 'Exile',
      'firefighter': 'Firefighter',
      // Handle variations
      'protector': 'Manager',
      'part': 'Manager',
      'vulnerable': 'Exile',
      'wounded': 'Exile',
      'reactive': 'Firefighter',
      'emergency': 'Firefighter'
    };
    
    // If data is null or undefined, create minimal structure
    if (!data) {
      return { nodes: [], edges: [] };
    }
    
    // If data is a string, try to parse it
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        return { nodes: [], edges: [] };
      }
    }
    
    // Ensure data is an object
    if (typeof data !== 'object') {
      return { nodes: [], edges: [] };
    }
    
    // Fix missing or invalid nodes array
    if (!Array.isArray(data.nodes)) {
      data.nodes = [];
    }
    
    // Fix missing or invalid edges array
    if (!Array.isArray(data.edges)) {
      data.edges = [];
    }
    
    // Fix individual nodes to match template1.json structure
    data.nodes = data.nodes.map((node: any, index: number) => {
      const fixedNode = { ...node };
      
      // Ensure all required fields exist
      if (!fixedNode.id) {
        fixedNode.id = `${fixedNode.type || 'node'}_${index}_${Date.now()}`.toLowerCase();
      }
      
      if (!fixedNode.label) {
        fixedNode.label = fixedNode.id || `Node ${index + 1}`;
      }
      
      // Fix node type to match template exactly
      if (!fixedNode.type) {
        fixedNode.type = 'Need'; // Default to Need
      } else {
        const lowerType = String(fixedNode.type).toLowerCase();
        fixedNode.type = TYPE_MAPPING[lowerType] || 
                         VALID_NODE_TYPES.find(t => t.toLowerCase() === lowerType) || 
                         'Need';
      }
      
      // Ensure description exists
      if (!fixedNode.description) {
        fixedNode.description = `${fixedNode.type} identified in conversation`;
      }
      
      // Fix coordinates to be valid numbers within bounds
      if (typeof fixedNode.x !== 'number' || isNaN(fixedNode.x)) {
        fixedNode.x = Math.min(900, 100 + (index * 150)); // Spread horizontally, max 900
      } else {
        fixedNode.x = Math.max(50, Math.min(950, fixedNode.x)); // Clamp to bounds
      }
      
      if (typeof fixedNode.y !== 'number' || isNaN(fixedNode.y)) {
        fixedNode.y = Math.min(800, 100 + (index % 4) * 150); // Distribute vertically, max 800
      } else {
        fixedNode.y = Math.max(50, Math.min(950, fixedNode.y)); // Clamp to bounds
      }
      
      return fixedNode;
    });
    
    // Fix individual edges to match template structure
    data.edges = data.edges.map((edge: any, index: number) => {
      const fixedEdge = { ...edge };
      
      // Ensure from/to exist and reference valid nodes
      if (!fixedEdge.from) {
        fixedEdge.from = data.nodes[0]?.id || 'unknown';
      }
      
      if (!fixedEdge.to) {
        fixedEdge.to = data.nodes[Math.min(1, data.nodes.length - 1)]?.id || fixedEdge.from;
      }
      
      // Fix edge type to match template exactly
      if (!fixedEdge.type || !VALID_EDGE_TYPES.includes(fixedEdge.type)) {
        // Default edge type based on common IFS relationships
        fixedEdge.type = '💚'; // Default to nurturing
      }
      
      // Ensure label exists (can be empty string per template)
      if (fixedEdge.label === undefined || fixedEdge.label === null) {
        fixedEdge.label = '';
      }
      
      return fixedEdge;
    });
    
    return data;
  }

  /**
   * Validate flowchart structure with detailed error reporting against template1.json
   */
  private validateFlowchartWithDetails(data: any): {isValid: boolean, errors: string[]} {
    const errors: string[] = [];
    
    // Define exact template requirements from template1.json
    const VALID_NODE_TYPES = ['Need', 'Self', 'Manager', 'Exile', 'Firefighter'];
    const VALID_EDGE_TYPES = ['💚', '💔', '❌', '🚨'];
    const REQUIRED_NODE_FIELDS = ['id', 'label', 'type', 'description', 'x', 'y'];
    const REQUIRED_EDGE_FIELDS = ['from', 'to', 'type', 'label'];
    
    if (!data) {
      errors.push('Data is null or undefined');
      return {isValid: false, errors};
    }
    
    // Validate nodes array
    if (!Array.isArray(data.nodes)) {
      errors.push('nodes is not an array');
    } else {
      if (data.nodes.length === 0) {
        errors.push('nodes array is empty');
      } else {
        data.nodes.forEach((node: any, index: number) => {
          // Check required fields exist
          REQUIRED_NODE_FIELDS.forEach(field => {
            if (node[field] === undefined || node[field] === null) {
              errors.push(`Node ${index} missing required field: ${field}`);
            }
          });
          
          // Validate node type against template
          if (node.type && !VALID_NODE_TYPES.includes(node.type)) {
            errors.push(`Node ${index} has invalid type "${node.type}". Must be one of: ${VALID_NODE_TYPES.join(', ')}`);
          }
          
          // Validate coordinates are numbers
          if (typeof node.x !== 'number' || isNaN(node.x)) {
            errors.push(`Node ${index} x coordinate must be a valid number`);
          }
          if (typeof node.y !== 'number' || isNaN(node.y)) {
            errors.push(`Node ${index} y coordinate must be a valid number`);
          }
          
          // Validate coordinate bounds (reasonable flowchart area)
          if (typeof node.x === 'number' && (node.x < 0 || node.x > 1000)) {
            errors.push(`Node ${index} x coordinate ${node.x} is out of bounds (0-1000)`);
          }
          if (typeof node.y === 'number' && (node.y < 0 || node.y > 1000)) {
            errors.push(`Node ${index} y coordinate ${node.y} is out of bounds (0-1000)`);
          }
          
          // Validate string fields are not empty
          if (node.id && typeof node.id === 'string' && node.id.trim() === '') {
            errors.push(`Node ${index} id cannot be empty string`);
          }
          if (node.label && typeof node.label === 'string' && node.label.trim() === '') {
            errors.push(`Node ${index} label cannot be empty string`);
          }
        });
      }
    }
    
    // Validate edges array
    if (!Array.isArray(data.edges)) {
      errors.push('edges is not an array');
    } else {
      data.edges.forEach((edge: any, index: number) => {
        // Check required fields exist
        REQUIRED_EDGE_FIELDS.forEach(field => {
          if (edge[field] === undefined || edge[field] === null) {
            errors.push(`Edge ${index} missing required field: ${field}`);
          }
        });
        
        // Validate edge type against template
        if (edge.type && !VALID_EDGE_TYPES.includes(edge.type)) {
          errors.push(`Edge ${index} has invalid type "${edge.type}". Must be one of: ${VALID_EDGE_TYPES.join(', ')}`);
        }
        
        // Validate from/to reference existing nodes
        if (Array.isArray(data.nodes) && edge.from && edge.to) {
          const nodeIds = data.nodes.map((n: any) => n.id);
          if (!nodeIds.includes(edge.from)) {
            errors.push(`Edge ${index} references non-existent node "${edge.from}" in from field`);
          }
          if (!nodeIds.includes(edge.to)) {
            errors.push(`Edge ${index} references non-existent node "${edge.to}" in to field`);
          }
        }
      });
    }
    
    return {isValid: errors.length === 0, errors};
  }

  /**
   * Validate flowchart structure (legacy method)
   */
  private isValidFlowchart(data: any): boolean {
    return this.validateFlowchartWithDetails(data).isValid;
  }

  /**
   * Calculate therapeutic content score to determine if flowchart generation is warranted
   */
  private calculateTherapeuticScore(conversationText: string): number {
    const text = conversationText.toLowerCase();
    let score = 0;
    
    // Emotional expression indicators (1 point each, max 3)
    const emotionalWords = [
      'feel', 'feeling', 'felt', 'emotion', 'emotional', 'angry', 'sad', 'scared', 'happy', 
      'anxious', 'worried', 'frustrated', 'overwhelmed', 'stressed', 'hurt', 'pain', 
      'joy', 'excited', 'nervous', 'afraid', 'disappointed', 'guilty', 'ashamed'
    ];
    const emotionalMatches = emotionalWords.filter(word => text.includes(word)).length;
    score += Math.min(emotionalMatches, 3);
    
    // IFS parts language (2 points each, max 4)
    const partsWords = [
      'part of me', 'parts of me', 'part that', 'manager', 'firefighter', 'exile', 
      'protector', 'inner critic', 'self', 'centered', 'calm', 'curious', 'compassionate'
    ];
    const partsMatches = partsWords.filter(phrase => text.includes(phrase)).length;
    score += Math.min(partsMatches * 2, 4);
    
    // Relationship and conflict indicators (1 point each, max 2)
    const relationshipWords = [
      'relationship', 'conflict', 'struggle', 'tension', 'between', 'against', 
      'protecting', 'defending', 'fighting', 'battle', 'competing'
    ];
    const relationshipMatches = relationshipWords.filter(word => text.includes(word)).length;
    score += Math.min(relationshipMatches, 2);
    
    // Needs and vulnerability indicators (1 point each, max 2)
    const needsWords = [
      'need', 'needs', 'want', 'wants', 'desire', 'long', 'wish', 'hope', 
      'vulnerable', 'safety', 'security', 'love', 'acceptance', 'belonging'
    ];
    const needsMatches = needsWords.filter(word => text.includes(word)).length;
    score += Math.min(needsMatches, 2);
    
    // Personal insight indicators (1 point each, max 2)
    const insightWords = [
      'realize', 'noticed', 'understand', 'recognize', 'aware', 'discovery', 
      'learned', 'insight', 'pattern', 'trigger', 'reaction'
    ];
    const insightMatches = insightWords.filter(word => text.includes(word)).length;
    score += Math.min(insightMatches, 2);
    
    return score;
  }

  /**
   * Generate a human-readable analysis summary
   */
  private generateAnalysisSummary(flowchart: FlowchartStructure, isFirstAnalysis: boolean): string {
    const nodeCount = flowchart.nodes.length;
    const edgeCount = flowchart.edges.length;
    
    const nodeTypes = flowchart.nodes.reduce((acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    let summary = isFirstAnalysis 
      ? `🎯 Initial flowchart created with ${nodeCount} nodes and ${edgeCount} connections.\n\n`
      : `🔄 Flowchart updated with ${nodeCount} nodes and ${edgeCount} connections.\n\n`;

    summary += 'Therapeutic elements identified:\n';
    
    Object.entries(nodeTypes).forEach(([type, count]) => {
      const emoji = this.getTypeEmoji(type);
      summary += `${emoji} ${count} ${type}${count > 1 ? 's' : ''}\n`;
    });

    return summary;
  }

  /**
   * Get emoji for node type
   */
  private getTypeEmoji(type: string): string {
    const emojiMap: Record<string, string> = {
      'Self': '🌟',
      'Manager': '🛡️',
      'Firefighter': '🚨',
      'Exile': '💔',
      'Need': '💚'
    };
    return emojiMap[type] || '⚪';
  }

  /**
   * Get current flowchart
   */
  getCurrentFlowchart(): FlowchartStructure | null {
    return this.currentFlowchart;
  }

  /**
   * Reset the generator
   */
  reset(): void {
    this.conversationHistory = [];
    this.currentFlowchart = null;
    this.lastAnalysisTime = 0;
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): ConversationMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Force immediate analysis (useful for manual triggers)
   */
  async forceAnalysis(callbacks?: IncrementalFlowchartCallbacks): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    await this.analyzeAndUpdateFlowchart(callbacks);
  }
}

export const incrementalFlowchartGenerator = new IncrementalFlowchartGenerator();