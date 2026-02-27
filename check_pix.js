import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function check() {
    const { data, error } = await supabase.from('pix_payments').select('*').order('created_at', { ascending: false }).limit(5);
    console.log(JSON.stringify(data, null, 2));
}

check();
