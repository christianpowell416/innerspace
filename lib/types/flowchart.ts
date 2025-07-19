// Flowchart types for IFS therapy visualization

export type PartType = 'self' | 'manager' | 'firefighter' | 'exile';
export type RelationshipType = 'protection' | 'suppression' | 'alliance' | 'conflict' | 'healing';

export interface FlowchartNode {
  id: string;
  label: string;
  x: number;
  y: number;
  type: PartType;
  description?: string;
}

export interface FlowchartEdge {
  from: string;
  to: string;
  type: RelationshipType;
  label?: string;
}

export interface FlowchartStructure {
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
  metadata?: {
    version?: string;
    lastModified?: string;
    notes?: string;
  };
}

export interface FlowchartRow {
  id: string;
  user_id: string;
  name: string;
  structure: FlowchartStructure;
  last_updated: string;
  created_at: string;
  is_default: boolean;
}

export interface FlowchartInsert {
  id?: string;
  user_id: string;
  name?: string;
  structure: FlowchartStructure;
  last_updated?: string;
  created_at?: string;
  is_default?: boolean;
}

export interface FlowchartUpdate {
  id?: string;
  user_id?: string;
  name?: string;
  structure?: FlowchartStructure;
  last_updated?: string;
  created_at?: string;
  is_default?: boolean;
}

// ELIMINATED: Default flowchart completely removed to ensure only AI-generated flowcharts are used
// If you need a fallback, it should be a minimal structure or throw an error to force AI generation

// Color schemes for different part types
export const PartColors = {
  self: '#4CAF50',      // Green - growth and healing
  manager: '#2196F3',   // Blue - stability and control
  firefighter: '#FF5722', // Red-orange - energy and reaction
  exile: '#9C27B0'      // Purple - depth and vulnerability
} as const;

// Relationship line styles
export const RelationshipStyles = {
  protection: { strokeWidth: 2, strokeDasharray: '0', color: '#4CAF50' },
  suppression: { strokeWidth: 2, strokeDasharray: '5,5', color: '#FF5722' },
  alliance: { strokeWidth: 3, strokeDasharray: '0', color: '#2196F3' },
  conflict: { strokeWidth: 2, strokeDasharray: '10,5', color: '#F44336' },
  healing: { strokeWidth: 3, strokeDasharray: '0', color: '#FFD700' }
} as const;