// ============================================================
// Supabase データベース型定義
// Database 型は supabase gen types と同じインライン形式で定義する
// （named interface を Row に使うと Record<string,unknown> を満たせず never になる）
// ============================================================

export type Role        = 'staff' | 'admin'
export type ShiftStatus = 'submitted' | 'approved' | 'rejected'

// ---- アプリ側で使うヘルパー型 ----

export interface Profile {
  id:          string
  staff_code:  string
  full_name:   string
  role:        Role
  is_active:   boolean
  level:       number | null   // 習熟度レベル 1〜6（管理者のみ閲覧）
  created_at:  string
  updated_at:  string
}

export interface Shift {
  id:             string
  profile_id:     string
  shift_date:     string        // "YYYY-MM-DD"
  start_time:     string        // "HH:MM"
  end_time:       string        // "HH:MM"
  note:           string | null
  status:         ShiftStatus
  admin_adjusted: boolean
  position:       string | null // 当日ポジション（スタッフにも公開）
  created_at:     string
  updated_at:     string
}

export interface ShiftWithProfile extends Shift {
  profiles: Pick<Profile, 'staff_code' | 'full_name'>
}

// ============================================================
// Database 型 — Supabase 自動生成と同じインラインオブジェクト形式
// ============================================================
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id:          string
          staff_code:  string
          full_name:   string
          role:        'staff' | 'admin'
          is_active:   boolean
          level:       number | null
          created_at:  string
          updated_at:  string
        }
        Insert: {
          id:          string
          staff_code:  string
          full_name:   string
          role:        'staff' | 'admin'
          is_active:   boolean
          level?:      number | null
        }
        Update: {
          staff_code?: string
          full_name?:  string
          role?:       'staff' | 'admin'
          is_active?:  boolean
          level?:      number | null
        }
        Relationships: []
      }
      shifts: {
        Row: {
          id:             string
          profile_id:     string
          shift_date:     string
          start_time:     string
          end_time:       string
          note:           string | null
          status:         'submitted' | 'approved' | 'rejected'
          admin_adjusted: boolean
          position:       string | null
          created_at:     string
          updated_at:     string
        }
        Insert: {
          profile_id:      string
          shift_date:      string
          start_time:      string
          end_time:        string
          note?:           string | null
          admin_adjusted?: boolean
          position?:       string | null
        }
        Update: {
          shift_date?:     string
          start_time?:     string
          end_time?:       string
          note?:           string | null
          status?:         'submitted' | 'approved' | 'rejected'
          admin_adjusted?: boolean
          position?:       string | null
        }
        Relationships: [
          {
            foreignKeyName: 'shifts_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views:          { [_ in never]: never }
    Functions:      { [_ in never]: never }
    Enums: {
      role:         'staff' | 'admin'
      shift_status: 'submitted' | 'approved' | 'rejected'
    }
    CompositeTypes: { [_ in never]: never }
  }
}
