import { createClient } from '@supabase/supabase-js';

// anon key เป็น public — RLS เป็นตัวกันข้อมูล (ห้ามใช้ service_role ฝั่ง client)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
