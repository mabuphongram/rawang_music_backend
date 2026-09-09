const HeroSlide = require("../models/HeroSlide");
const { minioUpload } = require("../utils/minioUpload.util");

async function uploadSlideImage(slide, file) {
  if (!file) return;

  slide.imageUrl = await minioUpload(
    `hero-slides/${slide._id}`,
    file,
    "cover"
  );
}

async function listHeroSlides(req, res) {
  const filter = {};
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === "true";
  }
  const slides = await HeroSlide.find(filter).sort({ order: 1, createdAt: 1 });
  res.json(slides);
}

async function getHeroSlide(req, res) {
  const slide = await HeroSlide.findById(req.params.id);
  if (!slide) return res.status(404).json({ error: "Hero slide not found" });
  res.json(slide);
}

async function createHeroSlide(req, res) {
  const slide = new HeroSlide(req.body);
  await slide.validate();
  await uploadSlideImage(slide, req.file);
  await slide.save();
  res.status(201).json(slide);
}

async function updateHeroSlide(req, res) {
  const slide = await HeroSlide.findById(req.params.id);
  if (!slide) return res.status(404).json({ error: "Hero slide not found" });

  slide.set(req.body);
  await slide.validate();
  await uploadSlideImage(slide, req.file);
  await slide.save();
  res.json(slide);
}

async function deleteHeroSlide(req, res) {
  const slide = await HeroSlide.findByIdAndDelete(req.params.id);
  if (!slide) return res.status(404).json({ error: "Hero slide not found" });
  res.status(204).send();
}

module.exports = { listHeroSlides, getHeroSlide, createHeroSlide, updateHeroSlide, deleteHeroSlide };
