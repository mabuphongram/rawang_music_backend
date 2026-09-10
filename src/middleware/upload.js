const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure the uploads directory exists
const uploadDir = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Store files on the local disk in /uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // e.g. 1690000000000-song.mp3 — timestamp prefix avoids name collisions
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({ storage });

// Community contributions: MP3 audio only, capped size (default 15 MB).
// Limits are enforced here server-side; the app also pre-checks client-side.
const MAX_CONTRIBUTION_MB = Number(process.env.MAX_CONTRIBUTION_FILE_MB || 15);

function mp3Only(req, file, cb) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mime = (file.mimetype || "").toLowerCase();
  // Extension is the reliable signal: some clients send MP3s as
  // application/octet-stream or vendor variants (audio/x-mpeg, ...).
  const okExt = ext === ".mp3";
  const okMime =
    mime.startsWith("audio/") || mime === "application/octet-stream" || mime === "";
  if (okExt && okMime) return cb(null, true);
  const err = new Error(
    `Only MP3 audio files are accepted (got "${file.originalname}" as ${file.mimetype})`
  );
  err.status = 400;
  cb(err);
}

const contributionUpload = multer({
  storage,
  limits: { fileSize: MAX_CONTRIBUTION_MB * 1024 * 1024, files: 2 },
  fileFilter: mp3Only,
});

module.exports = upload;
module.exports.upload = upload;
module.exports.contributionUpload = contributionUpload;
module.exports.MAX_CONTRIBUTION_MB = MAX_CONTRIBUTION_MB;
