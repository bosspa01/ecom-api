const prisma = require("../config/prisma");
const { logAdminActionDetailed } = require('../utils/adminLog');

exports.listUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        enabled: true,
        address: true,
        createdAt: true,
      },
    });
    res.send(users);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};

exports.changeStatus = async (req, res) => {
  try {
    const { id, enabled } = req.body;
    // Prevent changing status of superadmin by non-superadmin
    const target = await prisma.user.findUnique({ where: { id: Number(id) } });
    if (!target) return res.status(404).json({ message: 'User not found' });
    const actor = await prisma.user.findUnique({ where: { id: Number(req.user.id) } });
    if (target.role === 'superadmin' && actor.role !== 'superadmin') {
      return res.status(403).json({ message: 'Cannot modify superadmin status' });
    }
    const before = await prisma.user.findUnique({ where: { id: Number(id) } });
    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: { enabled: enabled },
    });

    await logAdminActionDetailed(req, {
      action: 'CHANGE_STATUS',
      entityType: 'USER',
      entityId: Number(id),
      before,
      after: user,
    });

    res.send("updete status success");
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};

exports.changeRole = async (req, res) => {
  try {
    const { id, role } = req.body;
    const target = await prisma.user.findUnique({ where: { id: Number(id) } });
    if (!target) return res.status(404).json({ message: 'User not found' });
    const actor = await prisma.user.findUnique({ where: { id: Number(req.user.id) } });
    // Disallow changing superadmin's role unless actor is superadmin modifying self
    if (target.role === 'superadmin' && (actor.id !== target.id)) {
      return res.status(403).json({ message: 'Cannot change superadmin role' });
    }
    // Disallow assigning superadmin unless actor is superadmin
    if (role === 'superadmin' && actor.role !== 'superadmin') {
      return res.status(403).json({ message: 'Only superadmin can assign superadmin role' });
    }
    const before = await prisma.user.findUnique({ where: { id: Number(id) } });
    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: { role: role },
    });

    await logAdminActionDetailed(req, {
      action: 'CHANGE_ROLE',
      entityType: 'USER',
      entityId: Number(id),
      before,
      after: user,
    });

    res.send("updete role success");
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};

exports.userCart = async (req, res) => {
  try {
    const { cart } = req.body;
    console.log(cart);
    console.log(req.user.id);

    const user = await prisma.user.findFirst({
      where: { id: Number(req.user.id) },
    });

     //check quantity
    for (const item of cart) {
      const product = await prisma.product.findUnique({
        where: { id: item.id },
        select: { quantity: true, title: true },
      });
      if (!product || item.count > product.quantity) {
        return res.status(400).json({
          ok: false,
          message: `สินค้า ${product?.title || "product"} มีจำนวนไม่เพียงพอ`,
        });
      }
    }





    // Delete old cart items
    await prisma.productOnCart.deleteMany({
      where: {
        cart: {
          orderedById: user.id,
        },
      },
    });

    // delete old cart
    await prisma.cart.deleteMany({
      where: {
        orderedById: user.id,
      },
    });

    //เตรียมสินค้า
    let products = cart.map((item) => ({
      productId: item.id,
      count: item.count,
      price: item.price,
    }));

    // หาผลรวม
    let cartTotal = products.reduce(
      (sum, item) => sum + item.price * item.count,
      0
    );

    // สร้าง cart ใหม่
    const newCart = await prisma.cart.create({
      data: {
        products: {
          create: products,
        },
        cartTotal: cartTotal,
        orderedById: user.id,
      },
    });
    console.log(newCart);
    res.send("add cart success");
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};

exports.getUserCart = async (req, res) => {
  try {
    const cart = await prisma.cart.findFirst({
      where: {
        orderedById: Number(req.user.id),
      },
      include: {
        products: {
          include: {
            product: true,
          },
        },
      },
    });
    res.json({ products: cart.products, cartTotal: cart.cartTotal });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};

exports.emptyCart = async (req, res) => {
  try {
    const cart = await prisma.cart.findFirst({
      where: {
        orderedById: Number(req.user.id),
      },
    });
    if (!cart) {
      return res.status(400).json({ message: "No cart found" });
    }
    await prisma.productOnCart.deleteMany({
      where: {
        cartId: cart.id,
      },
    });
    const result = await prisma.cart.deleteMany({
      where: {
        orderedById: Number(req.user.id),
      },
    });

    console.log(result);
    res.json({
      message: "Cart emptied successfully",
      deletedCount: result.count,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};

exports.saveAddress = async (req, res) => {
  try {
    const addressData = req.body;
    console.log(addressData);
    
    // Validate required fields
    const requiredFields = ['recipientName', 'phone', 'houseNumber', 'district', 'province', 'postalCode'];
    const missingFields = requiredFields.filter(field => !addressData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        ok: false, 
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }
    
    const addressUser = await prisma.user.update({
      where: { id: Number(req.user.id) },
      data: { address: addressData }, // Store as JSON
    });
    res.json({ ok: true, message: "Address updated successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};

exports.saveOrder = async (req, res) => {
  try {

    const { id,amount, status, currency } = req.body.paymentIntent;
    const { couponId, shippingMethod } = req.body;

    //get user cart
    const userCart = await prisma.cart.findFirst({
      where: {
        orderedById: Number(req.user.id),
      },
      include: { products: true },
    });

    //check cart empty
    if (!userCart || userCart.products.length === 0) {
      return res.status(400).json({ ok: false, message: "Cart is empty" });
    }

    const amountTHB = Number(amount) / 100

    // Import shipping helper
    const { getShippingCost } = require('../constants/shipping');
    
    // Calculate shipping cost
    const shippingCost = getShippingCost(shippingMethod || 'bangkok_standard');

    // Prepare order data
    const orderData = {
      products: {
        create: userCart.products.map((item) => ({
          productId: item.productId,
          count: item.count,
          price: item.price,
        })),
      },
      orderedBy: {
        connect: { id: req.user.id },
      },
      cartTotal: userCart.cartTotal,
      stripePaymentId: id,
      amount: Number(amount),
      status: status,
      currency: currency,
      shippingMethod: shippingMethod || 'bangkok_standard',
      shippingCost: shippingCost,
    };

    // Add coupon if provided
    if (couponId) {
      orderData.coupon = {
        connect: { id: Number(couponId) },
      };
    }

    //create new order
    const order = await prisma.order.create({
      data: orderData,
    });

    // Increment coupon usage if coupon was used
    if (couponId) {
      await prisma.saleCoupon.update({
        where: { id: Number(couponId) },
        data: {
          currentUses: { increment: 1 },
        },
      });
    }

    //update product
    const update = userCart.products.map((item) => ({
      where: { id: item.productId },
      data: {
        quantity: { decrement: item.count },
        sold: { increment: item.count },
      },
    }));
    console.log(update);

    await Promise.all(update.map((updated) => prisma.product.update(updated)));

    await prisma.cart.deleteMany({
      where: {
        orderedById: Number(req.user.id),
      },
    });

    res.json({ ok: true, order });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { orderedById: Number(req.user.id) },
      include: {
        products: {
          include: {
            product: true,
          },
        },
        coupon: {
          select: {
            id: true,
            couponCode: true,
            discountType: true,
            discountValue: true,
          },
        },
        orderedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            address: true,
          },
        },
      },
    });
    if (orders.length === 0) {
      return res.status(400).json({ ok: false, message: "No orders found" });
    }
    res.json({ ok: true, orders });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};
