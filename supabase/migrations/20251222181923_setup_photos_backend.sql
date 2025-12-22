-- ============================================
-- 1️⃣ CREATE PHOTOS TABLE
-- ============================================

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  file_path text not null,
  created_at timestamptz default now(),
  album_id uuid null
);

-- ============================================
-- 2️⃣ ENABLE ROW LEVEL SECURITY
-- ============================================

alter table public.photos enable row level security;

-- ============================================
-- 3️⃣ RLS POLICIES
-- ============================================

-- Policy: Users can insert their own photos
create policy "users_insert_their_photos"
on public.photos for insert
with check (auth.uid() = user_id);

-- Policy: Users can select their own photos
create policy "users_select_their_photos"
on public.photos for select
using (auth.uid() = user_id);

-- Policy: Users can update/delete their own photos
create policy "owner_update_delete"
on public.photos for all
using (auth.uid() = user_id);

-- ============================================
-- 4️⃣ CREATE STORAGE BUCKET
-- ============================================

insert into storage.buckets (id, name, public)
values ('user-uploads', 'user-uploads', false)
on conflict (id) do nothing;

-- ============================================
-- 5️⃣ STORAGE BUCKET POLICIES
-- ============================================

-- Policy: Authenticated users can upload to their own folder
create policy "users_upload_to_own_folder"
on storage.objects for insert
with check (
  bucket_id = 'user-uploads'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can read their own uploads
create policy "users_read_own_uploads"
on storage.objects for select
using (
  bucket_id = 'user-uploads'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own uploads
create policy "users_update_own_uploads"
on storage.objects for update
using (
  bucket_id = 'user-uploads'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own uploads
create policy "users_delete_own_uploads"
on storage.objects for delete
using (
  bucket_id = 'user-uploads'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- 6️⃣ INSERT TEST DATA (5 FAKE PHOTOS)
-- ============================================

-- Note: Replace 'test-user-uuid' with actual user UUID from auth.users
-- For testing, insert with a placeholder that you can update after creating a test user

do $$
declare
  test_user_id uuid;
begin
  -- Try to get the first user from auth.users
  select id into test_user_id from auth.users limit 1;

  -- Only insert test data if a user exists
  if test_user_id is not null then
    insert into public.photos (user_id, file_path, created_at) values
      (test_user_id, test_user_id::text || '/photo-1.jpg', now() - interval '5 days'),
      (test_user_id, test_user_id::text || '/photo-2.jpg', now() - interval '4 days'),
      (test_user_id, test_user_id::text || '/photo-3.jpg', now() - interval '3 days'),
      (test_user_id, test_user_id::text || '/photo-4.jpg', now() - interval '2 days'),
      (test_user_id, test_user_id::text || '/photo-5.jpg', now() - interval '1 day');

    raise notice 'Inserted 5 test photos for user %', test_user_id;
  else
    raise notice 'No users found. Test photos not inserted. Create a user first, then manually insert test data.';
  end if;
end $$;
