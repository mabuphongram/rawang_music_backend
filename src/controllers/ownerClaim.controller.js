const OwnerClaim = require("../models/OwnerClaim");
const Singer = require("../models/Singer");
const Organization = require("../models/Organization");
const User = require("../models/User");

function profileModel(name) {
  if (name === "Singer") return Singer;
  if (name === "Organization") return Organization;
  return null;
}

async function requestClaim(req, res) {
  const { ownerModel, ownerId } = req.body;
  const Model = profileModel(ownerModel);
  if (!Model || !ownerId) {
    return res.status(400).json({ error: "ownerModel (Singer|Organization) and ownerId are required" });
  }
  const profile = await Model.findById(ownerId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const taken = await OwnerClaim.findOne({ ownerModel, ownerId, status: "approved" });
  if (taken) return res.status(400).json({ error: "This profile is already claimed" });

  const mine = await OwnerClaim.findOne({ ownerModel, ownerId, userId: req.user._id });
  if (mine) {
    return res.status(400).json({ error: `You already have a ${mine.status} claim for this profile` });
  }

  const claim = await OwnerClaim.create({ ownerModel, ownerId, userId: req.user._id });
  res.status(201).json(claim);
}

async function listClaims(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.mine === "1" || req.query.mine === "true") {
    if (!req.user) return res.status(401).json({ error: "Missing token" });
    filter.userId = req.user._id;
  }
  const claims = await OwnerClaim.find(filter).sort({ createdAt: -1 });
  res.json(claims);
}

async function approveClaim(req, res) {
  const claim = await OwnerClaim.findById(req.params.id);
  if (!claim) return res.status(404).json({ error: "Claim not found" });
  if (claim.status !== "pending") {
    return res.status(400).json({ error: `Claim is already ${claim.status}` });
  }
  const taken = await OwnerClaim.findOne({
    ownerModel: claim.ownerModel,
    ownerId: claim.ownerId,
    status: "approved",
  });
  if (taken) return res.status(400).json({ error: "This profile is already claimed" });

  claim.status = "approved";
  claim.reviewNote = (req.body?.reviewNote || "").trim();
  claim.reviewedAt = new Date();
  await claim.save();

  // Rival pending requests for the same profile are closed out.
  await OwnerClaim.updateMany(
    { _id: { $ne: claim._id }, ownerModel: claim.ownerModel, ownerId: claim.ownerId, status: "pending" },
    { $set: { status: "rejected", reviewNote: "Profile claimed by another user", reviewedAt: new Date() } }
  );

  // Claimants act as merchants: lift plain users to the artist role.
  await User.updateOne(
    { _id: claim.userId, role: "user" },
    { $set: { role: "artist" } }
  );

  res.json(claim);
}

async function rejectClaim(req, res) {
  const claim = await OwnerClaim.findById(req.params.id);
  if (!claim) return res.status(404).json({ error: "Claim not found" });
  if (claim.status !== "pending") {
    return res.status(400).json({ error: `Claim is already ${claim.status}` });
  }
  claim.status = "rejected";
  claim.reviewNote = (req.body?.reviewNote || "").trim();
  claim.reviewedAt = new Date();
  await claim.save();
  res.json(claim);
}

module.exports = { requestClaim, listClaims, approveClaim, rejectClaim };
