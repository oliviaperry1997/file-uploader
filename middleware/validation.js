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
        .custom((value) => {
            // Allow empty string (no folder selected) or valid CUID
            if (!value || value === '') {
                return true;
            }
            // Check if it's a valid CUID (25 characters, alphanumeric)
            const cuidRegex = /^c[a-z0-9]{24}$/;
            if (!cuidRegex.test(value)) {
                throw new Error('Invalid folder selection');
            }
            return true;
        })
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
        .custom((value) => {
            // Allow empty string (no parent folder) or valid CUID
            if (!value || value === '') {
                return true;
            }
            // Check if it's a valid CUID (25 characters, alphanumeric)
            const cuidRegex = /^c[a-z0-9]{24}$/;
            if (!cuidRegex.test(value)) {
                throw new Error('Invalid parent folder selection');
            }
            return true;
        })
];

// Validation rules for folder assignment
const validateFolderAssignment = [
    body('folderId')
        .optional()
        .custom((value) => {
            // Allow empty string (no folder selected) or valid CUID
            if (!value || value === '') {
                return true;
            }
            // Check if it's a valid CUID (25 characters, starts with 'c', alphanumeric)
            const cuidRegex = /^c[a-z0-9]{24}$/;
            if (!cuidRegex.test(value)) {
                throw new Error('Invalid folder selection');
            }
            return true;
        })
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.flash('errors', errors.array());
        
        if (req.originalUrl.includes('/login')) {
            return res.redirect('/users/login');
        } else if (req.originalUrl.includes('/register')) {
            return res.redirect('/users/register');
        } else {
            return res.redirect(req.originalUrl);
        }
    }
    next();
};

module.exports = {
    validateRegister,
    validateLogin,
    validateFileUpload,
    validateFolder,
    validateFolderAssignment,
    handleValidationErrors
};