# Memory Capsule Backend

Backend API for the Memory Capsule mobile application - a photo management and animation platform built with Supabase.

## Overview

Memory Capsule is a backend service that handles photo uploads, storage, and AI-powered photo animation. Built on Supabase, it provides secure, scalable infrastructure for managing user photos and generating animated versions using AI models.

## Tech Stack

- **Backend Platform**: [Supabase](https://supabase.com)
- **Runtime**: Deno 2.0 (Edge Functions)
- **Database**: PostgreSQL (Supabase)
- **Storage**: Supabase Storage
- **AI Integration**: [fal.ai](https://fal.ai) (Kling Video v1.6 Pro)
- **Language**: TypeScript

## Features

- Photo upload and storage management
- User authentication and authorization
- AI-powered photo animation (image-to-video)
- Album organization
- Secure file storage with signed URLs
- Row Level Security (RLS) policies

## Project Structure

```
memory-capsule/
├── supabase/
│   ├── functions/
│   │   ├── animatePhoto/      # AI photo animation edge function
│   │   └── uploadPhoto/        # Photo upload edge function
│   ├── migrations/             # Database migrations
│   └── config.toml            # Supabase configuration
├── BACKEND_SETUP.md           # Detailed backend setup guide
└── README.md                  # This file
```

## Database Schema

### Photos Table
```sql
photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  file_path text not null,
  status text,
  album_id uuid null,
  created_at timestamptz default now()
)
```

### Animations Table
```sql
animations (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid references photos(id) on delete cascade not null,
  video_path text,
  model_used text,
  fal_job_id text,
  status text,
  created_at timestamptz default now()
)
```

## Storage Buckets

### user-uploads
- **Purpose**: Store original uploaded photos
- **Access**: Private with RLS policies
- **Path Pattern**: `{user_id}/{unique_id}.{ext}`

### animations
- **Purpose**: Store generated animation videos
- **Access**: Private with RLS policies
- **Path Pattern**: `{album_id}/{photo_id}-{timestamp}.mp4`

## API Endpoints

### 1. Upload Photo
**Endpoint**: `/functions/v1/uploadPhoto`
**Method**: POST
**Content-Type**: multipart/form-data

**Request Body**:
```typescript
{
  album_id: string,
  user_id: string,
  file: File
}
```

**Response**:
```typescript
{
  success: true,
  photo: {
    id: string,
    file_path: string,
    status: "uploaded",
    user_id: string,
    album_id: string,
    created_at: string
  }
}
```

### 2. Animate Photo
**Endpoint**: `/functions/v1/animatePhoto`
**Method**: POST
**Content-Type**: application/json
**Auth**: Required (JWT)

**Request Body**:
```typescript
{
  photo_id: string
}
```

**Response (Completed)**:
```typescript
{
  success: true,
  animation: {
    id: string,
    photo_id: string,
    video_path: string,
    model_used: "v1.6",
    status: "completed"
  }
}
```

**Response (Pending)**:
```typescript
{
  success: true,
  status: "pending",
  message: "Animation still being generated. Check back in ~3 minutes."
}
```

## Getting Started

### Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- Node.js 18+ (for local dependencies)
- Deno 2.0 (for edge functions)
- Supabase account

### Installation

1. Clone the repository
```bash
git clone <your-repo-url>
cd memory-capsule
```

2. Install dependencies
```bash
cd supabase
npm install
```

3. Link to your Supabase project
```bash
supabase link --project-ref <your-project-ref>
```

4. Set up environment variables
```bash
# Create .env file for edge functions
echo "PROJECT_URL=<your-project-url>" >> supabase/.env
echo "SERVICE_ROLE_KEY=<your-service-role-key>" >> supabase/.env
echo "FAL_KEY=<your-fal-api-key>" >> supabase/.env
```

5. Run migrations
```bash
supabase db reset
# or for remote
supabase db push
```

6. Deploy edge functions
```bash
supabase functions deploy animatePhoto
supabase functions deploy uploadPhoto
```

### Local Development

1. Start Supabase locally
```bash
supabase start
```

2. Serve edge functions locally
```bash
supabase functions serve
```

3. Access local services:
   - API: http://127.0.0.1:54321
   - Studio: http://127.0.0.1:54323
   - Functions: http://127.0.0.1:54321/functions/v1

## Security

### Row Level Security (RLS)

All tables have RLS enabled with the following policies:

**Photos Table**:
- Users can only insert photos for themselves
- Users can only view their own photos
- Users can only update/delete their own photos

**Storage Buckets**:
- Users can only upload to their own folder (`user_id/`)
- Users can only read/update/delete their own files
- Path validation ensures folder isolation

### Authentication

- JWT-based authentication via Supabase Auth
- Edge functions verify JWT tokens (`verify_jwt = true`)
- Service role key used for server-side operations

## AI Animation Details

### Model
- **Provider**: fal.ai
- **Model**: kling-video/v1.6/pro/image-to-video
- **Duration**: 5 seconds
- **Aspect Ratio**: 16:9
- **Prompt**: "Realistic old portrait animation"

### Processing Flow
1. Client requests animation for a photo
2. Function generates signed URL for the photo
3. Submits job to fal.ai API
4. Polls for completion (max 400 seconds)
5. Downloads generated video
6. Uploads to Supabase Storage
7. Creates database record
8. Returns animation details

### Pending Jobs
If animation takes longer than 400 seconds, the job is marked as pending and stored in the database for later retrieval.

## Environment Variables

### Required for Edge Functions

```bash
PROJECT_URL          # Supabase project URL
SERVICE_ROLE_KEY     # Supabase service role key
FAL_KEY             # fal.ai API key
```

### Configure in Supabase Dashboard

Go to Project Settings > Edge Functions > Secrets to set these values for production.

## Configuration

Main configuration is in [supabase/config.toml](supabase/config.toml):

- Database settings (port, version)
- Storage limits (50MiB max file size)
- Edge function settings
- Authentication settings
- API endpoints

## Monitoring

- View edge function logs: `supabase functions logs <function-name>`
- Monitor storage usage in Supabase Dashboard
- Check database queries in Studio SQL Editor

## Troubleshooting

### Common Issues

**Animation timeout**:
- Animations may take 3-6 minutes to generate
- Check pending status in animations table
- Verify fal.ai API key is valid

**Upload failures**:
- Ensure file size is under 50MiB
- Check user_id matches authenticated user
- Verify storage bucket exists

**Permission errors**:
- Confirm RLS policies are enabled
- Check JWT token is valid
- Verify user has correct permissions

## Contributing

This is a development project. For questions or issues, please reach out to the project maintainer.

## Related Documentation

- [BACKEND_SETUP.md](BACKEND_SETUP.md) - Detailed setup instructions with code examples
- [Supabase Documentation](https://supabase.com/docs)
- [Deno Documentation](https://deno.land/manual)
- [fal.ai Documentation](https://fal.ai/docs)

## License

This project is in active development.

---

**Memory Capsule** - Transform your photos into living memories
