import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anon) {
  // eslint-disable-next-line no-console
  console.warn("Supabase env vars missing — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
}

// createClient throws on empty strings, which would crash the whole app at
// module load; syntactically valid placeholders let the UI render (requests
// then fail visibly, matching the warning above).
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anon || "public-anon-key-missing",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
