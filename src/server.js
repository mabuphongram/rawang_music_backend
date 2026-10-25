const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

// Load the backend's configuration regardless of the directory from which the
// process was started. Values provided by Docker/the host still take priority.
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const app = require("./app");
const connectDB = require("./config/db");
const business = require("./config/business");
const presence = require("./realtime/presence");

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();

  // One-time migration: single albumId -> albumIds array (many-to-many).
  // Covers both missing and empty arrays (partial writes could leave []).
  try {
    const Track = require("./models/Track");
    const result = await Track.updateMany(
      { $or: [{ albumIds: { $exists: false } }, { albumIds: { $size: 0 } }] },
      [{ $set: { albumIds: ["$albumId"] } }]
    );
    if (result.modifiedCount > 0) {
      console.log(`🔄 Migrated ${result.modifiedCount} tracks to albumIds`);
    }
  } catch (err) {
    console.warn(`Track albumIds migration skipped: ${err.message}`);
  }

  // One-time migration: attach ownership (ownerId/ownerModel) from the
  // primary album. Anonymous albums yield null ownerId (platform share).
  try {
    const Track = require("./models/Track");
    const Album = require("./models/Album");
    const missing = await Track.find({
      $or: [{ ownerId: { $exists: false } }, { ownerId: null, ownerModel: { $exists: false } }],
    })
      .select("albumIds albumId")
      .lean();
    if (missing.length > 0) {
      const ids = [...new Set(missing.flatMap((t) => [...(t.albumIds || []), t.albumId].filter(Boolean).map(String)))];
      const albums = await Album.find({ _id: { $in: ids } }).select("ownerId ownerModel").lean();
      const byId = new Map(albums.map((a) => [String(a._id), a]));
      let done = 0;
      for (const t of missing) {
        const first = [...(t.albumIds || []), t.albumId].map(String).find((id) => byId.has(id));
        const a = first ? byId.get(first) : null;
        await Track.updateOne(
          { _id: t._id },
          { $set: { ownerId: a?.ownerId || null, ownerModel: a?.ownerModel || null } }
        );
        done++;
      }
      console.log(`🔄 Attached ownership to ${done} tracks`);
    }
  } catch (err) {
    console.warn(`Track ownership migration skipped: ${err.message}`);
  }

  // One-time migration: 3-year free trial for EVERYONE on the free plan.
  // Extends subscriptionExpiresAt to createdAt + TRIAL_YEARS and re-activates
  // status. Only ever extends (never shortens); paid plans untouched. After
  // the free period ends, users must pay — no free tier remains.
  // (Loop-based: this Mongoose version rejects pipeline-style updateMany.)
  try {
    const User = require("./models/User");
    const trialMs = business.TRIAL_YEARS * 365 * 24 * 60 * 60 * 1000;
    // Stored email:null values collide on the sparse unique index — unset them.
    await User.updateMany({ email: null }, { $unset: { email: "" } });
    const freeUsers = await User.find({ subscriptionPlan: "free" })
      .select("subscriptionExpiresAt subscriptionStatus createdAt")
      .lean();
    let done = 0;
    for (const u of freeUsers) {
      const target = new Date(new Date(u.createdAt).getTime() + trialMs);
      const current = u.subscriptionExpiresAt ? new Date(u.subscriptionExpiresAt) : null;
      if (!current || current < target || u.subscriptionStatus !== "active") {
        await User.updateOne(
          { _id: u._id },
          {
            $set: { subscriptionStatus: "active" },
            $max: { subscriptionExpiresAt: target },
          }
        );
        done++;
      }
    }
    if (done > 0) {
      console.log(`🔄 Extended ${done} free users to ${business.TRIAL_YEARS}y trial`);
    }
  } catch (err) {
    console.warn(`Free-trial migration skipped: ${err.message}`);
  }

  // Seed 3 sample YouTube videos (MTV) when the collection is empty.
  // Admin replaces these with real community videos from the portal.
  // IDs verified live via YouTube oEmbed.
  try {
    const Video = require("./models/Video");
    const count = await Video.countDocuments();
    if (count === 0) {
      await Video.insertMany([
        {
          title: "Sample MTV 1 — Big Buck Bunny (replace me)",
          description: "Sample video. Admin: replace with a community MTV from the portal.",
          youtubeVideoId: "aqz-KE-bpKQ",
          durationSeconds: 596,
          order: 0,
        },
        {
          title: "Sample MTV 2 — Gangnam Style (replace me)",
          description: "Sample video. Admin: replace with a community MTV from the portal.",
          youtubeVideoId: "9bZkp7q19f0",
          durationSeconds: 253,
          order: 1,
        },
        {
          title: "Sample MTV 3 — Me at the zoo (replace me)",
          description: "Sample video. Admin: replace with a community MTV from the portal.",
          youtubeVideoId: "jNQXAC9IVRw",
          durationSeconds: 19,
          order: 2,
        },
      ]);
      console.log(`🎬 Seeded 3 sample videos`);
    }
  } catch (err) {
    console.warn(`Video seed skipped: ${err.message}`);
  }
  
  const server = http.createServer(app);
  
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Make io accessible in controllers
  app.set("io", io);

  // ── Online presence tracking ─────────────────────────────────────────
  // Community chat still uses this room; presence registration is separate.
  io.on("connection", (socket) => {
    socket.join("rawang-community-chat");
  });

  // Tracks registered listeners, broadcasts the live count to all apps and
  // streams the full (sanitized) online list to admin portal watchers.
  presence.attach(io);

  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`💰 Royalty split — owners ${business.OWNER_POOL_PERCENT}% / platform ${business.PLATFORM_PERCENT}% (min payout ${business.MIN_PAYOUT_MMK} MMK, trial ${business.TRIAL_YEARS}y, grace ${business.GRACE_DAYS}d)`);
  });
}

start();
