import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import userRoutes from "./routes/user.route.js";
import propertyRoutes from "./routes/property.route.js";
import coinsRoutes from "./routes/coins.route.js";
import adminRoutes from "./routes/admin.route.js";
import autoSuggestRoutes from "./routes/autosuggestion.js";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import { startExpiryCheck } from "./models/transaction.model.js";

dotenv.config();

const app = express();

// CORS configuration
const corsOptions = {
  origin: [
    "https://axces.in",
    "http://localhost:5000",
    "http://localhost:5173",
    "https://free-nextjs-admin-dashboard-main-three.vercel.app",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// app.use(express.json());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

connectDB();

app.get("/", (req, res) => {
  return res.json({
    message: "Welcome to the axces API's",
  });
});

app.use("/api/admin", adminRoutes);
app.use("/api", userRoutes);
app.use("/api", propertyRoutes);
app.use("/api", coinsRoutes);
app.use("/api", autoSuggestRoutes);

app.use((err, req, res, next) => {
  const code = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(code).json({
    code,
    data: {},
    message,
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  startExpiryCheck();
  console.log(`Server is running on port ${PORT}`);
});

export default app;
