import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vshyjdmtpxqbjptzrqzp.supabase.co";
const supabaseKey = 
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  "sb_publishable_iCHpdZfgN6JLgEwZEzadSA_csgx5g7w";

export const supabase = createClient(supabaseUrl, supabaseKey);
