const express = require("express");
const router = express.Router();
const Short = require("../models/Shorts");
const authMiddleware = require("../middleware/authMiddleware");

// A. ADMIN: Manage Categories
router.post("/manage-category", authMiddleware, async (req, res) => {
    try {
        const { name, icon } = req.body;
        // Logic to update existing icons for all shorts in a category
        await Short.updateMany({ category: name }, { $set: { icon: icon } });
        res.status(200).json({ message: `Category ${name} icon synchronized to ${icon}` });
    } catch (err) {
        res.status(500).json({ message: "Error saving category" });
    }
});

// B. ADMIN: Upload new Pi-Shot (WITH AUTO-INCREMENT)
router.post("/upload", authMiddleware, async (req, res) => {
    try {
        const { category, title, ytUrl, icon } = req.body;
        
        // 1. Find the Supremum (Highest current order) for this specific category
        const lastShort = await Short.findOne({ category })
            .sort({ order: -1 })
            .select("order");

        // 2. Compute the next order: O(n) = O(n-1) + 1
        const nextOrder = lastShort ? (lastShort.order + 1) : 1;

        const newShort = new Short({
            shortId: "shot_" + Date.now(),
            category,
            title,
            ytUrl,
            icon: icon || "🚀",
            order: nextOrder // Dynamically assigned
        });

        await newShort.save();
        res.status(201).json({ 
            message: "Pi-Shot Deployed to Galaxy!", 
            assignedOrder: nextOrder 
        });
    } catch (err) {
        console.error("Upload Error:", err);
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
        
        // Sorting by order (Ascending) to ensure chronological playback
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