// Supabase connection settings
export const SUPABASE_URL = "https://fmhojxapicvjrbpzusxl.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_5uJwSdJdDBXfWdChhOptpw_RQmPucLq"

export const supabaseConfigured =
  !SUPABASE_URL.startsWith("YOUR_") &&
  !SUPABASE_ANON_KEY.startsWith("YOUR_");
