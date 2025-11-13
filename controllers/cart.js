const prisma = require("../config/prisma");

// Ensure a single active cart per user; create if missing
const getOrCreateCartForUser = async (userId) => {
  let cart = await prisma.cart.findFirst({
    where: { orderedById: userId },
    include: {
      products: { include: { product: { include: { images: true, category: true } } } },
    },
  });
  if (!cart) {
    cart = await prisma.cart.create({
      data: {
        orderedBy: { connect: { id: userId } },
        cartTotal: 0,
      },
      include: {
        products: { include: { product: { include: { images: true, category: true } } } },
      },
    });
  }
  return cart;
};

// GET /api/cart - return current user's cart with items
exports.getCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const cart = await getOrCreateCartForUser(userId);

    const items = cart.products.map((poc) => ({
      id: poc.productId,
      count: poc.count,
      price: poc.price,
      title: poc.product.title,
      images: poc.product.images,
      categoryId: poc.product.categoryId,
    }));
    const cartTotal = items.reduce((sum, it) => sum + it.price * it.count, 0);

    return res.json({ ok: true, items, cartTotal });
  } catch (e) {
    console.error("getCart error", e);
    return res.status(500).json({ ok: false, message: "Failed to load cart" });
  }
};

// POST /api/cart/sync - replace items in user's cart
// body: { items: [{ id: productId, count: number }] }
exports.syncCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { items } = req.body || {};
    if (!Array.isArray(items)) {
      return res.status(400).json({ ok: false, message: "items must be an array" });
    }

    const cart = await getOrCreateCartForUser(userId);

    // Sanitize: dedupe by product id and clamp count >=1
    const seen = new Set();
    const normalized = [];
    for (const it of items) {
      if (!it || typeof it.id !== 'number') continue;
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      const count = Math.max(1, parseInt(it.count || 1, 10));
      normalized.push({ id: it.id, count });
    }

    // Load product prices from DB
    const productIds = normalized.map((i) => i.id);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const priceMap = new Map(products.map((p) => [p.id, p.price]));

    // Replace all ProductOnCart rows for this cart
    await prisma.productOnCart.deleteMany({ where: { cartId: cart.id } });
    if (normalized.length > 0) {
      await prisma.productOnCart.createMany({
        data: normalized.map((i) => ({
          cartId: cart.id,
          productId: i.id,
          count: i.count,
          price: priceMap.get(i.id) ?? 0,
        })),
      });
    }

    // Recompute cart total
    const updated = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: { products: { include: { product: { include: { images: true, category: true } } } } },
    });
    const responseItems = updated.products.map((poc) => ({
      id: poc.productId,
      count: poc.count,
      price: poc.price,
      title: poc.product.title,
      images: poc.product.images,
      categoryId: poc.product.categoryId,
    }));
    const cartTotal = responseItems.reduce((sum, it) => sum + it.price * it.count, 0);

    // Persist the total
    await prisma.cart.update({ where: { id: cart.id }, data: { cartTotal } });

    return res.json({ ok: true, items: responseItems, cartTotal });
  } catch (e) {
    console.error("syncCart error", e);
    return res.status(500).json({ ok: false, message: "Failed to sync cart" });
  }
};
