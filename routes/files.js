const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const { PrismaClient } = require("../generated/prisma");
const { body, validationResult } = require("express-validator");

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

// Middleware to check if user is logged in
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect("/users/login");
    }
    next();
};

// GET /files - List all files for the current user
router.get("/", requireAuth, async (req, res) => {
    try {
        const files = await prisma.file.findMany({
            where: {
                userId: req.session.user.id,
            },
            orderBy: {
                uploadedAt: "desc",
            },
        });

        res.render("files/index", {
            title: "My Files",
            files,
            user: req.session.user,
        });
    } catch (error) {
        console.error("Error fetching files:", error);
        res.status(500).render("error", { error, title: "Error" });
    }
});

// GET /files/upload - Show upload form
router.get("/upload", requireAuth, (req, res) => {
    res.render("files/upload", {
        title: "Upload File",
        user: req.session.user,
    });
});

// POST /files/upload - Handle file upload
router.post(
    "/upload",
    requireAuth,
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
                    user: req.session.user,
                });
            }

            if (!req.file) {
                return res.status(400).render("files/upload", {
                    title: "Upload File",
                    errors: [{ msg: "No file uploaded" }],
                    user: req.session.user,
                });
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
                    userId: req.session.user.id,
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
router.get("/:id/download", requireAuth, async (req, res) => {
    try {
        const file = await prisma.file.findFirst({
            where: {
                id: req.params.id,
                OR: [{ userId: req.session.user.id }, { isPublic: true }],
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
router.delete("/:id", requireAuth, async (req, res) => {
    try {
        const file = await prisma.file.findFirst({
            where: {
                id: req.params.id,
                userId: req.session.user.id,
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

module.exports = router;
