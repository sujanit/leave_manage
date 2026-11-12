
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();

const PORT = Number(process.env.PORT) || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Check MongoDB URI
if (!MONGODB_URI) {
  console.error("ERROR: MONGODB_URI is missing in .env file");
  process.exit(1);
}

// User Schema
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

// Leave Schema
const leaveSchema = new mongoose.Schema({
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
});

// Models
const User = mongoose.model("User", userSchema);
const Leave = mongoose.model("Leave", leaveSchema);

// Home Route
app.get("/", (req, res) => {
  res.json({
    message: "Leave Management API is running!",
    database:
      mongoose.connection.readyState === 1
        ? "MongoDB Atlas Connected"
        : "MongoDB Disconnected"
  });
});

// Database Status
app.get("/db-status", (req, res) => {
  const connected = mongoose.connection.readyState === 1;

  res.status(connected ? 200 : 503).json({
    database: connected ? "Connected" : "Disconnected",
    databaseName: mongoose.connection.name || null,
    host: mongoose.connection.host || null
  });
});

// Register User
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

    const casual = Number(casualLeave);
    const medical = Number(medicalLeave);

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

    res.status(500).json({
      message: "Could not register user.",
      error: error.message
    });
  }
});

// Login User
app.post("/api/users/login", async (req, res) => {
  try {
    const { email, rollNumber } = req.body;

    if (!email || !rollNumber) {
      return res.status(400).json({
        message: "Enter email and roll number."
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
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
    res.status(500).json({
      message: "Could not log in.",
      error: error.message
    });
  }
});

// Get User
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
    res.status(500).json({
      message: "Could not fetch user."
    });
  }
});

// Apply Leave
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

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found. Please log in again."
      });
    }

    const field =
      leaveType === "Casual" ? "casualLeave" : "medicalLeave";

    if (user[field] < numberOfDays) {
      return res.status(400).json({
        message: `Not enough ${leaveType.toLowerCase()} leave balance.`
      });
    }

    user[field] -= numberOfDays;
    await user.save();

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
    res.status(500).json({
      message: "Could not apply for leave.",
      error: error.message
    });
  }
});

// Get Leave History
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
    res.status(500).json({
      message: "Could not load leave history."
    });
  }
});

// Frontend fallback
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api/") &&
      req.path !== "/db-status") {
    return res.sendFile(
      path.join(__dirname, "public", "index.html"),
      (err) => {
        if (err) next(err);
      }
    );
  }

  next();
});

// MongoDB Atlas Connection
async function startServer(port = PORT) {
  try {
    await mongoose.connect(MONGODB_URI);

    console.log("--------------------------------");
    console.log("MongoDB Atlas Connected Successfully");
    console.log("Database:", mongoose.connection.name);
    console.log("--------------------------------");

    const server = app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log(`API: http://localhost:${port}`);
      console.log(`DB Status: http://localhost:${port}/db-status`);
    });

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        const fallbackPort = port + 1;
        console.warn(`Port ${port} is already in use. Retrying on port ${fallbackPort}...`);
        return startServer(fallbackPort);
      }

      console.error("Server failed to start:", error.message);
      process.exit(1);
    });

  } catch (error) {
    console.error("MongoDB Atlas Connection Failed:", error.message);
    process.exit(1);
  }
}

startServer();
