import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client for use in API routes.
 * Uses the same anon key but avoids sharing state with the client-side singleton.
 *
 * IMPORTANT: Before using Storage, create the buckets in Supabase Dashboard or via SQL:
 *
 *   INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true);
 *   INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true);
 *
 *   -- Allow public read access
 *   CREATE POLICY "Public read images" ON storage.objects FOR SELECT USING (bucket_id = 'images');
 *   CREATE POLICY "Public read attachments" ON storage.objects FOR SELECT USING (bucket_id = 'attachments');
 *
 *   -- Allow anon uploads
 *   CREATE POLICY "Anon upload images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'images');
 *   CREATE POLICY "Anon upload attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'attachments');
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabaseServer = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Attempt to create a storage bucket if it doesn't exist.
 * Safe to call multiple times – ignores "already exists" errors.
 */
export async function ensureBucket(bucketId: string) {
  const { error } = await supabaseServer.storage.createBucket(bucketId, {
    public: true,
  });
  // Ignore "already exists" error (409 / "Bucket already exists")
  if (error && !error.message?.includes("already exists")) {
    console.warn(`Bucket "${bucketId}" creation warning:`, error.message);
  }
}
