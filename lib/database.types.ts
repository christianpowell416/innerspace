import { FlowchartRow, FlowchartInsert, FlowchartUpdate } from './types/flowchart';

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
    };
  };
}