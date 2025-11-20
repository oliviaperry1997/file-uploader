require("dotenv").config();
const app = require("./app");
const { PrismaClient } = require("./generated/prisma");

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        // Test database connection
        await prisma.$connect();
        console.log("Connected to database");

        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on("SIGINT", async () => {
    console.log("Shutting down gracefully...");
    await prisma.$disconnect();
    process.exit(0);
});

startServer();
