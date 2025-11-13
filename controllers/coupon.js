const prisma = require("../config/prisma");
const { logAdminActionDetailed } = require('../utils/adminLog');

// Validate coupon code for user
exports.validateCoupon = async (req, res) => {
  try {
    const { couponCode, cartTotal } = req.body;

    if (!couponCode) {
      return res.status(400).json({ ok: false, message: "Coupon code is required" });
    }

    // Find coupon by code
    const coupon = await prisma.saleCoupon.findUnique({
      where: { couponCode: couponCode.toUpperCase() },
    });

    if (!coupon) {
      return res.status(404).json({ ok: false, message: "Invalid coupon code" });
    }

    // Check if coupon is active
    if (coupon.status !== "active") {
      return res.status(400).json({ ok: false, message: "Coupon is not active" });
    }

    // Check if coupon has expired
    const now = new Date();
    if (new Date(coupon.expirationDate) < now) {
      return res.status(400).json({ ok: false, message: "Coupon has expired" });
    }

    // Check if coupon has reached max uses
    if (coupon.currentUses >= coupon.maxUses) {
      return res.status(400).json({ ok: false, message: "Coupon has reached maximum uses" });
    }

    // Check minimum order amount if specified
    if (coupon.minimumOrderAmount && cartTotal < coupon.minimumOrderAmount) {
      return res.status(400).json({
        ok: false,
        message: `Minimum order amount of $${coupon.minimumOrderAmount} required`,
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      discountAmount = (cartTotal * coupon.discountValue) / 100;
    } else if (coupon.discountType === "fixed_amount") {
      discountAmount = coupon.discountValue;
    }

    // Ensure discount doesn't exceed cart total
    if (discountAmount > cartTotal) {
      discountAmount = cartTotal;
    }

    const finalTotal = Math.max(0, cartTotal - discountAmount);

    res.json({
      ok: true,
      coupon: {
        id: coupon.id,
        couponCode: coupon.couponCode,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: discountAmount,
        finalTotal: finalTotal,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};

// Create new coupon (Admin only)
exports.createCoupon = async (req, res) => {
  try {
    const {
      couponCode,
      description,
      discountType,
      discountValue,
      maxUses,
      expirationDate,
      minimumOrderAmount,
      status,
    } = req.body;

    // Validate required fields
    if (!couponCode || !discountType || !discountValue || !maxUses || !expirationDate) {
      return res.status(400).json({ ok: false, message: "Missing required fields" });
    }

    // Validate discount type
    if (discountType !== "percentage" && discountType !== "fixed_amount") {
      return res.status(400).json({ ok: false, message: "Invalid discount type" });
    }

    // Validate discount value
    if (discountType === "percentage" && (discountValue < 0 || discountValue > 100)) {
      return res.status(400).json({ ok: false, message: "Percentage must be between 0 and 100" });
    }

    if (discountType === "fixed_amount" && discountValue < 0) {
      return res.status(400).json({ ok: false, message: "Fixed amount must be positive" });
    }

    // Check if coupon code already exists
    const existingCoupon = await prisma.saleCoupon.findUnique({
      where: { couponCode: couponCode.toUpperCase() },
    });

    if (existingCoupon) {
      return res.status(400).json({ ok: false, message: "Coupon code already exists" });
    }

    // Create coupon
    const coupon = await prisma.saleCoupon.create({
      data: {
        couponCode: couponCode.toUpperCase(),
        description: description || null,
        discountType,
        discountValue: Number(discountValue),
        maxUses: Number(maxUses),
        currentUses: 0,
        expirationDate: new Date(expirationDate),
        minimumOrderAmount: minimumOrderAmount ? Number(minimumOrderAmount) : null,
        status: status || "active",
      },
    });

    await logAdminActionDetailed(req, {
      action: 'CREATE_COUPON',
      entityType: 'COUPON',
      entityId: coupon.id,
      before: null,
      after: coupon,
    });

    res.json({ ok: true, coupon });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};

// Get all coupons (Admin only)
exports.getAllCoupons = async (req, res) => {
  try {
    const coupons = await prisma.saleCoupon.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        orders: {
          select: { id: true },
        },
      },
    });

    res.json({ ok: true, coupons });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};

// Update coupon (Admin only)
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      couponCode,
      description,
      discountType,
      discountValue,
      maxUses,
      expirationDate,
      minimumOrderAmount,
      status,
    } = req.body;

    // Check if coupon exists
    const existingCoupon = await prisma.saleCoupon.findUnique({
      where: { id: Number(id) },
    });

    if (!existingCoupon) {
      return res.status(404).json({ ok: false, message: "Coupon not found" });
    }

    // If coupon code is being changed, check if new code already exists
    if (couponCode && couponCode.toUpperCase() !== existingCoupon.couponCode) {
      const codeExists = await prisma.saleCoupon.findUnique({
        where: { couponCode: couponCode.toUpperCase() },
      });

      if (codeExists) {
        return res.status(400).json({ ok: false, message: "Coupon code already exists" });
      }
    }

    // Update coupon
    const updateData = {};
    if (couponCode) updateData.couponCode = couponCode.toUpperCase();
    if (description !== undefined) updateData.description = description;
    if (discountType) updateData.discountType = discountType;
    if (discountValue !== undefined) updateData.discountValue = Number(discountValue);
    if (maxUses !== undefined) updateData.maxUses = Number(maxUses);
    if (expirationDate) updateData.expirationDate = new Date(expirationDate);
    if (minimumOrderAmount !== undefined) updateData.minimumOrderAmount = minimumOrderAmount ? Number(minimumOrderAmount) : null;
    if (status) updateData.status = status;

    const coupon = await prisma.saleCoupon.update({
      where: { id: Number(id) },
      data: updateData,
    });

    await logAdminActionDetailed(req, {
      action: 'UPDATE_COUPON',
      entityType: 'COUPON',
      entityId: coupon.id,
      before: existingCoupon,
      after: coupon,
    });

    res.json({ ok: true, coupon });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};

// Delete coupon (Admin only)
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await prisma.saleCoupon.findUnique({
      where: { id: Number(id) },
    });

    if (!coupon) {
      return res.status(404).json({ ok: false, message: "Coupon not found" });
    }

    const before = await prisma.saleCoupon.findUnique({ where: { id: Number(id) } });
    await prisma.saleCoupon.delete({
      where: { id: Number(id) },
    });

    await logAdminActionDetailed(req, {
      action: 'DELETE_COUPON',
      entityType: 'COUPON',
      entityId: Number(id),
      before,
      after: null,
    });

    res.json({ ok: true, message: "Coupon deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};

