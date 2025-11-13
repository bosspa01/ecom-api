const express = require("express");
const router = express.Router();
const { authCheck, adminCheck } = require("../middlewares/authCheck");
const {
  validateCoupon,
  createCoupon,
  getAllCoupons,
  updateCoupon,
  deleteCoupon,
} = require("../controllers/coupon");

// User routes
router.post("/user/validate-coupon", authCheck, validateCoupon);

// Admin routes
router.post("/admin/coupon", authCheck, adminCheck, createCoupon);
router.get("/admin/coupons", authCheck, adminCheck, getAllCoupons);
router.put("/admin/coupon/:id", authCheck, adminCheck, updateCoupon);
router.delete("/admin/coupon/:id", authCheck, adminCheck, deleteCoupon);

module.exports = router;

