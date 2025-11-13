const express = require("express");
const router = express.Router();
const { authCheck } = require("../middlewares/authCheck");
const { getCart, syncCart } = require("../controllers/cart");

router.get("/cart", authCheck, getCart);
router.post("/cart/sync", authCheck, syncCart);

module.exports = router;
