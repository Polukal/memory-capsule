# Photo Upload Backend - Complete Setup

## Overview
Complete Supabase backend for photo upload and gallery feature with RLS security.

---

## 1️⃣ Database Schema

### Photos Table
```sql
photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  file_path text not null,
  created_at timestamptz default now(),
  album_id uuid null
)
```

---

## 2️⃣ Storage Bucket

**Bucket Name:** `user-uploads`

**Public Access:** No (private bucket with signed URLs)

**Path Pattern:**
```
user-uploads/{user_id}/{filename}.{ext}
```

**Example Object Path:**
```
user-uploads/550e8400-e29b-41d4-a716-446655440000/photo-abc123.jpg
```

---

## 3️⃣ RLS Policies

### Photos Table Policies

1. **Insert:** Users can only insert photos for themselves
   - Policy: `users_insert_their_photos`
   - Check: `auth.uid() = user_id`

2. **Select:** Users can only view their own photos
   - Policy: `users_select_their_photos`
   - Check: `auth.uid() = user_id`

3. **Update/Delete:** Users can modify their own photos
   - Policy: `owner_update_delete`
   - Check: `auth.uid() = user_id`

### Storage Bucket Policies

1. **Upload:** Users can upload only to their own folder
   - Path must start with their `user_id`

2. **Read/Update/Delete:** Users can only access their own files
   - Path validation: `(storage.foldername(name))[1] = auth.uid()::text`

---

## 4️⃣ Mobile App Upload Code

### Upload Photo to Storage

```typescript
import { supabase } from './supabase-client';
import { decode } from 'base64-arraybuffer';

async function uploadPhoto(base64Image: string, userId: string) {
  try {
    // Generate unique filename
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const filePath = `${userId}/${fileName}`;

    // Decode base64 image
    const arrayBuffer = decode(base64Image);

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(filePath, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Save metadata to database
    const { data: photoData, error: dbError } = await supabase
      .from('photos')
      .insert({
        user_id: userId,
        file_path: filePath
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return { success: true, photo: photoData };
  } catch (error) {
    console.error('Upload failed:', error);
    return { success: false, error };
  }
}
```

---

## 5️⃣ Fetch Gallery Photos

### Get User's Photos with Signed URLs

```typescript
async function getUserPhotos(userId: string) {
  try {
    // Fetch photo metadata from database
    const { data: photos, error: dbError } = await supabase
      .from('photos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (dbError) throw dbError;

    // Generate signed URLs for each photo
    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => {
        const { data: signedUrlData } = await supabase.storage
          .from('user-uploads')
          .createSignedUrl(photo.file_path, 3600); // 1 hour expiry

        return {
          ...photo,
          signedUrl: signedUrlData?.signedUrl || null
        };
      })
    );

    return { success: true, photos: photosWithUrls };
  } catch (error) {
    console.error('Fetch failed:', error);
    return { success: false, error };
  }
}
```

---

## 6️⃣ Signed URL Request Example

### Single Photo Signed URL

```typescript
// Get signed URL for a specific photo (valid for 1 hour)
const { data, error } = await supabase.storage
  .from('user-uploads')
  .createSignedUrl(
    '550e8400-e29b-41d4-a716-446655440000/photo-abc123.jpg',
    3600  // expires in 1 hour (3600 seconds)
  );

console.log('Signed URL:', data.signedUrl);
// Output: https://your-project.supabase.co/storage/v1/object/sign/user-uploads/550e8400...?token=...
```

### Batch Signed URLs

```typescript
// Get multiple signed URLs at once
const filePaths = [
  '550e8400-e29b-41d4-a716-446655440000/photo-1.jpg',
  '550e8400-e29b-41d4-a716-446655440000/photo-2.jpg',
  '550e8400-e29b-41d4-a716-446655440000/photo-3.jpg'
];

const { data, error } = await supabase.storage
  .from('user-uploads')
  .createSignedUrls(filePaths, 3600);

console.log('Signed URLs:', data);
```

---

## 7️⃣ Running the Migration

Apply the migration to your Supabase project:

```bash
# Local development
supabase db reset

# Or push to remote
supabase db push
```

---

## 8️⃣ Test Data

The migration automatically inserts 5 test photos for the first user in `auth.users`.

If you need to manually insert test data:

```sql
-- Replace with your actual user_id
insert into public.photos (user_id, file_path, created_at) values
  ('your-user-id', 'your-user-id/photo-1.jpg', now() - interval '5 days'),
  ('your-user-id', 'your-user-id/photo-2.jpg', now() - interval '4 days'),
  ('your-user-id', 'your-user-id/photo-3.jpg', now() - interval '3 days'),
  ('your-user-id', 'your-user-id/photo-4.jpg', now() - interval '2 days'),
  ('your-user-id', 'your-user-id/photo-5.jpg', now() - interval '1 day');
```

---

## Security Notes

✅ **Enforced:**
- Users can only upload to their own folder (`user_id/`)
- Users can only read their own photos
- All access validated via RLS
- Signed URLs expire after 1 hour (configurable)

❌ **Not Allowed:**
- Public bucket access
- Cross-user file access
- Unauthenticated uploads

---

## What's NOT Included (As Requested)

- ❌ Authentication config changes
- ❌ animatePhoto logic
- ❌ Albums feature (album_id column exists but unused)
- ❌ Public bucket access
- ❌ Additional edge functions

---

## Complete! ✅

Your backend is ready for:
1. Photo uploads from mobile app
2. Gallery listing with signed URLs
3. Secure user-isolated storage
4. Test data for development
