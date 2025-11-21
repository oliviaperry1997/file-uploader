const express = require("express");
const multer = require("multer");
const path = require("path");
const { validationResult } = require('express-validator');
const { PrismaClient } = require("../generated/prisma");
const { ensureAuthenticated } = require('../middleware/auth');
const { validateFileUpload, validateFolderAssignment, handleValidationErrors } = require('../middleware/validation');
const { generateStoragePath, uploadFile, downloadFile, deleteFile, createSignedUrl } = require('../config/supabase');

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for memory storage (files will be uploaded to Supabase)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: function (req, file, cb) {
        // Allow common file types
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|mp4|mov|avi|mp3|wav/;
        const extname = allowedTypes.test(
            path.extname(file.originalname).toLowerCase()
        );
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error("Only specific file types are allowed!"));
        }
    },
});



// GET /files - List all files for the current user
router.get("/", ensureAuthenticated, async (req, res) => {
    try {
        const files = await prisma.file.findMany({
            where: {
                userId: req.user.id,
            },
            include: {
                folder: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: {
                uploadedAt: "desc",
            },
        });

        res.render("files/index", {
            title: "My Files",
            files,
            user: req.user,
        });
    } catch (error) {
        console.error("Error fetching files:", error);
        res.status(500).render("error", { error, title: "Error" });
    }
});

// GET /files/upload - Show upload form
router.get("/upload", ensureAuthenticated, async (req, res) => {
    try {
        // Get all folders for folder selection
        const folders = await prisma.folder.findMany({
            where: { userId: req.user.id },
            orderBy: { name: 'asc' }
        });

        res.render("files/upload", {
            title: "Upload File",
            folders,
            selectedFolderId: req.query.folder || null
        });
    } catch (error) {
        console.error('Error loading upload form:', error);
        res.render("files/upload", {
            title: "Upload File",
            folders: [],
            selectedFolderId: null
        });
    }
});

// POST /files/upload - Handle file upload
router.post(
    "/upload",
    ensureAuthenticated,
    upload.single("file"),
    validateFileUpload,
    async (req, res) => {
        try {
            // Handle validation errors with custom logic for file uploads
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                // No need to delete file since we're using memory storage with Supabase
                // File buffer is automatically cleaned up when request ends
                
                // Add errors to flash messages
                errors.array().forEach(error => {
                    req.flash('error', error.msg);
                });
                
                return res.redirect('/files/upload');
            }

            if (!req.file) {
                req.flash('error', 'No file uploaded');
                return res.redirect('/files/upload');
            }

            // Validate folder ownership if folderId is provided
            let folderId = req.body.folderId || null;
            if (folderId) {
                const folder = await prisma.folder.findFirst({
                    where: {
                        id: folderId,
                        userId: req.user.id
                    }
                });
                if (!folder) {
                    folderId = null; // Reset if folder doesn't exist or doesn't belong to user
                }
            }

            // Generate storage path for Supabase
            const storagePath = generateStoragePath(req.user.id, folderId, req.file.originalname);

            // Upload file to Supabase Storage
            const { data: uploadData, error: uploadError } = await uploadFile(
                req.file.buffer,
                storagePath,
                req.file.mimetype
            );

            if (uploadError) {
                console.error("Error uploading to Supabase:", uploadError);
                console.error("Upload error details:", JSON.stringify(uploadError, null, 2));
                req.flash('error', `Failed to upload file to storage: ${uploadError.message || 'Unknown error'}`);
                return res.redirect('/files/upload');
            }

            // Save file info to database
            const file = await prisma.file.create({
                data: {
                    filename: storagePath.split('/').pop(), // Extract filename from path
                    originalName: req.file.originalname,
                    mimeType: req.file.mimetype,
                    size: req.file.size,
                    storagePath: storagePath,
                    description: req.body.description || null,
                    isPublic: req.body.isPublic === "true",
                    userId: req.user.id,
                    folderId: folderId,
                },
            });

            req.flash('success', 'File uploaded successfully!');
            res.redirect("/files");
        } catch (error) {
            console.error("Error uploading file:", error);
            console.error("Full error stack:", error.stack);
            req.flash('error', `An error occurred during file upload: ${error.message}`);
            res.redirect('/files/upload');
        }
    }
);

// GET /files/:id/download - Download a file
router.get("/:id/download", ensureAuthenticated, async (req, res) => {
    try {
        const file = await prisma.file.findFirst({
            where: {
                id: req.params.id,
                OR: [{ userId: req.user.id }, { isPublic: true }],
            },
        });

        if (!file) {
            return res.status(404).render("404", { title: "File Not Found" });
        }

        // Use storagePath if available, otherwise fall back to legacy path
        const pathToUse = file.storagePath || file.path;
        
        if (file.storagePath) {
            // Download from Supabase
            const { data: fileData, error: downloadError } = await downloadFile(pathToUse);
            
            if (downloadError || !fileData) {
                console.error("Error downloading from Supabase:", downloadError);
                return res.status(500).render("error", { 
                    error: new Error("Failed to download file"), 
                    title: "Error" 
                });
            }
            
            // Convert blob to buffer and send
            const buffer = Buffer.from(await fileData.arrayBuffer());
            res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
            res.setHeader('Content-Type', file.mimeType);
            res.setHeader('Content-Length', buffer.length);
            res.send(buffer);
        } else {
            // Legacy: download from local filesystem (for backward compatibility)
            res.download(file.path, file.originalName);
        }
    } catch (error) {
        console.error("Error downloading file:", error);
        res.status(500).render("error", { error, title: "Error" });
    }
});

