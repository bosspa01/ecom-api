const prisma = require("../config/prisma");
const { logAdminActionDetailed } = require('../utils/adminLog');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.changeOrderStatus = async (req, res) => {
  try {
    const { orderId, orderStatus } = req.body;
    
    // Validate orderStatus
    const validStatuses = ['PREPARING', 'SHIPPED', 'DELIVERED'];
    if (!validStatuses.includes(orderStatus)) {
      return res.status(400).json({ 
        message: "Invalid order status. Must be one of: PREPARING, SHIPPED, DELIVERED" 
      });
    }
    
    // Get before status
    const orderBefore = await prisma.order.findUnique({ where: { id: orderId } });
    const orderUpdate = await prisma.order.update({
      where: { id: orderId },
      data: { orderStatus: orderStatus },
    });

    await logAdminActionDetailed(req, {
      action: 'CHANGE_ORDER_STATUS',
      entityType: 'ORDER',
      entityId: orderId,
      before: orderBefore,
      after: orderUpdate,
      extra: { note: 'Admin changed order status' },
    });

    res.json(orderUpdate);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};
exports.getOrdersAdmin = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        products: {
          include: {
            product: true,
          },
        },
        orderedBy: {
          select: { 
            id: true, 
            name: true,
            email: true, 
            address: true 
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
      },
    });

    res.json(orders);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};

// GET /api/admin/stripe-sales?days=30&currency=thb
exports.getStripeSales = async (req, res) => {
  try {
    const days = Number(req.query.days) || 30;
    const since = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000); // seconds

    // Fetch charges created since `since` timestamp. Charges include refunded amounts
    // so aggregating charges.amount - charges.amount_refunded gives net gross volume per charge.
    let all = [];
    let starting_after = null;
    while (true) {
      const opts = { limit: 100, created: { gte: since } };
      if (starting_after) opts.starting_after = starting_after;
      const page = await stripe.charges.list(opts);
      all = all.concat(page.data);
      if (!page.has_more) break;
      starting_after = page.data[page.data.length - 1].id;
      if (all.length > 5000) break; // safety cap
    }

    const map = {};

    if (days === 1) {
      // hourly buckets for last 24 hours
      for (let i = 0; i < 24; i++) {
        const d = new Date(Date.now() - (23 - i) * 60 * 60 * 1000);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const key = `${yyyy}-${mm}-${dd} ${hh}:00`;
        map[key] = { date: key, label: `${hh}:00`, revenue: 0, count: 0 };
      }

      for (const ch of all) {
        if (ch.status !== 'succeeded') continue;
        if (req.query.currency && req.query.currency.toLowerCase() !== ch.currency) continue;
        const when = new Date((ch.created || ch.created) * 1000);
        const yyyy = when.getFullYear();
        const mm = String(when.getMonth() + 1).padStart(2, '0');
        const dd = String(when.getDate()).padStart(2, '0');
        const hh = String(when.getHours()).padStart(2, '0');
        const key = `${yyyy}-${mm}-${dd} ${hh}:00`;
        const amt = (ch.amount || 0) - (ch.amount_refunded || 0);
        const amtFloat = Number(amt) / 100;
        if (!map[key]) map[key] = { date: key, label: `${hh}:00`, revenue: 0, count: 0 };
        map[key].revenue += amtFloat;
        map[key].count += 1;
      }

      const result = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
      res.json(result);
      return;
    }

    // daily buckets for days > 1
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      map[key] = { date: key, revenue: 0, count: 0 };
    }

    for (const ch of all) {
      if (ch.status !== 'succeeded') continue;
      if (req.query.currency && req.query.currency.toLowerCase() !== ch.currency) continue;
      const when = new Date((ch.created || ch.created) * 1000);
      const key = when.toISOString().slice(0, 10);
      const amt = (ch.amount || 0) - (ch.amount_refunded || 0);
      const amtFloat = Number(amt) / 100;
      if (!map[key]) map[key] = { date: key, revenue: 0, count: 0 };
      map[key].revenue += amtFloat;
      map[key].count += 1;
    }

    const result = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Stripe aggregation failed" });
  }
};

// GET /api/admin/today-sold
exports.getTodaySoldCount = async (req, res) => {
  try {
    // Get today's date in Thai timezone (UTC+7)
    const now = new Date();
    const thailandTZ = 'Asia/Bangkok';
    const today = new Date().toLocaleDateString('en-US', { timeZone: thailandTZ });
    
    // Create date range for today (midnight to 23:59:59)
    const start = new Date(today);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);

    console.log('Today in Thailand:', today);
    console.log('Query date range:', start.toISOString(), 'to', end.toISOString());

    // Find all orders
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
        status: 'succeeded', // Only count paid orders
      },
      include: {
        products: {
          include: {
            product: true, // Include product details
          }
        },
      },
    });

    console.log('Found orders today:', orders.length);
    
    let soldToday = 0;
    const orderDetails = [];

    orders.forEach((order) => {
      console.log(`\nProcessing Order ID: ${order.id}`);
      console.log('Order time:', new Date(order.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }));
      console.log('Order status:', order.status);
      console.log('Payment ID:', order.stripePaymentId);
      console.log('Total amount:', order.amount);
      console.log('Raw order data:', JSON.stringify(order, null, 2));
      
      // Debug log for products array
      if (order.products) {
        console.log('Products in this order:', order.products.length);
        order.products.forEach((item, index) => {
          console.log(`Product ${index + 1}:`, {
            productId: item.productId,
            count: item.count,
            price: item.price
          });
          // Only count if status is succeeded
          if (order.status === 'succeeded') {
            soldToday += 1; // Count each product as 1 piece
          }
          
          orderDetails.push({
            orderId: order.id,
            productId: item.productId,
            productTitle: item.product?.title || 'Unknown Product',
            quantity: 1, // Set to 1 since we're counting individual products
            price: item.price,
          });
        });
      }
    });

    console.log('\nOrder Details:', JSON.stringify(orderDetails, null, 2));
    console.log('Total items sold today:', soldToday);

    res.json({ 
      soldToday,
      details: {
        totalOrders: orders.length,
        orderDetails,
        queryRange: {
          start: start.toISOString(),
          end: end.toISOString(),
        }
      }
    });
  } catch (error) {
    console.error("Error getting today's sold count:", error);
    res.status(500).json({ message: "Failed to compute today's sold count" });
  }
};
