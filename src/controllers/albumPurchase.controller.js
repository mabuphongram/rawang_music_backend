const fs = require("fs/promises");
const mongoose = require("mongoose");
const Album = require("../models/Album");
const AlbumPurchase = require("../models/AlbumPurchase");
const User = require("../models/User");
const { minioUpload, minioRemoveObject } = require("../utils/minioUpload.util");

async function discardLocalFile(file) {
  if (file?.path) await fs.unlink(file.path).catch(() => {});
}

function ownsAlbum(user, albumId) {
  return (user.purchasedAlbumIds || []).some((id) => String(id) === String(albumId));
}

// POST /api/album-purchases (multipart: albumId + screenshot)
async function createAlbumPurchase(req, res) {
  const screenshot = req.file;
  const albumId = String(req.body?.albumId || "").trim();

  if (!mongoose.isValidObjectId(albumId)) {
    await discardLocalFile(screenshot);
    return res.status(400).json({ error: "A valid albumId is required" });
  }
  if (!screenshot) {
    return res.status(400).json({ error: "A payment screenshot is required" });
  }

  const album = await Album.findById(albumId);
  if (!album) {
    await discardLocalFile(screenshot);
    return res.status(404).json({ error: "Album not found" });
  }
  if (!album.isPremium) {
    await discardLocalFile(screenshot);
    return res.status(400).json({ error: "This album is free and does not need a purchase" });
  }
  if (!(Number(album.price) > 0)) {
    await discardLocalFile(screenshot);
    return res.status(400).json({ error: "Album price is not configured yet" });
  }
  if (ownsAlbum(req.user, album._id)) {
    await discardLocalFile(screenshot);
    return res.status(409).json({ error: "You already own this album" });
  }

  const pending = await AlbumPurchase.findOne({
    userId: req.user._id,
    albumId: album._id,
    status: "pending",
  });
  if (pending) {
    await discardLocalFile(screenshot);
    return res.status(409).json({
      error: "A payment screenshot for this album is already awaiting review",
      code: "PURCHASE_PENDING",
    });
  }

  const purchase = new AlbumPurchase({
    userId: req.user._id,
    albumId: album._id,
    albumTitle: album.title,
    amount: Number(album.price),
    buyerName: req.user.name || "",
    buyerPhone: req.user.phone || "",
    buyerEmail: req.user.email || "",
    screenshotUrl: "__pending_minio_upload__",
  });
  await purchase.validate();

  try {
    purchase.screenshotUrl = await minioUpload(
      `payments/${purchase._id}`,
      screenshot,
      "screenshot"
    );
    await purchase.save();
  } catch (err) {
    await discardLocalFile(screenshot);
    if (purchase.screenshotUrl && purchase.screenshotUrl !== "__pending_minio_upload__") {
      await minioRemoveObject(purchase.screenshotUrl).catch(() => {});
    }
    if (err?.code === 11000) {
      return res.status(409).json({
        error: "A payment screenshot for this album is already awaiting review",
        code: "PURCHASE_PENDING",
      });
    }
    throw err;
  }

  res.status(201).json(purchase);
}

// GET /api/album-purchases/mine?albumId=...
async function listMyAlbumPurchases(req, res) {
  const filter = { userId: req.user._id };
  if (req.query.albumId) {
    if (!mongoose.isValidObjectId(req.query.albumId)) {
      return res.status(400).json({ error: "Invalid albumId" });
    }
    filter.albumId = req.query.albumId;
  }
  const items = await AlbumPurchase.find(filter).sort({ createdAt: -1 });
  res.json(items);
}

