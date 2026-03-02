const dns = require("node:dns/promises");
// Manually setting DNS prevents Render's internal lookup delays
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios"); 
const connectDB = require("./config/db");
const Course = require("./models/Course");
const purchaseRoutes = require("./routes/purchaseRoutes");
const Purchase = require("./models/Purchase");
Purchase.syncIndexes();

// Initialize Environment Variables and Database
dotenv.config();
connectDB();

const app = express();

// --- SIMPLIFIED CORS CONFIGURATION ---
// This version is more reliable for cloud handshakes
const allowedOrigins = [
    'https://pimentor.github.io',
    'http://localhost:3000',
    'http://localhost:5000'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('netlify.app')) {
            return callback(null, true);
        } else {
            return callback(new Error('CORS Policy Error: Origin not allowed'), false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- API ROUTES ---
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/purchase", purchaseRoutes);
app.use("/api/payment", require("./routes/paymentRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));


// --- RENDER KEEP-ALIVE LOGIC ---

// 1. Lightweight health-check endpoint
app.get("/api/health-check", (req, res) => {
    res.status(200).send("PiMentor is Awake");
});

// 2. Base API check
app.get("/", (req, res) => {
    res.send("PiMentor API is running successfully.");
});

// 3. The Self-Ping Interval (Executes every 14 minutes)
const RENDER_URL = "https://pimentor-project.onrender.com/api/health-check"; 

setInterval(async () => {
    try {
        const response = await axios.get(RENDER_URL);
        console.log(`[Keep-Alive]: Pinged at ${new Date().toLocaleString()} - Status: ${response.data}`);
    } catch (error) {
        // We use silent catch to prevent log spam if the server is just booting up
        console.log(`[Keep-Alive]: Waiting for server...`);
    }
}, 14 * 60 * 1000); 

// --- START SERVER ---
const PORT = process.env.PORT || 10000; 
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});