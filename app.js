const express = require('express');
const session = require('express-session');
const { PrismaSessionStore } = require('@quixo3/prisma-session-store');
const { PrismaClient } = require('./generated/prisma');
const expressLayouts = require('express-ejs-layouts');
const path = require("path");
const fs = require("fs");

const fileRoutes = require("./routes/files");
const userRoutes = require("./routes/users");

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
app.use(express.static(path.join(__dirname, "public")));

// Session configuration
app.use(
    session({
        cookie: {
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        },
        secret: process.env.SESSION_SECRET || "your-secret-key",
        resave: true,
        saveUninitialized: true,
        store: new PrismaSessionStore(prisma, {
            checkPeriod: 2 * 60 * 1000, // 2 minutes
            dbRecordIdIsSessionId: true,
            dbRecordIdFunction: undefined,
        }),
    })
);

// Routes
app.use("/files", fileRoutes);
app.use("/users", userRoutes);

// Home route
app.get("/", (req, res) => {
    res.render("index", {
        title: "File Uploader",
        user: req.session.user,
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