// GET /api/album-purchases/album-sales?ownerModel=&ownerId=&albumId= (trusted admin portal)
async function adminAlbumSales(req, res) {
  const ownerModel = String(req.query.ownerModel || "");
  const ownerId = String(req.query.ownerId || "");
  const albumId = req.query.albumId ? String(req.query.albumId) : "";

  if (!["Singer", "Organization"].includes(ownerModel)) {
    return res.status(400).json({ error: "ownerModel must be Singer or Organization" });
  }
  if (!mongoose.isValidObjectId(ownerId)) {
    return res.status(400).json({ error: "Invalid ownerId" });
  }
  if (albumId && !mongoose.isValidObjectId(albumId)) {
    return res.status(400).json({ error: "Invalid albumId" });
  }

  const albums = await Album.find({ ownerModel, ownerId }).select(
    "title isPremium price coverImage"
  );

  if (!albums.length) {
    return res.json({ totalEarned: 0, albums: [], selected: null });
  }

  const albumIds = albums.map((album) => album._id);
  const grouped = await AlbumPurchase.aggregate([
    {
      $match: {
        albumId: { $in: albumIds },
        status: "approved",
      },
    },
    {
      $group: {
        _id: "$albumId",
        totalAmount: { $sum: "$amount" },
        purchaseCount: { $sum: 1 },
        lastPurchaseAt: {
          $max: { $ifNull: ["$reviewedAt", "$createdAt"] },
        },
      },
    },
  ]);
  const totals = new Map(grouped.map((row) => [String(row._id), row]));

  const summaries = albums
    .map((album) => {
      const totalsRow = totals.get(String(album._id));
      return {
        id: String(album._id),
        title: album.title,
        isPremium: album.isPremium,
        price: album.price,
        coverImage: album.coverImage,
        totalAmount: totalsRow?.totalAmount || 0,
        purchaseCount: totalsRow?.purchaseCount || 0,
        lastPurchaseAt: totalsRow?.lastPurchaseAt || null,
      };
    })
    .sort(
      (a, b) =>
        b.totalAmount - a.totalAmount || a.title.localeCompare(b.title)
    );

  const selectedSummary = albumId
    ? summaries.find((album) => album.id === albumId)
    : summaries[0];
  if (albumId && !selectedSummary) {
    return res.status(404).json({ error: "Album does not belong to this owner" });
  }

  let selected = null;
  if (selectedSummary) {
    const records = await AlbumPurchase.find({
      albumId: selectedSummary.id,
      status: "approved",
    })
      .sort({ reviewedAt: -1, createdAt: -1 })
      .populate("userId", "name phone email")
      .select("amount createdAt reviewedAt userId buyerName buyerPhone buyerEmail");

    selected = {
      ...selectedSummary,
      records: records.map((record) => ({
        id: String(record._id),
        amount: record.amount,
        buyerName: record.buyerName || record.userId?.name || "Deleted user",
        buyerPhone: record.buyerPhone || record.userId?.phone || "",
        buyerEmail: record.buyerEmail || record.userId?.email || "",
        purchasedAt: record.reviewedAt || record.createdAt,
      })),
    };
  }

  res.json({
    totalEarned: summaries.reduce((sum, album) => sum + album.totalAmount, 0),
    albums: summaries,
    selected,
  });
}

// GET /api/album-purchases?status=pending&from=ISO&to=ISO (trusted admin portal)
async function listAlbumPurchases(req, res) {
  const filter = {};
  if (req.query.status) filter.status = String(req.query.status);

  const from = req.query.from ? new Date(req.query.from) : null;
  const to = req.query.to ? new Date(req.query.to) : null;
  if (from && Number.isNaN(from.getTime())) {
    return res.status(400).json({ error: "Invalid from date" });
  }
  if (to && Number.isNaN(to.getTime())) {
    return res.status(400).json({ error: "Invalid to date" });
  }
  if (from && to && from > to) {
    return res.status(400).json({ error: "from date must be before to date" });
  }
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }

  const items = await AlbumPurchase.find(filter)
    .sort({ createdAt: -1 })
    .populate("userId", "name phone email avatarUrl purchasedAlbumIds");
  res.json(items);
}

async function approveAlbumPurchase(req, res) {
  const item = await AlbumPurchase.findById(req.params.id);
  if (!item) return res.status(404).json({ error: "Payment request not found" });
  if (item.status !== "pending") {
    return res.status(400).json({ error: `Payment request is already ${item.status}` });
  }

  const album = await Album.findById(item.albumId);
  if (!album) return res.status(400).json({ error: "The requested album no longer exists" });

  const user = await User.findById(item.userId);
  if (!user) return res.status(400).json({ error: "The requesting user no longer exists" });

  if (!Array.isArray(user.purchasedAlbumIds)) user.purchasedAlbumIds = [];
  user.purchasedAlbumIds.addToSet(album._id);
  user.lastPaymentAt = new Date();
  user.lastPaymentAmount = item.amount;
  await user.save();

  item.status = "approved";
  item.reviewNote = String(req.body?.reviewNote || "").trim();
  item.reviewedAt = new Date();
  item.reviewedBy = String(req.body?.reviewedBy || "admin").trim();
  await item.save();

  res.json(item);
}

