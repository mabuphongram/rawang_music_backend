const express = require("express");
const { auth } = require("../middleware/auth");
const { paymentScreenshotUpload } = require("../middleware/upload");
const {
  createAlbumPurchase,
  listMyAlbumPurchases,
  listAlbumPurchases,
  approveAlbumPurchase,
  rejectAlbumPurchase,
  revertAlbumPurchase,
  deleteAlbumPurchase,
  deleteAlbumPurchaseHistory,
  adminAlbumSales,
} = require("../controllers/albumPurchase.controller");

const router = express.Router();

router.post("/", auth(true), paymentScreenshotUpload.single("screenshot"), createAlbumPurchase);
router.get("/mine", auth(true), listMyAlbumPurchases);

// Trusted internal admin portal endpoints (same model as /contributions).
router.get("/album-sales", adminAlbumSales);
router.get("/", listAlbumPurchases);
router.post("/:id/approve", approveAlbumPurchase);
router.post("/:id/reject", rejectAlbumPurchase);
router.post("/:id/revert", revertAlbumPurchase);
router.delete("/:id", deleteAlbumPurchase);
router.delete("/", deleteAlbumPurchaseHistory);

module.exports = router;
