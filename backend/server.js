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
const mongoose = require("mongoose");
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
const adminChatbotRoutes = require("./routes/adminChatbot.routes");
const shipmentRoutes = require("./routes/shipment.routes");
const errorHandler = require("./middleware/error.middleware");
const { csrfProtection } = require("./middleware/csrf.middleware");

const app = express();
const PORT = process.env.PORT || 3000;
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
const SESSION_SECRET = process.env.SESSION_SECRET;

const startupErrors = [];
const configErrors = [];

if (process.env.NODE_ENV === "production") {
  if (!SESSION_SECRET) {
    configErrors.push("SESSION_SECRET is required in production. Please set the SESSION_SECRET environment variable.");
    startupErrors.push("SESSION_SECRET is required in production. Please set the SESSION_SECRET environment variable.");
  }
  if (!process.env.CLIENT_ORIGINS && !process.env.CLIENT_ORIGIN) {
    configErrors.push("CLIENT_ORIGINS or CLIENT_ORIGIN must be configured in production. Please set either of these environment variables.");
    startupErrors.push("CLIENT_ORIGINS or CLIENT_ORIGIN must be configured in production. Please set either of these environment variables.");
  }
}

if (!process.env.MONGO_URI) {
  configErrors.push("MONGO_URI is required. Please set the MONGO_URI environment variable.");
  startupErrors.push("MONGO_URI is required. Please set the MONGO_URI environment variable.");
}

const SESSION_TTL_MS = parseInt(process.env.SESSION_MAX_AGE_MS || "604800000");
let customerSession = null;
let adminSession = null;

// Fallback session middlewares using MemoryStore so the server never crashes on session operations if MongoDB is not ready.
const memoryStore = new session.MemoryStore();
const fallbackCustomerSession = createSessionMiddleware("vvv.customer.sid", memoryStore);
const fallbackAdminSession = createSessionMiddleware("vvv.admin.sid", memoryStore);

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

function getPortalScopeHint(req) {
  const raw = String(req.headers["x-portal-scope"] || "")
    .toLowerCase()
    .trim();
  if (raw === "admin" || raw === "customer") return raw;
  return "";
}

function inferScopeFromCookies(req) {
  const cookieNames = getCookieNames(req);
  const hasAdmin = cookieNames.includes("vvv.admin.sid");
  const hasCustomer = cookieNames.includes("vvv.customer.sid");

  if (hasAdmin && !hasCustomer) return "admin";
  if (hasCustomer && !hasAdmin) return "customer";

  return "";
}

