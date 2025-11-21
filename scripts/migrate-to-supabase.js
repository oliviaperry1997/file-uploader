const { PrismaClient } = require('./generated/prisma');
const { generateStoragePath, uploadFile } = require('./config/supabase');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

async function migrateFilesToSupabase() {
    console.log('Starting migration of existing files to Supabase...');
    
    try {
        // Get all files that don't have a storagePath yet
        const files = await prisma.file.findMany({
            where: {
                storagePath: null
            },
            include: {
                user: true
            }
        });

        console.log(`Found ${files.length} files to migrate`);

        for (const file of files) {
            try {
                console.log(`Migrating file: ${file.originalName}`);
                
                // Check if local file exists
                const localPath = file.path;
                try {
                    await fs.access(localPath);
                } catch (error) {
                    console.log(`Local file not found, skipping: ${localPath}`);
                    continue;
                }

                // Read the local file
                const fileBuffer = await fs.readFile(localPath);
                
                // Generate new storage path
                const storagePath = generateStoragePath(file.userId, file.folderId, file.originalName);
                
                // Upload to Supabase
                const { data, error } = await uploadFile(fileBuffer, storagePath, file.mimeType);
                
                if (error) {
                    console.error(`Failed to upload ${file.originalName}:`, error);
                    continue;
                }
                
                // Update database with new storage path
                await prisma.file.update({
                    where: { id: file.id },
                    data: { storagePath: storagePath }
                });
                
                console.log(`✓ Successfully migrated: ${file.originalName}`);
                
                // Optional: Delete local file after successful upload
                // Uncomment the next line if you want to clean up local files
                // await fs.unlink(localPath);
                
            } catch (fileError) {
                console.error(`Error migrating file ${file.originalName}:`, fileError);
            }
        }
        
        console.log('Migration completed!');
        
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run migration if this script is executed directly
if (require.main === module) {
    migrateFilesToSupabase()
        .then(() => {
            console.log('Migration script finished');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateFilesToSupabase };