import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Cargar .env.local
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

console.log('Testing connection to:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  try {
    const { data, error } = await supabase.from('categorias').select('*');
    if (error) {
      console.error('Error fetching data:', error.message);
    } else {
      console.log('Success! Connection is working. Found categories:', data.length);
    }
  } catch (err) {
    console.error('Exception caught:', err.message);
  }
}

test();
