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
const cartRoutes = require("./routes/cart.routes");
const paymentRoutes = require("./routes/payment.routes");
const userRoutes = require("./routes/user.routes");
const adminRoutes = require("./routes/admin.routes");
const recommendRoutes = require("./routes/recommend.routes");
const recipesRoutes = require("./routes/recipes.routes");
const realtimeRoutes = require("./routes/realtime.routes");
const chatbotRoutes = require("./routes/chatbot.routes");
const errorHandler = require("./middleware/error.middleware");
const { csrfProtection } = require("./middleware/csrf.middleware");

const app = express();
const PORT = process.env.PORT || 3000;
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (process.env.NODE_ENV === "production" && !SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required in production");
}

if (
  process.env.NODE_ENV === "production" &&
  !process.env.CLIENT_ORIGINS &&
  !process.env.CLIENT_ORIGIN
) {
  throw new Error(
    "CLIENT_ORIGINS or CLIENT_ORIGIN must be configured in production",
  );
}

const SESSION_TTL_MS = parseInt(process.env.SESSION_MAX_AGE_MS || "604800000");
const sessionStore = MongoStore.create({
  mongoUrl: process.env.MONGO_URI,
  collectionName: "sessions",
  ttl: SESSION_TTL_MS / 1000,
});

function getRequestOrigin(req) {
  const origin = req.headers.origin;
  if (origin) return origin;
  const referer = req.headers.referer || req.headers.referrer;
  if (!referer) return "";
  try {
    return new URL(referer).origin;
  } catch {
    return "";
  }
}

function resolveSessionScope(req) {
  const url = req.originalUrl || req.url || "";
  if (url.startsWith("/api/admin") || url.startsWith("/api/users"))
    return "admin";
  if (/^\/api\/orders\/[^/]+\/status(?:\?|$)/.test(url)) return "admin";

  const origin = getRequestOrigin(req);
  if (origin) {
    try {
      const parsed = new URL(origin);
      const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
      if (port === "4201") return "admin";
      if (port === "4200") return "customer";
    } catch {
      // Ignore malformed origin and fall through to default scope.
    }
  }

  return "customer";
}

function createSessionMiddleware(cookieName) {
  return session({
    name: cookieName,
    secret: SESSION_SECRET || "vvv_secret",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
      domain: COOKIE_DOMAIN,
      maxAge: SESSION_TTL_MS,
    },
  });
}

function getCookieNames(req) {
  const header = req.headers.cookie || "";
  if (!header) return [];
  return header
    .split(";")
    .map((item) => item.trim().split("=")[0])
    .filter(Boolean);
}

const customerSession = createSessionMiddleware("vvv.customer.sid");
const adminSession = createSessionMiddleware("vvv.admin.sid");

function isAllowedOrigin(origin) {
  if (!origin) return true;

  const originList = process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN;
  const configuredOrigins = (
    originList || "http://localhost:4200,http://localhost:4201"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (configuredOrigins.includes(origin)) return true;

  if (process.env.NODE_ENV === "production") {
    return false;
  }

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

if (process.env.TRUST_PROXY) {
  app.set(
    "trust proxy",
    process.env.TRUST_PROXY === "true" ? 1 : process.env.TRUST_PROXY,
  );
} else if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

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

app.use((req, res, next) => {
  const scope = resolveSessionScope(req);
  req.sessionScope = scope;
  req.sessionCookieName =
    scope === "admin" ? "vvv.admin.sid" : "vvv.customer.sid";
  const middleware = scope === "admin" ? adminSession : customerSession;
  return middleware(req, res, next);
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/", express.static(path.join(__dirname, "../frontend/public")));

app.use(csrfProtection);

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/recommend", recommendRoutes);
app.use("/api/recipes", recipesRoutes);
app.use("/api/realtime", realtimeRoutes);
app.use("/api/chatbot", chatbotRoutes);

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "VuaVuiVe Backend API",
    message: "Backend is running. Use /api/* endpoints.",
    endpoints: {
      health: "/api/health",
      products: "/api/products",
      auth: "/api/auth",
    },
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "VuaVuiVe Backend API",
    timestamp: new Date().toISOString(),
    session: !!req.session?.userId,
  });
});

if (process.env.NODE_ENV !== "production") {
  app.get("/api/debug/session", (req, res) => {
    const cookieNames = getCookieNames(req);
    res.json({
      success: true,
      message: "Development session debug info",
      data: {
        scope: req.sessionScope || "unknown",
        activeCookieName: req.sessionCookieName || "unknown",
        hasSession: !!req.session?.userId,
        sessionId: req.sessionID || "",
        userId: req.session?.userId || null,
        role: req.session?.role || null,
        origin: req.headers.origin || null,
        referer: req.headers.referer || null,
        path: req.originalUrl || req.url,
        cookieNames,
        hasAdminCookie: cookieNames.includes("vvv.admin.sid"),
        hasCustomerCookie: cookieNames.includes("vvv.customer.sid"),
        hasLegacyCookie: cookieNames.includes("vvv.sid"),
      },
    });
  });
}

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\nVuaVuiVe Backend chay tai http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(
    `CORS config: ${process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || "auto local dev"}`,
  );
});

module.exports = app;
