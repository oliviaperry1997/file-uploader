const { body, validationResult } = require('express-validator');

// Validation rules for user registration
const validateRegister = [
    body('name')
        .trim()
        .escape()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Name can only contain letters and spaces'),
    
    body('email')
        .trim()
        .normalizeEmail()
        .isEmail()
        .withMessage('Please provide a valid email address')
        .isLength({ max: 100 })
        .withMessage('Email must be less than 100 characters'),
    
    body('password')
        .isLength({ min: 6, max: 128 })
        .withMessage('Password must be between 6 and 128 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Passwords do not match');
            }
            return true;
        })
];

// Validation rules for user login
const validateLogin = [
    body('email')
        .trim()
        .normalizeEmail()
        .isEmail()
        .withMessage('Please provide a valid email address')
        .isLength({ max: 100 })
        .withMessage('Email must be less than 100 characters'),
    
    body('password')
        .isLength({ min: 1, max: 128 })
        .withMessage('Password is required')
];

// Validation rules for file upload
const validateFileUpload = [
    body('description')
        .optional()
        .trim()
        .escape()
        .isLength({ max: 500 })
        .withMessage('Description must be less than 500 characters'),
    
    body('isPublic')
        .optional()
        .isBoolean()
        .withMessage('Invalid public setting'),
    
    body('folderId')
        .optional()
        .isUUID()
        .withMessage('Invalid folder selection')
];

// Validation rules for folder operations
const validateFolder = [
    body('name')
        .trim()
        .escape()
        .isLength({ min: 1, max: 100 })
        .withMessage('Folder name must be between 1 and 100 characters')
        .matches(/^[a-zA-Z0-9\s\-_\.]+$/)
        .withMessage('Folder name can only contain letters, numbers, spaces, hyphens, underscores, and periods'),
    
    body('description')
        .optional()
        .trim()
        .escape()
        .isLength({ max: 500 })
        .withMessage('Description must be less than 500 characters'),
    
    body('parentId')
        .optional()
        .isUUID()
        .withMessage('Invalid parent folder selection')
];

// Validation rules for folder assignment
const validateFolderAssignment = [
    body('folderId')
        .optional()
        .isUUID()
        .withMessage('Invalid folder selection')
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Add errors to flash messages
        errors.array().forEach(error => {
            req.flash('error', error.msg);
        });
        
        // Store the validation errors in req for template rendering
        req.validationErrors = errors.array();
        return next('validation_error');
    }
    next();
};

// Error handler specifically for validation errors
const validationErrorHandler = (err, req, res, next) => {
    if (err === 'validation_error') {
        // Determine the appropriate redirect based on the route
        const originalUrl = req.originalUrl;
        const method = req.method;
        
        if (originalUrl.includes('/users/register') && method === 'POST') {
            return res.redirect('/users/register');
        }
        if (originalUrl.includes('/users/login') && method === 'POST') {
            return res.redirect('/users/login');
        }
        if (originalUrl.includes('/files/upload') && method === 'POST') {
            return res.redirect('/files/upload');
        }
        if (originalUrl.includes('/folders') && method === 'POST') {
            return res.redirect('/folders/new');
        }
        if (originalUrl.includes('/folders') && method === 'PUT') {
            // Extract folder ID from URL for edit redirects
            const folderId = originalUrl.match(/\/folders\/([^\/]+)/)?.[1];
            if (folderId) {
                return res.redirect(`/folders/${folderId}/edit`);
            }
        }
        
        // Default fallback
        return res.redirect('back');
    }
    next(err);
};

module.exports = {
    validateRegister,
    validateLogin,
    validateFileUpload,
    validateFolder,
    validateFolderAssignment,
    handleValidationErrors,
    validationErrorHandler
};