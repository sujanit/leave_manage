
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();

// Configuration
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ===============================
// USER SCHEMA
// ===============================

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    rollNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    casualLeave: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    medicalLeave: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    }
  },
  { timestamps: true }
);

// ===============================
// LEAVE SCHEMA
// ===============================

const leaveSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    leaveType: {
      type: String,
      enum: ["Casual", "Medical"],
      required: true
    },
    days: {
      type: Number,
      required: true,
      min: 1
    },
    status: {
      type: String,
      enum: ["Applied", "Approved", "Rejected"],
      default: "Applied"
    },
    appliedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// ===============================
// MODELS
// ===============================

const User = mongoose.model("User", userSchema);
const Leave = mongoose.model("Leave", leaveSchema);

// ===============================
// HOME ROUTE
// ===============================

app.get("/", (req, res) => {
  res.json({
    message: "Leave Management API is running!",
    database:
      mongoose.connection.readyState === 1
        ? "MongoDB Atlas Connected"
        : "MongoDB Disconnected"
  });
});

// ===============================
// DATABASE STATUS
// ===============================

app.get("/db-status", (req, res) => {
  const connected = mongoose.connection.readyState === 1;

  res.status(connected ? 200 : 503).json({
    database: connected ? "Connected" : "Disconnected",
    databaseName: mongoose.connection.name || null,
    host: mongoose.connection.host || null
  });
});

// ===============================
// REGISTER USER
// ===============================

app.post("/api/users/register", async (req, res) => {
  try {
    const {
      username,
      email,
      rollNumber,
      casualLeave,
      medicalLeave
    } = req.body;

    if (!username || !email || !rollNumber) {
      return res.status(400).json({
        message: "Please fill in all required fields."
      });
    }

    const casual = Number(casualLeave ?? 0);
    const medical = Number(medicalLeave ?? 0);

    if (
      !Number.isInteger(casual) ||
      casual < 0 ||
      !Number.isInteger(medical) ||
      medical < 0
    ) {
      return res.status(400).json({
        message: "Leave balances must be whole numbers greater than or equal to zero."
      });
    }

    const user = await User.create({
      username,
      email,
      rollNumber,
      casualLeave: casual,
      medicalLeave: medical
    });

    res.status(201).json({
      message: "Registration successful. You can now log in.",
      user
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email or roll number is already registered."
      });
    }

    console.error("Registration Error:", error.message);

    res.status(500).json({
      message: "Could not register user.",
      error: error.message
    });
  }
});

// ===============================
// LOGIN USER
// ===============================

app.post("/api/users/login", async (req, res) => {
  try {
    const { email, rollNumber } = req.body;

    if (!email || !rollNumber) {
      return res.status(400).json({
        message: "Enter email and roll number."
      });
    }

    const user = await User.findOne({
      email: String(email).toLowerCase().trim(),
      rollNumber: String(rollNumber).trim()
    });

    if (!user) {
      return res.status(401).json({
        message: "User not found. Check your email and roll number."
      });
    }

    res.json({
      message: "Login successful.",
      user
    });

  } catch (error) {
    console.error("Login Error:", error.message);

    res.status(500).json({
      message: "Could not log in.",
      error: error.message
    });
  }
});

// ===============================
// GET USER DETAILS
// ===============================

app.get("/api/users/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid user ID."
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found."
      });
    }

    res.json({ user });

  } catch (error) {
    console.error("Get User Error:", error.message);

    res.status(500).json({
      message: "Could not fetch user."
    });
  }
});

// ===============================
// APPLY FOR LEAVE
// ===============================

app.post("/api/leaves", async (req, res) => {
  try {
    const { userId, leaveType, days } = req.body;
    const numberOfDays = Number(days);

    if (
      !mongoose.isValidObjectId(userId) ||
      !["Casual", "Medical"].includes(leaveType) ||
      !Number.isInteger(numberOfDays) ||
      numberOfDays < 1
    ) {
      return res.status(400).json({
        message: "Choose a leave type and enter a valid number of days."
      });
    }

    const field =
      leaveType === "Casual" ? "casualLeave" : "medicalLeave";

    // Atomically check and deduct leave balance
    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        [field]: { $gte: numberOfDays }
      },
      {
        $inc: { [field]: -numberOfDays }
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      const existingUser = await User.findById(userId);

      if (!existingUser) {
        return res.status(404).json({
          message: "User not found. Please log in again."
        });
      }

      return res.status(400).json({
        message: `Not enough ${leaveType.toLowerCase()} leave balance.`
      });
    }

    try {
      const leave = await Leave.create({
        userId,
        leaveType,
        days: numberOfDays
      });

      res.status(201).json({
        message: "Leave application submitted.",
        user,
        leave
      });

    } catch (error) {
      // Restore balance if leave creation fails
      await User.updateOne(
        { _id: userId },
        { $inc: { [field]: numberOfDays } }
      );

      throw error;
    }

  } catch (error) {
    console.error("Apply Leave Error:", error.message);

    res.status(500).json({
      message: "Could not apply for leave.",
      error: error.message
    });
  }
});

// ===============================
// GET LEAVE HISTORY
// ===============================

app.get("/api/leaves/:userId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({
        message: "Invalid user ID."
      });
    }

    const leaves = await Leave.find({
      userId: req.params.userId
    }).sort({ appliedAt: -1 });

    res.json({ leaves });

  } catch (error) {
    console.error("Leave History Error:", error.message);

    res.status(500).json({
      message: "Could not load leave history."
    });
  }
});

// ===============================
// FRONTEND FALLBACK
// ===============================

app.use((req, res, next) => {
  if (
    req.method === "GET" &&
    !req.path.startsWith("/api/") &&
    req.path !== "/db-status"
  ) {
    return res.sendFile(
      path.join(__dirname, "public", "index.html"),
      (error) => {
        if (error) next(error);
      }
    );
  }

  next();
});

// ===============================
// MONGODB ATLAS CONNECTION
// ===============================

async function startServer() {
  try {
    if (!MONGODB_URI) {
      throw new Error(
        "MONGODB_URI is missing. Please check your .env file or Render environment variables."
      );
    }

    console.log("Connecting to MongoDB Atlas...");

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });

    console.log("================================");
    console.log("MongoDB Atlas Connected Successfully!");
    console.log("Database:", mongoose.connection.name);
    console.log("Host:", mongoose.connection.host);
    console.log("================================");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Port: ${PORT}`);
    });

  } catch (error) {
    console.error("================================");
    console.error("MongoDB Connection Failed!");
    console.error("Error:", error.message);
    console.error("================================");

    process.exit(1);
  }
}

// Handle MongoDB connection errors
mongoose.connection.on("error", (error) => {
  console.error("MongoDB Error:", error.message);
});

// Start application
startServer();
