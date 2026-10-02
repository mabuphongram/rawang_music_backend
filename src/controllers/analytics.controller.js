const mongoose = require("mongoose");
const PlayEvent = require("../models/PlayEvent");
const OwnerClaim = require("../models/OwnerClaim");
const { OWNER_POOL_PERCENT, PLATFORM_PERCENT } = require("../config/business");

// Owners see ONLY profiles with an approved claim linking their login.
// Anonymous plays are reported separately as platform (unattributed) share.
async function requireClaimAccess(req, ownerModel, ownerId) {
  if (ownerModel !== "Singer" && ownerModel !== "Organization") {
    return { error: "ownerModel must be Singer or Organization", status: 400 };
  }
  let oid;
  try {
    oid = new mongoose.Types.ObjectId(ownerId);
  } catch {
    return { error: "Invalid ownerId", status: 400 };
  }
  const claim = await OwnerClaim.findOne({
    ownerModel,
    ownerId: oid,
    userId: req.user._id,
    status: "approved",
  });
  if (!claim) {
    return { error: "No approved claim for this profile", status: 403 };
  }
  return { oid };
}

function monthRange(month) {
  // month: "YYYY-MM", default current UTC month
  let y, m;
  if (/^\d{4}-\d{2}$/.test(month || "")) {
    [y, m] = month.split("-").map(Number);
  } else {
    const now = new Date();
    y = now.getUTCFullYear();
    m = now.getUTCMonth() + 1;
  }
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  return { from, to, key: `${y}-${String(m).padStart(2, "0")}` };
}

function dateRange(from, to) {
  const now = new Date();
  const end = to && /^\d{4}-\d{2}-\d{2}$/.test(to)
    ? new Date(`${to}T23:59:59.999Z`)
    : now;
  const start = from && /^\d{4}-\d{2}-\d{2}$/.test(from)
    ? new Date(`${from}T00:00:00.000Z`)
    : new Date(end.getTime() - 29 * 86400000);
  return { from: start, to: end };
}

async function ownerSummary(req, res) {
  const { ownerModel, ownerId, month } = req.query;
  const access = await requireClaimAccess(req, ownerModel, ownerId);
  if (access.error) return res.status(access.status).json({ error: access.error });

  const { from, to, key } = monthRange(month);
  const base = { playedAt: { $gte: from, $lt: to } };

  // Attributed = plays snapped to a real owner profile (manual per-track
  // attribution included). Everything else — anonymous or detached tracks —
  // is platform (unattributed) share, shown openly.
  const [mine, attributed, total, listeners] = await Promise.all([
    PlayEvent.countDocuments({ ...base, ownerId: access.oid }),
    PlayEvent.countDocuments({ ...base, ownerId: { $ne: null } }),
    PlayEvent.countDocuments(base),
    PlayEvent.distinct("userId", { ...base, ownerId: access.oid }),
  ]);
  const anonymous = total - attributed;

  const sharePct = attributed > 0 ? (mine / attributed) * 100 : 0;
  res.json({
    month: key,
    plays: mine,
    uniqueListeners: listeners.length,
    attributedTotal: attributed,
    anonymousPlays: anonymous,
    sharePct: Math.round(sharePct * 100) / 100,
    ownerPoolPercent: OWNER_POOL_PERCENT,
    platformPercent: PLATFORM_PERCENT,
  });
}

async function ownerDaily(req, res) {
  const { ownerModel, ownerId, from, to } = req.query;
  const access = await requireClaimAccess(req, ownerModel, ownerId);
  if (access.error) return res.status(access.status).json({ error: access.error });

  const { from: start, to: end } = dateRange(from, to);
  const rows = await PlayEvent.aggregate([
    { $match: { ownerId: access.oid, playedAt: { $gte: start, $lte: end } } },
    { $group: { _id: "$day", plays: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, day: "$_id", plays: 1 } },
  ]);
  res.json(rows);
}

async function ownerTopTracks(req, res) {
  const { ownerModel, ownerId, from, to, limit } = req.query;
  const access = await requireClaimAccess(req, ownerModel, ownerId);
  if (access.error) return res.status(access.status).json({ error: access.error });

  const { from: start, to: end } = dateRange(from, to);
  const n = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const rows = await PlayEvent.aggregate([
    { $match: { ownerId: access.oid, playedAt: { $gte: start, $lte: end } } },
    { $group: { _id: "$trackId", plays: { $sum: 1 } } },
    { $sort: { plays: -1 } },
    { $limit: n },
    {
      $lookup: {
        from: "tracks",
        localField: "_id",
        foreignField: "_id",
        as: "track",
      },
    },
    { $unwind: { path: "$track", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        trackId: "$_id",
        plays: 1,
        title: "$track.title",
        artistName: "$track.artistName",
      },
    },
  ]);
  res.json(rows);
}

module.exports = { ownerSummary, ownerDaily, ownerTopTracks };
