const express = require('express');
const session = require('express-session');
const { PrismaSessionStore } = require('@quixo3/prisma-session-store');
const { PrismaClient } = require('./generated/prisma');
const expressLayouts = require('express-ejs-layouts');
const passport = require('./config/passport');
const flash = require('connect-flash');
const { makeUserAvailable } = require('./middleware/auth');
const methodOverride = require('method-override');
const path = require('path');
const fs = require('fs');

const fileRoutes = require("./routes/files");
const userRoutes = require("./routes/users");
const folderRoutes = require("./routes/folders");

const app = express();
const prisma = new PrismaClient();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, "public")));

// Session configuration
app.use(
    session({
        cookie: {
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        },
        secret: process.env.SESSION_SECRET || "your-secret-key",
        resave: false,
        saveUninitialized: false,
        store: new PrismaSessionStore(prisma, {
            checkPeriod: 2 * 60 * 1000, // 2 minutes
            dbRecordIdIsSessionId: true,
            dbRecordIdFunction: undefined,
        }),
    })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Flash messages
app.use(flash());

// Make user available in templates
app.use(makeUserAvailable);

// Flash messages middleware
app.use((req, res, next) => {
    const successMessages = req.flash('success');
    const errorMessages = req.flash('error');
    const validationErrors = req.flash('errors');
    
    res.locals.success_msg = successMessages;
    res.locals.error_msg = errorMessages;
    res.locals.error = errorMessages;
    res.locals.errors = validationErrors;
    next();
});

// Routes
app.use("/files", fileRoutes);
app.use("/users", userRoutes);
app.use("/folders", folderRoutes);

// Public share route (no authentication required)
app.get("/share/:token", async (req, res) => {
    try {
        const { token } = req.params;
        const { isExpired } = require('./utils/duration');
        
        // Find the shared folder
        const sharedFolder = await prisma.sharedFolder.findUnique({
            where: { token },
            include: {
                folder: {
                    include: {
                        files: {
                            orderBy: { uploadedAt: 'desc' }
                        },
                        children: {
                            include: {
                                _count: {
                                    select: {
                                        files: true,
                                        children: true
                                    }
                                }
                            }
                        },
                        user: {
                            select: {
                                name: true,
                                email: true
                            }
                        }
                    }
                }
            }
        });
        
        if (!sharedFolder) {
            return res.status(404).render('error', {
                title: 'Share Not Found',
                error: { message: 'This share link does not exist or has been removed.' }
            });
        }
        
        // Check if expired
        if (isExpired(sharedFolder.expiresAt)) {
            return res.status(410).render('error', {
                title: 'Share Expired',
                error: { message: 'This share link has expired.' }
            });
        }
        
        res.render('share/folder', {
            title: `Shared Folder: ${sharedFolder.folder.name}`,
            sharedFolder,
            folder: sharedFolder.folder,
            files: sharedFolder.folder.files,
            subfolders: sharedFolder.folder.children,
            currentPath: [], // Root level of shared folder
            shareToken: token
        });
    } catch (error) {
        console.error('Error accessing shared folder:', error);
        res.status(500).render('error', {
            title: 'Error',
            error: { message: 'Unable to access shared folder.' }
        });
    }
});

// Route for accessing subfolders within a shared folder
app.get("/share/:token/folder/:folderId", async (req, res) => {
    try {
        const { token, folderId } = req.params;
        const { isExpired } = require('./utils/duration');
        
        // Find the shared folder
        const sharedFolder = await prisma.sharedFolder.findUnique({
            where: { token },
            include: {
                folder: true
            }
        });
        
        if (!sharedFolder) {
            return res.status(404).render('error', {
                title: 'Share Not Found',
                error: { message: 'This share link does not exist or has been removed.' }
            });
        }
        
        // Check if expired
        if (isExpired(sharedFolder.expiresAt)) {
            return res.status(410).render('error', {
                title: 'Share Expired',
                error: { message: 'This share link has expired.' }
            });
        }
        
        // Find the requested subfolder and verify it's within the shared folder hierarchy
        const requestedFolder = await prisma.folder.findUnique({
            where: { id: folderId },
            include: {
                files: {
                    orderBy: { uploadedAt: 'desc' }
                },
                children: {
                    include: {
                        _count: {
                            select: {
                                files: true,
                                children: true
                            }
                        }
                    }
                },
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        });
        
        if (!requestedFolder) {
            return res.status(404).render('error', {
                title: 'Folder Not Found',
                error: { message: 'The requested folder was not found.' }
            });
        }
        
        // Verify this folder is within the shared folder's hierarchy
        const isWithinSharedFolder = await verifyFolderInHierarchy(folderId, sharedFolder.folder.id);
        if (!isWithinSharedFolder) {
            return res.status(403).render('error', {
                title: 'Access Denied',
                error: { message: 'This folder is not part of the shared folder.' }
            });
        }
        
        // Build breadcrumb path
        const currentPath = await buildFolderPath(folderId, sharedFolder.folder.id);
        
        res.render('share/folder', {
            title: `Shared Folder: ${requestedFolder.name}`,
            sharedFolder,
            folder: requestedFolder,
            files: requestedFolder.files,
            subfolders: requestedFolder.children,
            currentPath,
            shareToken: token
        });
    } catch (error) {
        console.error('Error accessing shared subfolder:', error);
        res.status(500).render('error', {
            title: 'Error',
            error: { message: 'Unable to access shared folder.' }
        });
    }
});

// Helper function to verify a folder is within a shared folder's hierarchy
async function verifyFolderInHierarchy(folderId, rootFolderId) {
    if (folderId === rootFolderId) return true;
    
    const folder = await prisma.folder.findUnique({
        where: { id: folderId },
        select: { parentId: true }
    });
    
    if (!folder || !folder.parentId) return false;
    
    return await verifyFolderInHierarchy(folder.parentId, rootFolderId);
}

// Helper function to build folder breadcrumb path
async function buildFolderPath(folderId, rootFolderId) {
    const path = [];
    let currentId = folderId;
    
    while (currentId && currentId !== rootFolderId) {
        const folder = await prisma.folder.findUnique({
            where: { id: currentId },
            select: { id: true, name: true, parentId: true }
        });
        
        if (!folder) break;
        
        path.unshift({ id: folder.id, name: folder.name });
        currentId = folder.parentId;
    }
    
    return path;
}

// Home route
app.get("/", (req, res) => {
    res.render("index", {
        title: "File Uploader"
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render("error", {
        error: err,
        title: "Error",
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render("404", {
        title: "Page Not Found",
    });
});

module.exports = app;
