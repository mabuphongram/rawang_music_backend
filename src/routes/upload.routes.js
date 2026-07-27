const express = require("express");
const upload = require("../middleware/upload");

const router = express.Router();

// Sample upload endpoint — accepts a single file under the "file" field.
// Real logic (saving metadata to DB, validation, etc.) comes later.
router.post("/", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  res.status(201).json({
    message: "File uploaded",
    filename: req.file.filename,
    url: `/uploads/${req.file.filename}`,
    size: req.file.size,
  });
});

module.exports = router;
