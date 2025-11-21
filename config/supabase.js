const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for server-side operations

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase URL:', supabaseUrl ? 'Present' : 'Missing');
    console.error('Supabase Service Key:', supabaseServiceKey ? 'Present' : 'Missing');
    throw new Error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
}

// Storage bucket name
const STORAGE_BUCKET = 'user-files';

console.log('Supabase initialized:', {
    url: supabaseUrl,
    keyPresent: !!supabaseServiceKey,
    bucket: STORAGE_BUCKET
});

// Create Supabase client with service role key for full access
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

/**
 * Generate a file path for Supabase storage
 * @param {string} userId - User ID
 * @param {string|null} folderId - Folder ID (optional)
 * @param {string} filename - Original filename
 * @returns {string} Storage path
 */
const generateStoragePath = (userId, folderId, filename) => {
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    const uniqueFilename = `${timestamp}-${sanitizedFilename}`;
    
    if (folderId) {
        return `${userId}/folders/${folderId}/${uniqueFilename}`;
    }
    return `${userId}/root/${uniqueFilename}`;
};

/**
 * Upload file to Supabase storage
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} storagePath - Storage path
 * @param {string} mimeType - File MIME type
 * @returns {Promise<{data, error}>}
 */
const uploadFile = async (fileBuffer, storagePath, mimeType) => {
    try {
        console.log('uploadFile called with:', {
            bufferSize: fileBuffer?.length,
            storagePath,
            mimeType,
            bucket: STORAGE_BUCKET
        });
        
        const { data, error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(storagePath, fileBuffer, {
                contentType: mimeType,
                duplex: 'half'
            });

        console.log('Supabase storage response:', { data, error });
        return { data, error };
    } catch (error) {
        console.error('Error uploading file to Supabase:', error);
        console.error('Error stack:', error.stack);
        return { data: null, error };
    }
};

/**
 * Download file from Supabase storage
 * @param {string} storagePath - Storage path
 * @returns {Promise<{data, error}>}
 */
const downloadFile = async (storagePath) => {
    try {
        const { data, error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .download(storagePath);

        return { data, error };
    } catch (error) {
        console.error('Error downloading file from Supabase:', error);
        return { data: null, error };
    }
};

/**
 * Delete file from Supabase storage
 * @param {string} storagePath - Storage path
 * @returns {Promise<{data, error}>}
 */
const deleteFile = async (storagePath) => {
    try {
        const { data, error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .remove([storagePath]);

        return { data, error };
    } catch (error) {
        console.error('Error deleting file from Supabase:', error);
        return { data: null, error };
    }
};

/**
 * Get public URL for a file
 * @param {string} storagePath - Storage path
 * @returns {string} Public URL
 */
const getPublicUrl = (storagePath) => {
    const { data } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(storagePath);
    
    return data.publicUrl;
};

/**
 * Create signed URL for private file access
 * @param {string} storagePath - Storage path
 * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns {Promise<{data, error}>}
 */
const createSignedUrl = async (storagePath, expiresIn = 3600) => {
    try {
        const { data, error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(storagePath, expiresIn);

        return { data, error };
    } catch (error) {
        console.error('Error creating signed URL:', error);
        return { data: null, error };
    }
};

module.exports = {
    supabase,
    STORAGE_BUCKET,
    generateStoragePath,
    uploadFile,
    downloadFile,
    deleteFile,
    getPublicUrl,
    createSignedUrl
};