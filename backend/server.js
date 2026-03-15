/**
 * server.js - Entry point cho Vua Vui Ve Backend API
 * Stack: Node.js + Express + MongoDB (Mongoose) + express-session
 */
"use strict";

require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/product.routes");
const orderRoutes = require("./routes/order.routes");
const paymentRoutes = require("./routes/payment.routes");
const userRoutes = require("./routes/user.routes");
const adminRoutes = require("./routes/admin.routes");
const recommendRoutes = require("./routes/recommend.routes");
const recipesRoutes = require("./routes/recipes.routes");
const errorHandler = require("./middleware/error.middleware");
const { csrfProtection } = require("./middleware/csrf.middleware");

const app = express();
const PORT = process.env.PORT || 3000;

function isAllowedOrigin(origin) {
  if (!origin) return true;

  const configuredOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:4200")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (configuredOrigins.includes(origin)) return true;

  try {
    const { hostname, protocol } = new URL(origin);
    const isHttp = protocol === "http:" || protocol === "https:";
    const isLoopback = hostname === "localhost" || hostname === "127.0.0.1";
    const isPrivateLan =
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

    return isHttp && (isLoopback || isPrivateLan);
  } catch {
    return false;
  }
}

connectDB();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "vvv_secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
      ttl: parseInt(process.env.SESSION_MAX_AGE_MS || "604800000") / 1000,
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: parseInt(process.env.SESSION_MAX_AGE_MS || "604800000"),
    },
    name: "vvv.sid",
  }),
);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/", express.static(path.join(__dirname, "../frontend/public")));

app.use(csrfProtection);

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/recommend", recommendRoutes);
app.use("/api/recipes", recipesRoutes);

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "VuaVuiVe Backend API",
    timestamp: new Date().toISOString(),
    session: !!req.session?.userId,
  });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\nVuaVuiVe Backend chay tai http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`CORS config: ${process.env.CLIENT_ORIGIN || "auto local dev"}`);
});

module.exports = app;
