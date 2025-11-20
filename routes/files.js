const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const { PrismaClient } = require("../generated/prisma");
const { body, validationResult } = require("express-validator");
const { ensureAuthenticated } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(
            null,
            file.fieldname +
                "-" +
                uniqueSuffix +
                path.extname(file.originalname)
        );
    },
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: function (req, file, cb) {
        // Allow common file types
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip/;
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
    [
        body("description")
            .optional()
            .isLength({ max: 500 })
            .withMessage("Description must be less than 500 characters"),
        body("isPublic")
            .optional()
            .isBoolean()
            .withMessage("Invalid public setting"),
        body("folderId")
            .optional()
            .isUUID()
            .withMessage("Invalid folder selection"),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                // Delete uploaded file if validation fails
                if (req.file) {
                    await fs.unlink(req.file.path);
                }
                return res.status(400).render("files/upload", {
                    title: "Upload File",
                    errors: errors.array(),
                    user: req.user,
                });
            }

            if (!req.file) {
                return res.status(400).render("files/upload", {
                    title: "Upload File",
                    errors: [{ msg: "No file uploaded" }],
                    user: req.user,
                });
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

            // Save file info to database
            const file = await prisma.file.create({
                data: {
                    filename: req.file.filename,
                    originalName: req.file.originalname,
                    mimeType: req.file.mimetype,
                    size: req.file.size,
                    path: req.file.path,
                    description: req.body.description || null,
                    isPublic: req.body.isPublic === "true",
                    userId: req.user.id,
                    folderId: folderId,
                },
            });

            res.redirect("/files");
        } catch (error) {
            console.error("Error uploading file:", error);
            // Delete uploaded file if database save fails
            if (req.file) {
                try {
                    await fs.unlink(req.file.path);
                } catch (unlinkError) {
                    console.error("Error deleting file:", unlinkError);
                }
            }
            res.status(500).render("error", { error, title: "Error" });
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

        res.download(file.path, file.originalName);
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

        // Delete file from filesystem
        try {
            await fs.unlink(file.path);
        } catch (fsError) {
            console.error("Error deleting file from filesystem:", fsError);
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

// PUT /files/:id/folder - Update file's folder assignment
router.put("/:id/folder", ensureAuthenticated, async (req, res) => {
    try {
        const { folderId } = req.body;

        const file = await prisma.file.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id,
            },
        });

        if (!file) {
            return res.status(404).json({ error: "File not found" });
        }

        // Validate folder ownership if folderId is provided
        let validatedFolderId = null;
        if (folderId) {
            const folder = await prisma.folder.findFirst({
                where: {
                    id: folderId,
                    userId: req.user.id
                }
            });
            if (folder) {
                validatedFolderId = folderId;
            }
        }

        // Update file's folder assignment
        await prisma.file.update({
            where: { id: req.params.id },
            data: { folderId: validatedFolderId }
        });

        req.flash('success', 'File folder updated successfully');
        res.redirect(`/files/${req.params.id}`);
    } catch (error) {
        console.error("Error updating file folder:", error);
        req.flash('error', 'Unable to update file folder');
        res.redirect(`/files/${req.params.id}`);
    }
});

module.exports = router;
