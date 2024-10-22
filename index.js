import express from "express";
import dotenv from "dotenv";
import { connectDb } from "./database/db.js";
import cors from "cors";
import paypal from "@paypal/checkout-server-sdk";

// Load environment variables
dotenv.config();

// PayPal environment setup (Sandbox/Live based on env)
const Environment =
  process.env.PAYPAL_ENVIRONMENT === "live"
    ? paypal.core.LiveEnvironment
    : paypal.core.SandboxEnvironment;

// Initialize PayPal client
export const paypalClient = new paypal.core.PayPalHttpClient(
  new Environment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
  )
);

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());

// Set up CORS with specific configurations
app.use(cors({
  origin: 'http://localhost:5173', // Replace with your frontend URL in production
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Corrected methods format
  credentials: true,
}));

const port = process.env.PORT || 5000; // Default to 5000 if PORT is not set

// Test route
app.get("/", (req, res) => {
  res.send("Server is working");
});

// Serve static files from the "uploads" directory
app.use("/uploads", express.static("uploads"));

// Importing routes
import userRoutes from "./routes/user.js";
import courseRoutes from "./routes/course.js";
import adminRoutes from "./routes/admin.js";

// Using routes
app.use("/api", userRoutes);
app.use("/api", courseRoutes);
app.use("/api", adminRoutes);

// Starting server and connecting to database
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  connectDb();
});
