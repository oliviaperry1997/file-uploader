const express = require('express');
const { PrismaClient } = require('../generated/prisma');
const { ensureAuthenticated } = require('../middleware/auth');
const { validateFolder, handleValidationErrors } = require('../middleware/validation');
const router = express.Router();
const prisma = new PrismaClient();

// GET /folders - List all folders for the current user
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const folders = await prisma.folder.findMany({
            where: { 
                userId: req.user.id,
                parentId: req.query.parent || null // Show root folders by default
            },
            include: {
                children: true,
                files: {
                    select: {
                        id: true,
                        filename: true,
                        originalName: true,
                        size: true,
                        uploadedAt: true
                    }
                },
                _count: {
                    select: {
                        files: true,
                        children: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        // Get current folder info if we're in a subfolder
        let currentFolder = null;
        if (req.query.parent) {
            currentFolder = await prisma.folder.findFirst({
                where: {
                    id: req.query.parent,
                    userId: req.user.id
                },
                include: {
                    parent: true
                }
            });
        }

        res.render('folders/index', {
            title: 'Folders',
            folders,
            currentFolder,
            user: req.user
        });
    } catch (error) {
        console.error('Error fetching folders:', error);
        req.flash('error', 'Unable to load folders');
        res.redirect('/files');
    }
});

// GET /folders/new - Show create folder form
router.get('/new', ensureAuthenticated, async (req, res) => {
    try {
        // Get all folders for parent selection
        const allFolders = await prisma.folder.findMany({
            where: { userId: req.user.id },
            orderBy: { name: 'asc' }
        });

        res.render('folders/new', {
            title: 'Create Folder',
            allFolders,
            parentId: req.query.parent || null,
            user: req.user
        });
    } catch (error) {
        console.error('Error loading create folder form:', error);
        req.flash('error', 'Unable to load create folder form');
        res.redirect('/folders');
    }
});

// POST /folders - Create a new folder
router.post('/', ensureAuthenticated, validateFolder, handleValidationErrors, async (req, res) => {
    try {
        const { name, description, parentId } = req.body;

        // Check if folder with same name exists in the same parent
        const existingFolder = await prisma.folder.findFirst({
            where: {
                name: name.trim(),
                userId: req.user.id,
                parentId: parentId || null
            }
        });

        if (existingFolder) {
            req.flash('error', 'A folder with this name already exists in this location');
            return res.redirect('/folders/new');
        }

        const folder = await prisma.folder.create({
            data: {
                name: name.trim(),
                description: description?.trim() || null,
                userId: req.user.id,
                parentId: parentId || null
            }
        });

        req.flash('success', 'Folder created successfully');
        
        // Redirect to parent folder or root
        const redirectPath = parentId ? `/folders?parent=${parentId}` : '/folders';
        res.redirect(redirectPath);
    } catch (error) {
        console.error('Error creating folder:', error);
        req.flash('error', 'Unable to create folder');
        res.redirect('/folders/new');
    }
});

// GET /folders/:id/edit - Show edit folder form
router.get('/:id/edit', ensureAuthenticated, async (req, res) => {
    try {
        const folder = await prisma.folder.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            },
            include: {
                parent: true
            }
        });

        if (!folder) {
            req.flash('error', 'Folder not found');
            return res.redirect('/folders');
        }

        // Get all folders for parent selection (excluding self and descendants)
        const allFolders = await prisma.folder.findMany({
            where: { 
                userId: req.user.id,
                id: { not: req.params.id } // Exclude self
            },
            orderBy: { name: 'asc' }
        });

        res.render('folders/edit', {
            title: 'Edit Folder',
            folder,
            allFolders,
            user: req.user
        });
    } catch (error) {
        console.error('Error loading edit folder form:', error);
        req.flash('error', 'Unable to load edit folder form');
        res.redirect('/folders');
    }
});

// PUT /folders/:id - Update folder
router.put('/:id', ensureAuthenticated, validateFolder, handleValidationErrors, async (req, res) => {
    try {
        const { name, description, parentId } = req.body;

        const folder = await prisma.folder.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!folder) {
            req.flash('error', 'Folder not found');
            return res.redirect('/folders');
        }

        // Check if folder with same name exists in the same parent (excluding current folder)
        const existingFolder = await prisma.folder.findFirst({
            where: {
                name: name.trim(),
                userId: req.user.id,
                parentId: parentId || null,
                id: { not: req.params.id }
            }
        });

        if (existingFolder) {
            req.flash('error', 'A folder with this name already exists in this location');
            return res.redirect(`/folders/${req.params.id}/edit`);
        }

        await prisma.folder.update({
            where: { id: req.params.id },
            data: {
                name: name.trim(),
                description: description?.trim() || null,
                parentId: parentId || null
            }
        });

        req.flash('success', 'Folder updated successfully');
        
        // Redirect to parent folder or root
        const redirectPath = parentId ? `/folders?parent=${parentId}` : '/folders';
        res.redirect(redirectPath);
    } catch (error) {
        console.error('Error updating folder:', error);
        req.flash('error', 'Unable to update folder');
        res.redirect(`/folders/${req.params.id}/edit`);
    }
});

// DELETE /folders/:id - Delete folder
router.delete('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const folder = await prisma.folder.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            },
            include: {
                children: true,
                files: true
            }
        });

        if (!folder) {
            req.flash('error', 'Folder not found');
            return res.redirect('/folders');
        }

        // Check if folder has children or files
        if (folder.children.length > 0 || folder.files.length > 0) {
            req.flash('error', 'Cannot delete folder that contains files or subfolders');
            return res.redirect('/folders');
        }

        await prisma.folder.delete({
            where: { id: req.params.id }
        });

        req.flash('success', 'Folder deleted successfully');
        
        // Redirect to parent folder or root
        const redirectPath = folder.parentId ? `/folders?parent=${folder.parentId}` : '/folders';
        res.redirect(redirectPath);
    } catch (error) {
        console.error('Error deleting folder:', error);
        req.flash('error', 'Unable to delete folder');
        res.redirect('/folders');
    }
});

module.exports = router;