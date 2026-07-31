const Singer = require("../models/Singer");
const { minioUpload } = require("../utils/minioUpload.util");

async function withAvatar(body, file) {
  if (!file) return body;
  const objectName = await minioUpload("singer", file);
  return { ...body, avatarUrl: objectName };
}

async function listSingers(req, res) {
  const singers = await Singer.find().sort({ createdAt: -1 });
  res.json(singers);
}

async function getSinger(req, res) {
  const singer = await Singer.findById(req.params.id);
  if (!singer) return res.status(404).json({ error: "Singer not found" });
  res.json(singer);
}

async function createSinger(req, res) {
  const singer = await Singer.create(await withAvatar(req.body, req.file));
  res.status(201).json(singer);
}

async function updateSinger(req, res) {
  const singer = await Singer.findByIdAndUpdate(req.params.id, await withAvatar(req.body, req.file), {
    new: true,
    runValidators: true,
  });
  if (!singer) return res.status(404).json({ error: "Singer not found" });
  res.json(singer);
}

async function deleteSinger(req, res) {
  const singer = await Singer.findByIdAndDelete(req.params.id);
  if (!singer) return res.status(404).json({ error: "Singer not found" });
  res.status(204).send();
}

module.exports = { listSingers, getSinger, createSinger, updateSinger, deleteSinger };
