# Supabase Migration Guide

## 🚀 Complete Migration to Supabase Database

Your application is now configured to use Supabase as the primary database with optimized connection pooling and separate storage buckets.

### ✅ What's Been Updated

1. **Prisma Schema**:
   - Added `directUrl` for migration operations
   - Updated File model with `bucketName` field for multi-bucket support
   - Made `storagePath` required (no more local file paths)

2. **Environment Configuration**:
   - Updated `.env.example` with Supabase connection strings
   - Added connection pooling configuration (PgBouncer on port 6543)
   - Configured separate buckets for files and folders

3. **Storage Architecture**:
   - `files` bucket: For all user-uploaded files
   - `folders` bucket: For folder-related assets (future use)

### 🔧 Setup Instructions

#### Step 1: Get Your Supabase Database Password

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `iplcmooxnukulqzhnyvf`
3. Navigate to **Settings** → **Database**
4. Find your database password (you set this when creating the project)

#### Step 2: Update Your .env File

Replace `[PASSWORD]` in your `.env` file with your actual database password:

```env
DATABASE_URL="postgresql://postgres.iplcmooxnukulqzhnyvf:YOUR_ACTUAL_PASSWORD@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.iplcmooxnukulqzhnyvf:YOUR_ACTUAL_PASSWORD@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
```

#### Step 3: Create Storage Buckets

1. In Supabase Dashboard, go to **Storage**
2. Create two buckets:
   - **files** (public if you want public file access)
   - **folders** (for future folder thumbnails/assets)

**Bucket Creation Commands:**
```sql
-- In Supabase SQL Editor, run:
INSERT INTO storage.buckets (id, name, public) VALUES 
('files', 'files', true),
('folders', 'folders', false);
```

#### Step 4: Run Database Migration

```bash
# Generate the Prisma client
npm run db:generate

# Deploy the migration to Supabase
npx prisma migrate deploy

# Or if you want to create a new migration:
npx prisma migrate dev --name migrate-to-supabase
```

#### Step 5: Verify Connection

```bash
# Test the database connection
npx prisma db pull

# Open Prisma Studio to verify tables
npx prisma studio
```

### 🏗️ Architecture Benefits

#### Connection Pooling (PgBouncer)
- **Performance**: Reuses database connections efficiently
- **Scalability**: Handles more concurrent users
- **Reliability**: Better connection management
- **Free**: Included with Supabase

#### Dual Connection Strategy
- **DATABASE_URL** (port 6543): Pooled connections for app operations
- **DIRECT_URL** (port 5432): Direct connections for migrations
- **Best Practice**: Recommended by Prisma for production apps

#### Storage Separation
- **files bucket**: User uploads, documents, images
- **folders bucket**: Future folder thumbnails, metadata
- **Scalable**: Easy to add more buckets for different content types

### 🔒 Security Considerations

#### Row Level Security (Optional)
Enable RLS in Supabase for additional security:

```sql
-- Enable RLS on files table
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Create policy for users to see only their files
CREATE POLICY "Users can only see their own files" ON files
FOR ALL USING (auth.uid()::text = user_id);
```

#### Environment Variables Security
- Never commit actual passwords to git
- Use your hosting platform's environment variable system in production
- Keep `SUPABASE_SERVICE_ROLE_KEY` secure (it has admin access)

### 🚨 Important Next Steps

1. **Update your .env** with the actual database password
2. **Run the migration** to create tables in Supabase
3. **Create storage buckets** in Supabase dashboard
4. **Test the connection** with `npx prisma studio`
5. **Migrate existing files** (if any) from local storage to Supabase Storage

### 📋 Migration Checklist

- [ ] Got database password from Supabase
- [ ] Updated .env with actual password
- [ ] Created `files` and `folders` storage buckets
- [ ] Ran `npx prisma migrate deploy`
- [ ] Verified connection with `npx prisma studio`
- [ ] Tested file upload functionality
- [ ] Updated any hardcoded local file paths in code

### 🆘 Troubleshooting

**Connection Issues:**
```bash
# Test direct connection
npx prisma db pull --schema=prisma/schema.prisma

# Check if buckets exist
# In Supabase SQL Editor:
SELECT * FROM storage.buckets;
```

**Migration Issues:**
```bash
# Reset migrations (careful in production!)
npx prisma migrate reset

# Apply specific migration
npx prisma migrate deploy --schema=prisma/schema.prisma
```

**File Upload Issues:**
- Verify bucket names match your environment variables
- Check bucket permissions (public vs private)
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is correct

### 🎯 What's Next

After migration is complete, your app will:
- ✅ Use Supabase PostgreSQL with optimal connection pooling
- ✅ Store sessions in the database (no external session store needed)
- ✅ Support separate storage buckets for different file types
- ✅ Be ready for production deployment
- ✅ Scale efficiently with Supabase's infrastructure

Your file uploader is now fully cloud-native! 🌟