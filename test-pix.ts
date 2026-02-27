import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
    console.error("Missing ENV variables. Checked VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY / PUBLISHABLE_KEY");
    process.exit(1);
}

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
