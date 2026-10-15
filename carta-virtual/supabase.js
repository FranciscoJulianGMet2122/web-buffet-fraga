import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Pegá aquí la URL exacta que copiaste de tu panel de Supabase:
const SUPABASE_URL = 'https://kwttzjldxgqkkxkprpmb.supabase.co'; 

// Pegá aquí tu Clave Pública (anon / public):
const SUPABASE_ANON_KEY = 'sb_publishable_Rmb1XVv0wPyL5Rcl0K5vMg_pAfDinMT'; 

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);