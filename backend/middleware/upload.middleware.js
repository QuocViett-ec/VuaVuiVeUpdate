"use strict";

const multer = require("multer");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const { uploadDirectory } = require("../config/uploads");
const types = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const receive = multer({
  storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (!types[file.mimetype]) return cb(Object.assign(new Error("Chỉ chấp nhận ảnh JPEG, PNG, WebP."), { status: 400 }));
    cb(null, true);
  },
}).single("image");

function hasImageSignature(buffer, mime) {
  if (mime === "image/jpeg") return buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  if (mime === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return mime === "image/webp" && buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
}

exports.uploadImage = (req, res, next) => receive(req, res, async (err) => {
  if (err) return next(err);
  if (!req.file) return next();
  try {
    if (!hasImageSignature(req.file.buffer, req.file.mimetype)) throw Object.assign(new Error("Nội dung file không phải ảnh hợp lệ."), { status: 400 });
    const directory = path.join(uploadDirectory(), "products");
    await fs.mkdir(directory, { recursive: true });
    req.file.filename = crypto.randomUUID() + types[req.file.mimetype];
    await fs.writeFile(path.join(directory, req.file.filename), req.file.buffer, { flag: "wx" });
    delete req.file.buffer;
    next();
  } catch (error) { next(error); }
});
exports.hasImageSignature = hasImageSignature;
