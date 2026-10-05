/**
 * server.js - Entry point cho Vua Vui Ve Backend API
 * Stack: Node.js + Express + MongoDB (Mongoose) + express-session
 */
"use strict";

if (process.env.NODE_ENV !== "test") require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const crypto = require("crypto");
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
const { requireAuth } = require("./middleware/auth.middleware");
const { log } = require("./services/logger");
const { uploadDirectory } = require("./config/uploads");
const { expireUnpaidOrders } = require("./services/order-lifecycle");

const app = express();
const PORT = process.env.PORT || 3000;
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
const SESSION_SECRET = process.env.SESSION_SECRET || (process.env.NODE_ENV !== "production" ? crypto.randomBytes(32).toString("hex") : "");

const startupErrors = [];
const configErrors = [];

if (process.env.NODE_ENV === "production") {
  if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
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
let startupReady = false;

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
    secret: SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
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

const { isAllowedOrigin } = require("./config/origins");

if (process.env.TRUST_PROXY) {
  app.set(
      "trust proxy",
      require("./config/proxy").proxyTrust(process.env.TRUST_PROXY, process.env.NODE_ENV === "production"),
  );
} else if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  const started = Date.now();
  const requestPath = req.path;
  res.on("finish", () => log(res.statusCode >= 500 ? "error" : "info", "request.completed", {
    requestId: req.requestId, method: req.method, path: requestPath, status: res.statusCode, durationMs: Date.now() - started,
  }));
  next();
});

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
      "Idempotency-Key",
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
        errors: ["Service configuration or database unavailable."],
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
        errors: ["Service configuration or database unavailable."],
      });
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(503).send("Service unavailable. Check server logs using the request ID.");
  }
  next();
});

app.use((req, res, next) => {
  if (process.env.NODE_ENV !== "test" && req.path.startsWith("/api/") &&
      req.path !== "/api/health" && (mongoose.connection.readyState !== 1 || !customerSession || !adminSession)) {
    return res.status(503).json({ success: false, message: "Service not ready.", requestId: req.requestId });
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

try {
  app.use("/uploads", express.static(uploadDirectory()));
} catch (err) {
  configErrors.push(err.message);
  startupErrors.push(err.message);
}
app.use("/", express.static(path.join(__dirname, "../frontend/public")));

app.use(csrfProtection);
app.use((req, res, next) => {
  if (req.session?.userId) return requireAuth(req, res, next);
  next();
});

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
  const ready = dbReady && (startupReady || process.env.NODE_ENV === "test");
  const statusCode = ready ? 200 : 503;

  res.status(statusCode).json({
    status: ready ? "ok" : "unavailable",
    service: "VuaVuiVe Backend API",
    timestamp: new Date().toISOString(),
    session: !!req.session?.userId,
    environment: process.env.APP_ENV || (process.env.NODE_ENV === "production" ? "production" : "local"),
    uploadStorage: process.env.UPLOAD_STORAGE_MODE || (process.env.NODE_ENV === "production" ? "persistent" : "ephemeral"),
    revision: /^[a-f0-9]{40}$/.test(process.env.RENDER_GIT_COMMIT || process.env.RELEASE_SHA || "")
      ? (process.env.RENDER_GIT_COMMIT || process.env.RELEASE_SHA) : null,
    payments: { momo: require("./config/payment").isPaymentMethodEnabled("momo"),
      vnpay: require("./config/payment").isPaymentMethodEnabled("vnpay") },
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
        sessionId: "[REDACTED]",
        userId: req.session?.userId ? "[REDACTED]" : null,
        role: req.session?.role || null,
        origin: req.headers.origin || null,
        referer: "[REDACTED]",
        path: req.path,
        cookieNames,
        hasAdminCookie: cookieNames.includes("vvv.admin.sid"),
        hasCustomerCookie: cookieNames.includes("vvv.customer.sid"),
        hasLegacyCookie: cookieNames.includes("vvv.sid"),
      },
    });
  });
}

app.use(errorHandler);

let httpServer;
let expiryTimer;
let expiryRunning = false;

async function startServer() {
  const { configuredOrigins } = require("./config/origins");
  if (process.env.NODE_ENV === "production" && configuredOrigins().some((origin) => {
    try { return new URL(origin).origin !== origin || !origin.startsWith("https://"); }
    catch { return true; }
  })) {
    configErrors.push("Production origins must be exact HTTPS origins without wildcards.");
    startupErrors.push("Invalid production origins.");
  }
  httpServer = app.listen(PORT, () => log("info", "server.listening", { port: PORT }));
  if (configErrors.length) {
    log("error", "server.configuration_invalid", { count: configErrors.length });
    return;
  }
  try {
    await connectDB();
    if (process.env.NODE_ENV === "production") {
      const hello = await mongoose.connection.db.admin().command({ hello: 1 });
      if (!hello.setName && hello.msg !== "isdbgrid") throw new Error("Transactions require a replica set or sharded cluster.");
      const indexes = await require("./models/Order.model").collection.indexes();
      const required = ["userId_1_idempotencyKey_1", "payment.gateway_1_payment.transactionId_1"];
      if (required.some((name) => !indexes.some((i) => i.name === name && i.unique))) {
        throw new Error("Required order uniqueness indexes are missing.");
      }
    }
    initializeSessionMiddlewares();
    if (!customerSession || !adminSession) throw new Error("Session store unavailable.");
    expiryTimer = setInterval(async () => {
      if (expiryRunning) return;
      expiryRunning = true;
      try { await expireUnpaidOrders(); }
      catch { log("error", "orders.expiry_failed"); }
      finally { expiryRunning = false; }
    }, 60000);
    expiryTimer.unref();
    startupReady = true;
    log("info", "server.ready");
  } catch {
    startupErrors.push("Database or required indexes unavailable.");
    log("error", "server.startup_failed");
  }
}

async function shutdown() {
  startupReady = false;
  clearInterval(expiryTimer);
  require("./services/realtime-bus").closeAll();
  const deadline = setTimeout(() => process.exit(1), 10000);
  deadline.unref();
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  await mongoose.disconnect();
  clearTimeout(deadline);
}

if (require.main === module) {
  process.once("SIGTERM", () => shutdown().catch(() => process.exit(1)));
  process.once("SIGINT", () => shutdown().catch(() => process.exit(1)));
  startServer().catch(() => log("error", "server.startup_failed"));
}
module.exports = app;
