const dns = require("node:dns/promises");
// Setting DNS servers can help prevent timeout issues in some cloud environments
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/db");
const Course = require("./models/Course");
const purchaseRoutes = require("./routes/purchaseRoutes");

// Initialize Environment Variables and Database
dotenv.config();
connectDB();

const app = express();

// --- UPDATED CORS FOR NETLIFY ---
// Once you host your frontend on Netlify, replace the placeholder below.
const allowedOrigins = [
    'https://your-pimentor-site.netlify.app', // Update this after Netlify upload
    'http://localhost:3000',                  // For local React/Flutter web testing
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

// Admin Course Dropdown Route
app.get("/api/all-courses", async (req, res) => {
    try {
        const courses = await Course.find({}, "courseId title");
        res.json(courses);
    } catch (err) {
        console.error("Error fetching courses for admin:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// --- REMOVED STATIC FILE SERVING ---
// Since the frontend is moving to Netlify, your backend remains a "Pure API"
app.get("/", (req, res) => {
    res.send("PiMentor API is running successfully.");
});

// Port configuration for Koyeb
const PORT = process.env.PORT || 8000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});