const express = require('express');
const { PrismaClient } = require('../generated/prisma');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const { ensureAuthenticated, ensureGuest } = require('../middleware/auth');
const { validateLogin, validateRegister, handleValidationErrors } = require('../middleware/validation');

const router = express.Router();
const prisma = new PrismaClient();

// GET /users/login - Show login form
router.get('/login', ensureGuest, (req, res) => {
  res.render('users/login', {
    title: 'Login'
  });
});

// POST /users/login - Handle login
router.post('/login', 
    validateLogin,
    handleValidationErrors,
    passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/users/login',
        failureFlash: true,
        successFlash: 'Welcome back!'
    })
);

// GET /users/register - Show registration form
router.get('/register', ensureGuest, (req, res) => {
    res.render('users/register', {
        title: 'Register'
    });
});

// POST /users/register - Handle registration
router.post('/register',
    validateRegister,
    handleValidationErrors,
    async (req, res) => {
        try {
            // Check if user already exists
            const existingUser = await prisma.user.findUnique({
                where: { email: req.body.email },
            });

            if (existingUser) {
                req.flash('error', 'User with this email already exists');
                return res.redirect('/users/register');
            }

            // Hash password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
            
            // Create new user
            const user = await prisma.user.create({
                data: {
                    email: req.body.email.toLowerCase(),
                    name: req.body.name,
                    password: hashedPassword
                },
            });

            // Log in the user automatically after registration
            req.login(user, (err) => {
                if (err) {
                    console.error('Error logging in after registration:', err);
                    req.flash('error', 'Registration successful but login failed. Please try logging in.');
                    return res.redirect('/users/login');
                }
                req.flash('success', 'Registration successful! Welcome to File Uploader.');
                return res.redirect('/');
            });
            
        } catch (error) {
            console.error("Error during registration:", error);
            req.flash('error', 'Registration failed. Please try again.');
            res.redirect('/users/register');
        }
    }
);

// POST /users/logout - Handle logout
router.post('/logout', ensureAuthenticated, (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Error during logout:', err);
            return res.status(500).render('error', { error: err, title: 'Error' });
        }
        req.flash('success', 'You have been logged out successfully.');
        res.redirect('/');
    });
});

module.exports = router;
