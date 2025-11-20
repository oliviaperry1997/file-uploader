const express = require('express');
const { PrismaClient } = require('../generated/prisma');
const { body, validationResult } = require('express-validator');

const router = express.Router();
const prisma = new PrismaClient();

// GET /users/login - Show login form
router.get("/login", (req, res) => {
    if (req.session.user) {
        return res.redirect("/");
    }
    res.render("users/login", {
        title: "Login",
    });
});

// POST /users/login - Handle login
router.post(
    "/login",
    [
        body("email").isEmail().withMessage("Please enter a valid email"),
        body("name").notEmpty().withMessage("Name is required"),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).render("users/login", {
                    title: "Login",
                    errors: errors.array(),
                    email: req.body.email,
                    name: req.body.name,
                });
            }

            // Find or create user (simplified auth for demo)
            let user = await prisma.user.findUnique({
                where: { email: req.body.email },
            });

            if (!user) {
                user = await prisma.user.create({
                    data: {
                        email: req.body.email,
                        name: req.body.name,
                    },
                });
            }

            req.session.user = {
                id: user.id,
                email: user.email,
                name: user.name,
            };

            res.redirect("/");
        } catch (error) {
            console.error("Error during login:", error);
            res.status(500).render("error", { error, title: "Error" });
        }
    }
);

// GET /users/register - Show registration form
router.get("/register", (req, res) => {
    if (req.session.user) {
        return res.redirect("/");
    }
    res.render("users/register", {
        title: "Register",
    });
});

// POST /users/register - Handle registration
router.post(
    "/register",
    [
        body("email").isEmail().withMessage("Please enter a valid email"),
        body("name")
            .isLength({ min: 2 })
            .withMessage("Name must be at least 2 characters long"),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).render("users/register", {
                    title: "Register",
                    errors: errors.array(),
                    email: req.body.email,
                    name: req.body.name,
                });
            }

            // Check if user already exists
            const existingUser = await prisma.user.findUnique({
                where: { email: req.body.email },
            });

            if (existingUser) {
                return res.status(400).render("users/register", {
                    title: "Register",
                    errors: [{ msg: "User with this email already exists" }],
                    email: req.body.email,
                    name: req.body.name,
                });
            }

            // Create new user
            const user = await prisma.user.create({
                data: {
                    email: req.body.email,
                    name: req.body.name,
                },
            });

            req.session.user = {
                id: user.id,
                email: user.email,
                name: user.name,
            };

            res.redirect("/");
        } catch (error) {
            console.error("Error during registration:", error);
            res.status(500).render("error", { error, title: "Error" });
        }
    }
);

// POST /users/logout - Handle logout
router.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error destroying session:", err);
            return res
                .status(500)
                .render("error", { error: err, title: "Error" });
        }
        res.redirect("/");
    });
});

module.exports = router;
