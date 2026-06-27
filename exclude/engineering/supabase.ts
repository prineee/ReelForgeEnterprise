export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      [_: string]: never
    }
    Views: {
      [_: string]: never
    }
    Functions: {
      [_: string]: never
    }
  }
}