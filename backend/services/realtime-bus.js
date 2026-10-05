"use strict";
const User = require("../models/User.model");

const clients = new Map();
let clientSeq = 0;

function writeEvent(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function registerClient({ req, res, userId, role }) {
  const id = `${Date.now()}-${clientSeq++}`;
  clients.set(id, {
    id,
    userId: String(userId || ""),
    role: role || "user",
    res,
  });

  writeEvent(res, "connected", {
    ok: true,
    clientId: id,
    userId: String(userId || ""),
    role: role || "user",
    timestamp: new Date().toISOString(),
  });

  const sessionVersion = Number(req.session?.sessionVersion || 0);
  const expiresAt = new Date(req.session?.cookie?.expires || Date.now() + 604800000).getTime();
  let checking = false;
  const keepAlive = setInterval(async () => {
    if (checking) return;
    checking = true;
    try {
      const user = await User.findById(userId).select("isActive role sessionVersion").lean();
      if (!user?.isActive || user.role !== role || Number(user.sessionVersion || 0) !== sessionVersion || Date.now() >= expiresAt) {
        res.end();
        cleanup();
        return;
      }
    } catch {
      res.end();
      cleanup();
      return;
    } finally { checking = false; }
    if (!res.writableEnded) {
      res.write(": keep-alive\n\n");
    }
  }, 25000);

  const cleanup = () => {
    clearInterval(keepAlive);
    clients.delete(id);
  };

  req.on("close", cleanup);
  req.on("aborted", cleanup);
  res.on("close", cleanup);

  return cleanup;
}

function publish(event, payload, predicate = null) {
  const packet = {
    ...payload,
    timestamp: new Date().toISOString(),
  };

  for (const client of clients.values()) {
    if (predicate && !predicate(client)) continue;
    if (client.res.writableEnded) continue;
    writeEvent(client.res, event, packet);
  }
}

function publishToUser(userId, event, payload) {
  const target = String(userId || "");
  if (!target) return;
  publish(event, payload, (client) => client.userId === target);
}

function publishToCustomers(event, payload) {
  publish(event, payload, (client) => client.role === "user");
}

function closeAll() {
  for (const client of clients.values()) client.res.end();
  clients.clear();
}

module.exports = {
  registerClient,
  publish,
  publishToUser,
  publishToCustomers,
  closeAll,
};