async function revertAlbumPurchase(req, res) {
  const item = await AlbumPurchase.findById(req.params.id);
  if (!item) return res.status(404).json({ error: "Payment request not found" });
  if (item.status !== "approved") {
    return res.status(400).json({ error: `Payment request is already ${item.status}` });
  }

  const competingPending = await AlbumPurchase.exists({
    _id: { $ne: item._id },
    userId: item.userId,
    albumId: item.albumId,
    status: "pending",
  });
  if (competingPending) {
    return res.status(409).json({
      error: "Another payment request for this album is already pending",
      code: "PURCHASE_PENDING",
    });
  }

  const previousReview = {
    status: item.status,
    reviewNote: item.reviewNote,
    reviewedAt: item.reviewedAt,
    reviewedBy: item.reviewedBy,
  };
  item.status = "pending";
  item.reviewNote = "";
  item.reviewedAt = null;
  item.reviewedBy = "";

  try {
    await item.save();
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        error: "Another payment request for this album is already pending",
        code: "PURCHASE_PENDING",
      });
    }
    throw err;
  }

  const user = await User.findById(item.userId);
  if (!user) {
    item.status = previousReview.status;
    item.reviewNote = previousReview.reviewNote;
    item.reviewedAt = previousReview.reviewedAt;
    item.reviewedBy = previousReview.reviewedBy;
    await item.save();
    return res.status(400).json({ error: "The requesting user no longer exists" });
  }

  try {
    const stillApproved = await AlbumPurchase.exists({
      _id: { $ne: item._id },
      userId: item.userId,
      albumId: item.albumId,
      status: "approved",
    });

    if (!stillApproved && Array.isArray(user.purchasedAlbumIds)) {
      user.purchasedAlbumIds.pull(item.albumId);
    }

    const latestApproved = await AlbumPurchase.findOne({
      userId: item.userId,
      status: "approved",
    }).sort({ reviewedAt: -1, createdAt: -1 });
    user.lastPaymentAt = latestApproved
      ? latestApproved.reviewedAt || latestApproved.createdAt
      : null;
    user.lastPaymentAmount = latestApproved ? latestApproved.amount : null;

    await user.save();
  } catch (err) {
    item.status = previousReview.status;
    item.reviewNote = previousReview.reviewNote;
    item.reviewedAt = previousReview.reviewedAt;
    item.reviewedBy = previousReview.reviewedBy;
    await item.save();
    throw err;
  }

  res.json(item);
}

async function rejectAlbumPurchase(req, res) {
  const item = await AlbumPurchase.findById(req.params.id);
  if (!item) return res.status(404).json({ error: "Payment request not found" });
  if (item.status !== "pending") {
    return res.status(400).json({ error: `Payment request is already ${item.status}` });
  }

  item.status = "rejected";
  item.reviewNote = String(req.body?.reviewNote || "").trim();
  item.reviewedAt = new Date();
  item.reviewedBy = String(req.body?.reviewedBy || "admin").trim();
  await item.save();

  res.json(item);
}

async function deleteAlbumPurchase(req, res) {
  const item = await AlbumPurchase.findById(req.params.id);
  if (!item) return res.status(404).json({ error: "Payment request not found" });
  if (!["approved", "rejected"].includes(item.status)) {
    return res.status(400).json({
      error: "Only approved or rejected payment history can be deleted",
    });
  }

  await AlbumPurchase.deleteOne({ _id: item._id });
  const screenshotRemoved = await minioRemoveObject(item.screenshotUrl)
    .then(() => true)
    .catch(() => false);

  res.json({ deleted: true, screenshotRemoved });
}

async function deleteAlbumPurchaseHistory(req, res) {
  const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const ids = [
    ...new Set(
      rawIds
        .map((id) => String(id))
        .filter((id) => mongoose.isValidObjectId(id))
    ),
  ];
  if (!ids.length) {
    return res.status(400).json({ error: "No valid payment records were selected" });
  }

  const items = await AlbumPurchase.find({
    _id: { $in: ids },
    status: { $in: ["approved", "rejected"] },
  }).select("_id screenshotUrl");

  const deletableIds = items.map((item) => item._id);
  if (!deletableIds.length) {
    return res.json({
      deletedCount: 0,
      skippedCount: ids.length,
      screenshotCleanupFailures: 0,
    });
  }

  await AlbumPurchase.deleteMany({ _id: { $in: deletableIds } });
  const cleanupResults = await Promise.allSettled(
    items.map((item) => minioRemoveObject(item.screenshotUrl))
  );

  res.json({
    deletedCount: deletableIds.length,
    skippedCount: ids.length - deletableIds.length,
    screenshotCleanupFailures: cleanupResults.filter(
      (result) => result.status === "rejected"
    ).length,
  });
}

module.exports = {
  createAlbumPurchase,
  listMyAlbumPurchases,
  listAlbumPurchases,
  adminAlbumSales,
  approveAlbumPurchase,
  rejectAlbumPurchase,
  revertAlbumPurchase,
  deleteAlbumPurchase,
  deleteAlbumPurchaseHistory,
};
