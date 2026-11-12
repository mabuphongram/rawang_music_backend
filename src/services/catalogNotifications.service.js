const { isPushConfigured, sendBroadcastSafely } = require("./push.service");

function clip(value, maxLength) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function send(notification) {
  if (!isPushConfigured()) return;
  sendBroadcastSafely(notification);
}

function notifyAlbumCreated(album) {
  send({
    title: `New album: ${clip(album.title, 80)}`,
    body: `${clip(album.ownerName, 80)} just added a new album.`,
    data: { type: "album", id: String(album._id) },
  });
}

function notifyTrackCreated(track) {
  send({
    title: `New song: ${clip(track.title, 80)}`,
    body: `${clip(track.artistName, 80)} • ${clip(track.albumName, 100)}`,
    data: { type: "track", id: String(track._id) },
  });
}

function notifySingerCreated(singer) {
  send({
    title: `New singer: ${clip(singer.name, 80)}`,
    body: "A new artist is now on Rawang Melodies.",
    data: { type: "singer", id: String(singer._id) },
  });
}

module.exports = {
  notifyAlbumCreated,
  notifyTrackCreated,
  notifySingerCreated,
};
