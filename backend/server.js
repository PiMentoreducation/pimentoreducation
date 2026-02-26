const dns = require("node:dns/promises");
// Manually setting DNS prevents Render's internal lookup delays for Gmail/MongoDB
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios"); // REQUIRED: Run 'npm install axios' in your terminal
const connectDB = require("./config/db");
const Course = require("./models/Course");
const purchaseRoutes = require("./routes/purchaseRoutes");

// Initialize Environment Variables and Database
dotenv.config();
connectDB();

const app = express();

// --- CORS CONFIGURATION ---
// Replace the Netlify URL with your actual one once you deploy the frontend.
const allowedOrigins = [
    'https://pimentor.netlify.app', // YOUR ACTUAL LIVE URL
    'http://localhost:3000',
    'http://localhost:5000'
];
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like your Flutter mobile app or Postman)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(new Error('CORS Policy Error: Origin not allowed'), false);
        }
        return callback(null, true);
    },
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- API ROUTES ---
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/purchase", purchaseRoutes);
app.use("/api/payment", require("./routes/paymentRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));

// Route for Admin Course Dropdown
app.get("/api/all-courses", async (req, res) => {
    try {
        const courses = await Course.find({}, "courseId title");
        res.json(courses);
    } catch (err) {
        console.error("Error fetching courses for admin:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// --- RENDER KEEP-ALIVE LOGIC ---

// 1. Lightweight health-check endpoint for the ping to hit
app.get("/api/health-check", (req, res) => {
    res.status(200).send("PiMentor is Awake");
});

// 2. Base API check
app.get("/", (req, res) => {
    res.send("PiMentor API is running successfully.");
});

// 3. The Self-Ping Interval (Executes every 14 minutes)
// IMPORTANT: Replace the URL below with your actual Render URL after you deploy.
const RENDER_URL = "https://pimentor-project.onrender.com/api/health-checkPrime";

setInterval(async () => {
    try {
        const response = await axios.get(RENDER_URL);
        console.log(`[Keep-Alive]: Pinged at ${new Date().toISOString()} - Status: ${response.data}`);
    } catch (error) {
        console.error(`[Keep-Alive]: Ping failed: ${error.message}`);
    }
}, 14 * 60 * 1000); 

// --- START SERVER ---
const PORT = process.env.PORT || 10000; // Render usually prefers port 10000
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});