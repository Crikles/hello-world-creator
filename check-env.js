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

const supabaseUrl = env.VITE_SUPABASE_URL;
// the user's service role key might not be in .env, let's see if we can get it or if blackcat API key is there
console.log("Found env keys:", Object.keys(env));

// let's just make a curl to blackcat if we have the key
const blackcatKey = env.BLACKCAT_API_KEY;
if (blackcatKey) {
    console.log("We have Blackcat KEY!");
} else {
    console.log("No Blackcat KEY in .env");
}
