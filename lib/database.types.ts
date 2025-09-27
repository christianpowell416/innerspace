import { FlowchartRow, FlowchartInsert, FlowchartUpdate } from './types/flowchart';

export interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant';
  text: string;
  timestamp: number;
  sessionId?: string;
}

export interface DetectedItem {
  name: string;
  confidence: number;
  context?: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          first_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          first_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          first_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      beliefs: {
        Row: {
          id: string;
          user_id: string;
          emotion: string | null;
          notes: string | null;
          'feminine-masculine': number;
          'dark-light': number;
          'child-parent': number;
          frequency: number;
          ai_conversation_summary: string | null;
          belief: string | null;
          released: boolean;
          released_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          emotion?: string | null;
          notes?: string | null;
          'feminine-masculine': number;
          'dark-light': number;
          'child-parent': number;
          frequency: number;
          ai_conversation_summary?: string | null;
          belief?: string | null;
          released?: boolean;
          released_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          emotion?: string | null;
          notes?: string | null;
          'feminine-masculine'?: number;
          'dark-light'?: number;
          'child-parent'?: number;
          frequency?: number;
          ai_conversation_summary?: string | null;
          belief?: string | null;
          released?: boolean;
          released_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      flowcharts: {
        Row: FlowchartRow;
        Insert: FlowchartInsert;
        Update: FlowchartUpdate;
      };
      complexes: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          color: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          user_id: string;
          complex_id: string | null;
          topic: string;
          title: string | null;
          messages: ConversationMessage[];
          summary: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          complex_id?: string | null;
          topic: string;
          title?: string | null;
          messages: ConversationMessage[];
          summary?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          complex_id?: string | null;
          topic?: string;
          title?: string | null;
          messages?: ConversationMessage[];
          summary?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      detected_emotions: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          emotions: DetectedItem[];
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          user_id: string;
          emotions: DetectedItem[];
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          user_id?: string;
          emotions?: DetectedItem[];
          created_at?: string;
        };
      };
      detected_parts: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          parts: DetectedItem[];
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          user_id: string;
          parts: DetectedItem[];
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          user_id?: string;
          parts?: DetectedItem[];
          created_at?: string;
        };
      };
      detected_needs: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          needs: DetectedItem[];
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          user_id: string;
          needs: DetectedItem[];
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          user_id?: string;
          needs?: DetectedItem[];
          created_at?: string;
        };
      };
    };
  };
}