function resolveSessionScope(req) {
  const url = req.originalUrl || req.url || "";
  if (url.startsWith("/api/admin") || url.startsWith("/api/users"))
    return "admin";
  if (url.startsWith("/api/auth/admin")) return "admin";
  if (/^\/api\/orders\/[^/]+\/status(?:\?|$)/.test(url)) return "admin";

  const portalScopeHint = getPortalScopeHint(req);
  if (portalScopeHint) return portalScopeHint;

  if (url === "/api/auth/me" || url === "/api/auth/logout") {
    const inferredScope = inferScopeFromCookies(req);
    if (inferredScope) return inferredScope;
  }

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

function createSessionMiddleware(cookieName, store) {
  return session({
    name: cookieName,
    secret: SESSION_SECRET || "vvv_secret",
    resave: false,
    saveUninitialized: false,
    store,
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

function initializeSessionMiddlewares() {
  if (customerSession && adminSession) return;

  if (process.env.MONGO_URI && mongoose.connection.readyState === 1) {
    try {
      const store = MongoStore.create({
        clientPromise: Promise.resolve(mongoose.connection.getClient()),
        collectionName: "sessions",
        ttl: SESSION_TTL_MS / 1000,
      });

      customerSession = createSessionMiddleware("vvv.customer.sid", store);
      adminSession = createSessionMiddleware("vvv.admin.sid", store);
      console.log("MongoStore session middleware initialized successfully.");
    } catch (err) {
      console.error("Failed to initialize MongoStore session middleware:", err.message);
    }
  }
}

function getCookieNames(req) {
  const header = req.headers.cookie || "";
  if (!header) return [];
  return header
    .split(";")
    .map((item) => item.trim().split("=")[0])
    .filter(Boolean);
}

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

  // Support wildcard matching (e.g. *.vercel.app or *)
  for (const pattern of configuredOrigins) {
    if (pattern === "*") return true;
    if (pattern.includes("*")) {
      const regexStr = pattern.replace(/\./g, "\\.").replace(/\*/g, ".*");
      const regex = new RegExp(`^${regexStr}$`, "i");
      if (regex.test(origin)) return true;
    }
  }

  // Auto-allow vercel.app domains for easy deployment (preview & production)
  if (origin.endsWith(".vercel.app")) {
    return true;
  }

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
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked for origin: ${origin}`);
        callback(null, false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-Portal-Scope",
    ],
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Return 503 Service Unavailable if there are critical startup configuration or connection errors.
// This prevents the application from throwing unhandled errors or getting stuck while MongoDB is disconnected.
app.use((req, res, next) => {
  if (startupErrors.length > 0) {
    if (req.path === "/" || req.path === "/api/health" || req.path === "/api/health/") {
      return res.status(503).json({
        status: "error",
        service: "VuaVuiVe Backend API",
        timestamp: new Date().toISOString(),
        errors: startupErrors,
        db: {
          ready: false,
          state: mongoose.connection.readyState,
        }
      });
    }
    if (req.path.startsWith("/api/")) {
      return res.status(503).json({
        success: false,
        message: "Service Unavailable: The server has configuration or connection errors.",
        errors: startupErrors,
      });
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(503).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>VuaVuiVe Backend - Service Unavailable</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; background: #f8f9fa; color: #343a40; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-top: 5px solid #dc3545; }
          h1 { color: #dc3545; margin-top: 0; }
          ul { padding-left: 20px; }
          li { margin-bottom: 10px; }
          .footer { margin-top: 30px; font-size: 0.85em; color: #6c757d; border-top: 1px solid #dee2e6; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Hệ thống cấu hình chưa hoàn tất</h1>
          <p>Backend Vựa Vui Vẻ đã khởi động thành công và mở cổng kết nối, nhưng phát hiện các lỗi sau:</p>
          <ul>
            ${startupErrors.map(err => `<li><strong>Lỗi:</strong> ${err}</li>`).join("")}
          </ul>
          <p>Vui lòng cấu hình đầy đủ các biến môi trường trong Render Dashboard và khởi động lại dịch vụ.</p>
          <div class="footer">
            VuaVuiVe Backend &bull; Status: 503 Service Unavailable &bull; ${new Date().toLocaleString()}
          </div>
        </div>
      </body>
      </html>
    `);
  }
  next();
});

app.use((req, res, next) => {
  const scope = resolveSessionScope(req);
  req.sessionScope = scope;
  req.sessionCookieName =
    scope === "admin" ? "vvv.admin.sid" : "vvv.customer.sid";
  const middleware = scope === "admin"
    ? (adminSession || fallbackAdminSession)
    : (customerSession || fallbackCustomerSession);
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
app.use("/api/admin/chatbot", adminChatbotRoutes);
app.use("/api/recommend", recommendRoutes);
app.use("/api/recipes", recipesRoutes);
app.use("/api/realtime", realtimeRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/shipments", shipmentRoutes);

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
  const dbState = Number(require("mongoose").connection.readyState || 0);
  const dbReady = dbState === 1;
  const statusCode = dbReady ? 200 : 503;

  res.status(statusCode).json({
    status: "ok",
    service: "VuaVuiVe Backend API",
    timestamp: new Date().toISOString(),
    session: !!req.session?.userId,
    db: {
      ready: dbReady,
      state: dbState,
    },
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

async function startServer() {
  // Bind server immediately so that Render port scan succeeds
  app.listen(PORT, () => {
    console.log(`\nVuaVuiVe Backend chay tai http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(
      `CORS config: ${process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || "auto local dev"}`,
    );
  });

  // If there are initial config errors, do not attempt to connect to MongoDB
  if (configErrors.length > 0) {
    console.error("\n[CRITICAL] Server started with configuration errors:");
    configErrors.forEach(err => console.error(` - ${err}`));
    return;
  }

  // Connect to MongoDB in the background
  console.log("Connecting to MongoDB in the background...");
  connectDB()
    .then(() => {
      console.log("MongoDB connection established successfully.");
      initializeSessionMiddlewares();
    })
    .catch((err) => {
      console.error("MongoDB background connection failed:", err.message);
      startupErrors.push(`MongoDB connection failed: ${err.message}`);
      // Fallback is already initialized
    });
}

startServer().catch((err) => {
  console.error("Server startup failed:", err.message);
  // Do not crash the process so port scanner succeeds and logs can be retrieved.
});

module.exports = app;
