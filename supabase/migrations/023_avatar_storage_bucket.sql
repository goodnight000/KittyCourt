-- ============================================
-- MIGRATION: Avatar Storage Bucket
-- ============================================
-- Creates a Supabase Storage bucket for user avatars.
-- Custom photos are uploaded here instead of stored as base64.
-- ============================================

-- Create the avatars bucket with public access
-- Note: This needs to be run via Supabase Dashboard Storage settings
-- or via the Supabase Management API, as storage.buckets may not be
-- directly accessible via SQL in all configurations.

-- For Supabase projects that support direct bucket creation:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,  -- Public bucket so avatars can be displayed without auth
    2097152,  -- 2MB limit per file
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================
-- STORAGE POLICIES
-- ============================================

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own avatars
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own avatars
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to all avatars
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- ============================================
-- DONE!
-- ============================================
-- After running this migration:
-- 1. Custom avatar uploads go to: avatars/{user_id}/avatar.{ext}
-- 2. Public URL format: {supabase_url}/storage/v1/object/public/avatars/{user_id}/avatar.png
-- ============================================
