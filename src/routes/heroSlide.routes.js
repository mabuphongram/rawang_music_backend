const express = require("express");
const upload = require("../middleware/upload");
const {
  listHeroSlides,
  getHeroSlide,
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
} = require("../controllers/heroSlide.controller");

const router = express.Router();

router.get("/", listHeroSlides);
router.get("/:id", getHeroSlide);
router.post("/", upload.single("image"), createHeroSlide);
router.put("/:id", upload.single("image"), updateHeroSlide);
router.delete("/:id", deleteHeroSlide);

module.exports = router;
