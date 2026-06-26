export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string | null
          email: string
          plan: 'free' | 'starter' | 'pro' | 'enterprise'
          credits: number
          created_at: string
        }
        Insert: {
          id: string
          name?: string | null
          email: string
          plan?: 'free' | 'starter' | 'pro' | 'enterprise'
          credits?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string | null
          email?: string
          plan?: 'free' | 'starter' | 'pro' | 'enterprise'
          credits?: number
          created_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          user_id: string
          title: string
          type: 'reel' | 'short' | 'story' | 'ad'
          status: 'draft' | 'processing' | 'completed' | 'failed'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          type?: 'reel' | 'short' | 'story' | 'ad'
          status?: 'draft' | 'processing' | 'completed' | 'failed'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          type?: 'reel' | 'short' | 'story' | 'ad'
          status?: 'draft' | 'processing' | 'completed' | 'failed'
          created_at?: string
        }
      }
      videos: {
        Row: {
          id: string
          project_id: string
          script: string | null
          voice_url: string | null
          video_url: string | null
          thumbnail_url: string | null
          duration: number | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          script?: string | null
          voice_url?: string | null
          video_url?: string | null
          thumbnail_url?: string | null
          duration?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          script?: string | null
          voice_url?: string | null
          video_url?: string | null
          thumbnail_url?: string | null
          duration?: number | null
          created_at?: string
        }
      }
      thumbnails: {
        Row: {
          id: string
          user_id: string
          prompt: string
          image_url: string | null
          style: 'realistic' | 'cartoon' | 'minimalist' | 'cinematic' | 'anime'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          prompt: string
          image_url?: string | null
          style?: 'realistic' | 'cartoon' | 'minimalist' | 'cinematic' | 'anime'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          prompt?: string
          image_url?: string | null
          style?: 'realistic' | 'cartoon' | 'minimalist' | 'cinematic' | 'anime'
          created_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          user_id: string
          amount: number
          gateway: 'stripe' | 'paypal' | 'razorpay'
          status: 'pending' | 'completed' | 'failed' | 'refunded'
          subscription_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          gateway?: 'stripe' | 'paypal' | 'razorpay'
          status?: 'pending' | 'completed' | 'failed' | 'refunded'
          subscription_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          gateway?: 'stripe' | 'paypal' | 'razorpay'
          status?: 'pending' | 'completed' | 'failed' | 'refunded'
          subscription_id?: string | null
          created_at?: string
        }
      }
      affiliates: {
        Row: {
          id: string
          user_id: string
          referral_code: string
          commission: number
          earnings: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          referral_code: string
          commission?: number
          earnings?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          referral_code?: string
          commission?: number
          earnings?: number
          created_at?: string
        }
      }
    }
  }
}
