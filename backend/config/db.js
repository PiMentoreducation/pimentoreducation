const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // Wait only 5 seconds before failing
      socketTimeoutMS: 45000,         // Close sockets after 45 seconds of inactivity
    });

    console.log(`✨ PiMentor Cloud Active: ${conn.connection.host}`);
  } catch (err) {
    console.error("❌ Cloud Connection Failed:", err.message);
    
    // If SRV fails, let's suggest the DNS fix in the logs
    if (err.message.includes("querySrv ECONNREFUSED")) {
      console.log("👉 Suggestion: Change your system DNS to 8.8.8.8 (Google DNS)");
    }
    
    process.exit(1);
  }
};

module.exports = connectDB;
// const mongoose = require("mongoose");

// const connectDB = async () => {
 //  try {
    // await mongoose.connect(process.env.MONGO_URI);
    // console.log("MongoDB Connected");
 //  } catch (err) {
  //  console.error(err.message);
  //  process.exit(1);
 // }
//};

//module.exports = connectDB;