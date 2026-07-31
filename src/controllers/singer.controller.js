const Singer = require("../models/Singer");

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
  const singer = await Singer.create(req.body);
  res.status(201).json(singer);
}

async function updateSinger(req, res) {
  const singer = await Singer.findByIdAndUpdate(req.params.id, req.body, {
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
