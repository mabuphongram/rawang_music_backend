require("dotenv").config();

const Album = require("../models/Album");
const Track = require("../models/Track");
const Playlist = require("../models/Playlist");
const ChatMessage = require("../models/ChatMessage");
const connectDB = require("../config/db");
const seedData = require("./seedData");

async function seed() {
  try {
    await connectDB();
    console.log("✅ Connected to MongoDB");

    // Clear collections and drop indexes to avoid conflicts
    try {
      await Album.collection.drop();
    } catch (err) {
      if (err.code !== 26) throw err; // 26 = namespace not found
    }
    try {
      await Track.collection.drop();
    } catch (err) {
      if (err.code !== 26) throw err;
    }
    try {
      await Playlist.collection.drop();
    } catch (err) {
      if (err.code !== 26) throw err;
    }
    try {
      await ChatMessage.collection.drop();
    } catch (err) {
      if (err.code !== 26) throw err;
    }
    console.log("✅ Cleared collections");

    // Insert albums
    const albums = await Album.insertMany(seedData.albums);
    console.log(`✅ Inserted ${albums.length} albums`);

    // Insert tracks with album refs
    const tracks = [];
    for (const trackData of seedData.tracksWithAlbumRef) {
      const albumId = albums[trackData.albumIndex]._id;
      const trackDoc = await Track.create({ ...trackData, albumId });
      tracks.push(trackDoc);
    }
    console.log(`✅ Inserted ${tracks.length} tracks`);

    // Create playlists and link tracks
    const playlists = [];
    for (const playlistData of seedData.playlists) {
      let trackIds = [];

      if (playlistData.name === "Cultural Favorites") {
        // Add all favorite tracks
        trackIds = tracks.filter((t) => t.isFavorite).map((t) => t._id);
      } else if (playlistData.name === "Offline Mountain Journey") {
        // Add all downloaded tracks
        trackIds = tracks.filter((t) => t.isDownloaded).map((t) => t._id);
      }

      const playlistDoc = await Playlist.create({ ...playlistData, trackIds });
      playlists.push(playlistDoc);
    }
    console.log(`✅ Inserted ${playlists.length} playlists with tracks`);

    // Insert chat messages with track refs
    const trackMap = Object.fromEntries(tracks.map((t) => [t.title, t._id]));
    const messages = [];
    for (const msgData of seedData.chatMessages) {
      let attachedTrackId = null;
      if (msgData.attachedTrackTitle && trackMap[msgData.attachedTrackTitle]) {
        attachedTrackId = trackMap[msgData.attachedTrackTitle];
      }
      const msgDoc = await ChatMessage.create({ ...msgData, attachedTrackId });
      messages.push(msgDoc);
    }
    console.log(`✅ Inserted ${messages.length} chat messages`);

    console.log("✅ Seed completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
    process.exit(1);
  }
}

seed();
