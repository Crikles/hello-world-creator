import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    const k = parts.shift();
    const v = parts.join('=');
    if (k && v) env[k.trim()] = v.trim();
});

const VITE_SUPABASE_URL = env.VITE_SUPABASE_URL;
const VITE_SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await supabase
        .from('pix_payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error fetching:", error);
    } else {
        console.log("Recent PIX Payments:");
        console.log(JSON.stringify(data, null, 2));
    }
}

run();
