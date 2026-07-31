const Album = require("../models/Album");

async function listAlbums(req, res) {
  const filter = {};
  if (req.query.ownerType) filter.ownerType = req.query.ownerType;
  const albums = await Album.find(filter).sort({ createdAt: 1 });
  res.json(albums);
}

async function getAlbum(req, res) {
  const album = await Album.findById(req.params.id);
  if (!album) return res.status(404).json({ error: "Album not found" });
  res.json(album);
}

async function createAlbum(req, res) {
  const album = await Album.create(req.body);
  res.status(201).json(album);
}

async function updateAlbum(req, res) {
  const album = await Album.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!album) return res.status(404).json({ error: "Album not found" });
  res.json(album);
}

async function deleteAlbum(req, res) {
  const album = await Album.findByIdAndDelete(req.params.id);
  if (!album) return res.status(404).json({ error: "Album not found" });
  res.status(204).send();
}

module.exports = { listAlbums, getAlbum, createAlbum, updateAlbum, deleteAlbum };
