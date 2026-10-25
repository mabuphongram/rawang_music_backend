const ADMIN_ROOM = "presence:admin";

const PLATFORMS = new Set([
  "android",
  "ios",
  "web",
  "windows",
  "macos",
  "linux",
  "unknown",
]);

const APPS = new Set(["flutter", "web", "admin", "unknown"]);
const ROLES = new Set(["user", "artist", "admin", "guest"]);
const STATUSES = new Set(["listening", "browsing", "idle"]);

let ioRef = null;
let flushTimer = null;

// socket.id -> presence entry
const sockets = new Map();

function text(value, max = 120) {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, max);
}

function pick(value, allowed, fallback) {
  const v = text(value, 32).toLowerCase();
  return allowed.has(v) ? v : fallback;
}

function platformFromUserAgent(ua) {
  const s = String(ua || "").toLowerCase();
  if (!s) return "unknown";
  if (/iphone|ipad|ipod/.test(s)) return "ios";
  if (/android/.test(s)) return "android";
  if (/windows/.test(s)) return "windows";
  if (/mac os|macintosh/.test(s)) return "macos";
  if (/linux/.test(s)) return "linux";
  return "web";
}

function sanitizeTrack(raw) {
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const title = text(raw.title, 160);
  if (!title) return null;
  return {
    id: text(raw.id, 80),
    title,
    artistName: text(raw.artistName, 120),
    albumName: text(raw.albumName, 160),
  };
}

function makeEntry(socket) {
  const now = new Date().toISOString();
  return {
    connectionId: socket.id,
    userId: null,
    name: "Guest",
    email: "",
    avatarUrl: "",
    role: "guest",
    platform: platformFromUserAgent(socket.handshake?.headers?.["user-agent"]),
    app: "unknown",
    appVersion: "",
    status: "browsing",
    currentTrack: null,
    isGuest: true,
    registered: false,
    connectedAt: now,
    lastSeen: now,
  };
}

function applyMeta(entry, raw) {
  if (!raw || typeof raw !== "object") return;
  if (raw.userId !== undefined) {
    entry.userId = text(raw.userId, 80) || null;
  }
  if (raw.name !== undefined) {
    entry.name = text(raw.name, 80) || "Guest";
  }
  if (raw.email !== undefined) {
    entry.email = text(raw.email, 160).toLowerCase();
  }
  if (raw.avatarUrl !== undefined) {
    entry.avatarUrl = text(raw.avatarUrl, 600);
  }
  if (raw.role !== undefined) {
    entry.role = pick(raw.role, ROLES, "user");
  }
  if (raw.platform !== undefined) {
    entry.platform = pick(raw.platform, PLATFORMS, entry.platform);
  }
  if (raw.app !== undefined) {
    entry.app = pick(raw.app, APPS, "unknown");
  }
  if (raw.appVersion !== undefined) {
    entry.appVersion = text(raw.appVersion, 40);
  }
  if (raw.status !== undefined) {
    entry.status = pick(raw.status, STATUSES, "browsing");
  }
  if (raw.currentTrack !== undefined) {
    entry.currentTrack = sanitizeTrack(raw.currentTrack);
  }

  entry.isGuest = !entry.userId;
  if (entry.isGuest && entry.role !== "admin") entry.role = "guest";
  if (!entry.isGuest && entry.role === "guest") entry.role = "user";
  if (!entry.isGuest && entry.name === "Guest") entry.name = "Listener";
  entry.lastSeen = new Date().toISOString();
}

function publicEntry(entry) {
  const {
    connectionId,
    userId,
    name,
    email,
    avatarUrl,
    role,
    platform,
    app,
    appVersion,
    status,
    currentTrack,
    isGuest,
    connectedAt,
    lastSeen,
  } = entry;
  return {
    connectionId,
    userId,
    name,
    email,
    avatarUrl,
    role,
    platform,
    app,
    appVersion,
    status,
    currentTrack,
    isGuest,
    connectedAt,
    lastSeen,
  };
}

function snapshot() {
  const users = Array.from(sockets.values())
    .filter((entry) => entry.registered)
    .sort(
      (a, b) =>
        new Date(b.connectedAt).getTime() - new Date(a.connectedAt).getTime()
    )
    .map(publicEntry);

  return {
    count: users.length,
    users,
    generatedAt: new Date().toISOString(),
  };
}

function broadcast() {
  if (!ioRef) return;
  const snap = snapshot();
  ioRef.to(ADMIN_ROOM).emit("presence:update", snap);
  // Existing clients listen for a plain number on this event.
  ioRef.emit("online_count", snap.count);
}

function scheduleBroadcast() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    broadcast();
  }, 120);
}

function adminKey() {
  return process.env.PRESENCE_ADMIN_KEY || "";
}

function socketCanWatch(socket) {
  const key = adminKey();
  if (!key) return true;
  const provided =
    socket.handshake?.auth?.adminKey || socket.handshake?.query?.adminKey;
  return provided === key;
}

function httpCanRead(req) {
  const key = adminKey();
  if (!key) return true;
  const provided = req.headers["x-presence-key"] || req.query?.key;
  return provided === key;
}

function attach(io) {
  ioRef = io;

  io.on("connection", (socket) => {
    sockets.set(socket.id, makeEntry(socket));

    const pushSelf = () => {
      const entry = sockets.get(socket.id);
      if (entry) socket.emit("presence:self", publicEntry(entry));
    };

    socket.on("presence:register", (meta) => {
      const entry = sockets.get(socket.id);
      if (!entry) return;
      applyMeta(entry, meta);
      entry.registered = true;
      pushSelf();
      scheduleBroadcast();
    });

    socket.on("presence:update", (meta) => {
      const entry = sockets.get(socket.id);
      if (!entry) return;
      applyMeta(entry, meta);
      entry.registered = true;
      scheduleBroadcast();
    });

    socket.on("presence:heartbeat", () => {
      const entry = sockets.get(socket.id);
      if (!entry) return;
      entry.lastSeen = new Date().toISOString();
    });

    // Admin portals join a private room so the live list is never broadcast
    // to listener apps. Watchers are not counted as listeners.
    socket.on("presence:watch", () => {
      if (!socketCanWatch(socket)) {
        socket.emit("presence:error", { error: "Unauthorized" });
        return;
      }
      socket.join(ADMIN_ROOM);
      socket.emit("presence:update", snapshot());
    });

    socket.on("disconnect", () => {
      sockets.delete(socket.id);
      scheduleBroadcast();
    });
  });
}

function getSnapshot() {
  return snapshot();
}

module.exports = { attach, getSnapshot, httpCanRead, ADMIN_ROOM };
