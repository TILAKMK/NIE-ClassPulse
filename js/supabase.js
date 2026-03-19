// ============================================================
//  js/supabase.js  —  Supabase client initialisation
//  Replace the two constants below with your own project values
//  from: https://supabase.com → Project → Settings → API
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL  = 'https://pkibnsqijbhggaxpkbml.supabase.co';   // ← paste your URL
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBraWJuc3FpamJoZ2dheHBrYm1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTkwOTAsImV4cCI6MjA4ODczNTA5MH0.6Cd3RMMh6a9DfyUYT6iz9of87NlUiUwJNJVFh9VJvGM';                  // ← paste your anon key

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
