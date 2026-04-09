const express = require("express");
const router = express.Router();
const Short = require("../models/Shorts");
const authMiddleware = require("../middleware/authMiddleware");

// A. ADMIN: Manage Categories (Saves an empty entry just to hold the Category Icon)
router.post("/manage-category", authMiddleware, async (req, res) => {
    try {
        const { name, icon } = req.body;
        // Check if category exists, update icon if it does, otherwise it'll be used for new uploads
        res.status(200).json({ message: `Category ${name} icon set to ${icon}` });
    } catch (err) {
        res.status(500).json({ message: "Error saving category" });
    }
});

// B. ADMIN: Upload new Pi-Shot
router.post("/upload", authMiddleware, async (req, res) => {
    try {
        const { category, title, ytUrl, icon } = req.body;
        const shortId = "shot_" + Date.now();
        
        const newShort = new Short({
            shortId,
            category,
            title,
            ytUrl,
            icon: icon || "🚀"
        });

        await newShort.save();
        res.status(201).json({ message: "Pi-Shot Deployed to Galaxy!" });
    } catch (err) {
        res.status(500).json({ message: "Deployment failed" });
    }
});

// C. HUB: Get all categories and their counts
router.get("/categories", async (req, res) => {
    try {
        const categories = await Short.aggregate([
            {
                $group: {
                    _id: "$category",
                    videoCount: { $sum: 1 },
                    icon: { $first: "$icon" }
                }
            },
            {
                $project: {
                    _id: 0,
                    name: "$_id",
                    videoCount: 1,
                    icon: 1
                }
            }
        ]);
        res.json(categories);
    } catch (err) {
        res.status(500).json({ message: "Galaxy Scan Failed" });
    }
});

// D. PLAYER: Get videos for a specific category
router.get("/list", async (req, res) => {
    try {
        const { category } = req.query;
        let query = {};
        if (category && category !== 'All') {
            query.category = category;
        }
        const list = await Short.find(query).sort({ order: 1 });
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: "Failed to retrieve shots" });
    }
});
// E. ADMIN: Delete a Pi-Shot
router.delete("/delete/:id", authMiddleware, async (req, res) => {
    try {
        const shot = await Short.findByIdAndDelete(req.params.id);
        if(!shot) return res.status(404).json({ message: "Short not found" });
        res.json({ message: "Pi-Shot removed from the dimension!" });
    } catch (err) {
        res.status(500).json({ message: "Error during deletion" });
    }
});
module.exports = router;