// DELETE /files/:id - Delete a file
router.delete("/:id", ensureAuthenticated, async (req, res) => {
    try {
        const file = await prisma.file.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id,
            },
        });

        if (!file) {
            return res.status(404).json({ error: "File not found" });
        }

        // Delete file from storage
        const pathToUse = file.storagePath || file.path;
        
        if (file.storagePath) {
            // Delete from Supabase
            const { error: deleteError } = await deleteFile(pathToUse);
            if (deleteError) {
                console.error("Error deleting file from Supabase:", deleteError);
                // Continue with database deletion even if storage deletion fails
            }
        } else {
            // Legacy: delete from local filesystem
            try {
                const fs = require('fs').promises;
                await fs.unlink(file.path);
            } catch (fsError) {
                console.error("Error deleting file from filesystem:", fsError);
            }
        }

        // Delete file record from database
        await prisma.file.delete({
            where: { id: req.params.id },
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Error deleting file:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET /files/:id - Show file info page
router.get("/:id", ensureAuthenticated, async (req, res) => {
    try {
        const file = await prisma.file.findFirst({
            where: {
                id: req.params.id,
                OR: [{ userId: req.user.id }, { isPublic: true }],
            },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                },
                folder: {
                    select: {
                        id: true,
                        name: true,
                        parent: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            }
        });

        if (!file) {
            return res.status(404).render("404", { title: "File Not Found" });
        }

        // Get all folders for folder assignment (only if user owns the file)
        let folders = [];
        if (file.userId === req.user.id) {
            folders = await prisma.folder.findMany({
                where: { userId: req.user.id },
                orderBy: { name: 'asc' }
            });
        }

        res.render("files/info", {
            title: file.originalName,
            file,
            folders,
            user: req.user,
            canEdit: file.userId === req.user.id
        });
    } catch (error) {
        console.error("Error fetching file info:", error);
        res.status(500).render("error", { error, title: "Error" });
    }
});

// POST /files/:id/assign-folder - Update file's folder assignment
router.post("/:id/assign-folder", ensureAuthenticated, validateFolderAssignment, handleValidationErrors, async (req, res) => {
    console.log('POST /files/:id/assign-folder route hit:', { fileId: req.params.id, folderId: req.body.folderId });
    try {
        const { folderId } = req.body;

        const file = await prisma.file.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id,
            },
        });

        if (!file) {
            req.flash('error', 'File not found');
            return res.redirect('/files');
        }

        // Validate folder ownership if folderId is provided
        let validatedFolderId = null;
        if (folderId && folderId !== '') {
            const folder = await prisma.folder.findFirst({
                where: {
                    id: folderId,
                    userId: req.user.id
                }
            });
            if (folder) {
                validatedFolderId = folderId;
            } else {
                req.flash('error', 'Selected folder not found');
                return res.redirect(`/files/${req.params.id}`);
            }
        }

        // Update file's folder assignment
        await prisma.file.update({
            where: { id: req.params.id },
            data: { folderId: validatedFolderId }
        });

        req.flash('success', 'File moved successfully');
        const redirectUrl = `/files/${req.params.id}`;
        console.log('Redirecting to:', redirectUrl);
        res.redirect(redirectUrl);
    } catch (error) {
        console.error("Error updating file folder:", error);
        req.flash('error', 'Unable to move file');
        res.redirect(`/files/${req.params.id}`);
    }
});

// GET /files/:id/preview - Get file preview URL (for images, etc.)
router.get("/:id/preview", ensureAuthenticated, async (req, res) => {
    try {
        const file = await prisma.file.findFirst({
            where: {
                id: req.params.id,
                OR: [{ userId: req.user.id }, { isPublic: true }],
            },
        });

        if (!file) {
            return res.status(404).json({ error: "File not found" });
        }

        if (file.storagePath) {
            // Create a signed URL for Supabase files (valid for 1 hour)
            const { data: signedUrl, error } = await createSignedUrl(file.storagePath, 3600);
            
            if (error || !signedUrl) {
                console.error("Error creating signed URL:", error);
                return res.status(500).json({ error: "Failed to create preview URL" });
            }
            
            return res.json({ url: signedUrl.signedUrl });
        } else {
            // Legacy: return download URL for local files
            return res.json({ url: `/files/${file.id}/download` });
        }
    } catch (error) {
        console.error("Error creating preview URL:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;
