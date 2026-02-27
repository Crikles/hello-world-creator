import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    const k = parts.shift();
    const v = parts.join('=');
    if (k && v) env[k.trim()] = v.trim().replace(/^"|"$/g, '');
});

const VITE_SUPABASE_URL = env.VITE_SUPABASE_URL;
// We need the service role key ideally, but let's see if we can read the table definition directly
// With anon key we can just query the table to see columns
const VITE_SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function checkLojas() {
    const { data, error } = await supabase.from('lojas').select('*').limit(1);
    if (error) console.error("Error reading lojas:", error);
    else if (data && data.length > 0) console.log("Lojas fields:", Object.keys(data[0]));
    else console.log("Lojas table empty or no access.");
}
checkLojas();
