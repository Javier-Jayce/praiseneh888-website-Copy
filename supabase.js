// Supabase connection settings
export const SUPABASE_URL = "https://fmhojxapicvjrbpzusxl.supabase.co";
export const SUPABASE_ANON_KEY = "YOUR_PUBLISHABLE_KEY";

export const supabaseConfigured =
  !SUPABASE_URL.startsWith("YOUR_") &&
  !SUPABASE_ANON_KEY.startsWith("YOUR_");
