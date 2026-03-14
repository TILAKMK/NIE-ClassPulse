// ============================================================
//  js/supabase.js  —  Supabase client initialisation
//  Replace the two constants below with your own project values
//  from: https://supabase.com → Project → Settings → API
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';   // ← paste your URL
const SUPABASE_ANON = 'YOUR_ANON_PUBLIC_KEY';                  // ← paste your anon key

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
