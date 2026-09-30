import "server-only";
import { createClient } from "@supabase/supabase-js";

export function getSupabaseServer() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local"
    );
  }

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
