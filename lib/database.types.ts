export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      emotions: {
        Row: {
          id: string;
          user_id: string;
          label: string | null;
          notes: string | null;
          'feminine-masculine': number;
          'dark-light': number;
          'child-parent': number;
          frequency: number;
          ai_conversation_summary: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label?: string | null;
          notes?: string | null;
          'feminine-masculine': number;
          'dark-light': number;
          'child-parent': number;
          frequency: number;
          ai_conversation_summary?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          label?: string | null;
          notes?: string | null;
          'feminine-masculine'?: number;
          'dark-light'?: number;
          'child-parent'?: number;
          frequency?: number;
          ai_conversation_summary?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}