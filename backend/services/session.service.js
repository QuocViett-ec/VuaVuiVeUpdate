"use strict";

async function establishSession(req, user) {
  await new Promise((resolve, reject) => req.session.regenerate((err) => err ? reject(err) : resolve()));
  req.session.userId = String(user._id);
  req.session.role = user.role;
  req.session.name = user.name;
  req.session.sessionVersion = Number(user.sessionVersion || 0);
  await new Promise((resolve, reject) => req.session.save((err) => err ? reject(err) : resolve()));
}

module.exports = { establishSession };
