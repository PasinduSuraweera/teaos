import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client-side Supabase instance (safe for browser) - for data operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Browser client with cookie support - for auth operations
export function createBrowserSupabaseClient() {
  return createSSRBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Alias for consistency
export const createBrowserClient = createBrowserSupabaseClient

// Server-side admin client factory (only use in API routes or server components)
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}