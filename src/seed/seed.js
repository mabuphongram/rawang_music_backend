require("dotenv").config();

const Album = require("../models/Album");
const Track = require("../models/Track");
const Playlist = require("../models/Playlist");
const ChatMessage = require("../models/ChatMessage");
const Singer = require("../models/Singer");
const Organization = require("../models/Organization");
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
    try {
      await Singer.collection.drop();
    } catch (err) {
      if (err.code !== 26) throw err;
    }
    try {
      await Organization.collection.drop();
    } catch (err) {
      if (err.code !== 26) throw err;
    }
    console.log("✅ Cleared collections");

    // Extract unique owners and create Singers/Organizations
    const singerDocs = {};
    const orgDocs = {};
    
    for (const album of seedData.albums) {
      if (album.ownerType === "singer" && !singerDocs[album.ownerName]) {
        singerDocs[album.ownerName] = await Singer.create({ name: album.ownerName });
      } else if (album.ownerType === "organization" && !orgDocs[album.ownerName]) {
        orgDocs[album.ownerName] = await Organization.create({ name: album.ownerName });
      }
    }
    console.log(`✅ Created Singers and Organizations`);

    // Prepare albums with ownerId and ownerModel
    const preparedAlbums = seedData.albums.map((album) => {
      let ownerId = null;
      let ownerModel = null;
      if (album.ownerType === "singer") {
        ownerId = singerDocs[album.ownerName]._id;
        ownerModel = "Singer";
      } else if (album.ownerType === "organization") {
        ownerId = orgDocs[album.ownerName]._id;
        ownerModel = "Organization";
      }
      return { ...album, ownerId, ownerModel };
    });

    // Insert albums
    const albums = await Album.insertMany(preparedAlbums);
    console.log(`✅ Inserted ${albums.length} albums`);

    // Insert tracks with album refs
    const tracks = [];
    for (const trackData of seedData.tracksWithAlbumRef) {
      const albumId = albums[trackData.albumIndex]._id;
      const trackDoc = await Track.create({ ...trackData, albumId });
      tracks.push(trackDoc);
    }
    console.log(`✅ Inserted ${tracks.length} tracks`);

    // Create playlists
    const playlists = [];
    for (const playlistData of seedData.playlists) {
      const playlistDoc = await Playlist.create(playlistData);
      playlists.push(playlistDoc);
    }
    console.log(`✅ Inserted ${playlists.length} playlists with tracks`);

    // Insert chat messages
    const messages = [];
    for (const msgData of seedData.chatMessages) {
      const msgDoc = await ChatMessage.create(msgData);
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
