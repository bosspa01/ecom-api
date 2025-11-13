const prisma = require("../config/prisma");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.payment = async (req, res) => {
  try {

        const cart = await prisma.cart.findFirst({
            where: {
                orderedById: req.user.id,
            },
            include: {
                products: true,
            },
        })

        // Import shipping helper
        const { getShippingCost } = require('../constants/shipping');
        
        // Get shipping cost
        const shippingCost = getShippingCost(req.body.shippingMethod || 'bangkok_standard');

        let finalAmount = cart.cartTotal + shippingCost;

        // Apply coupon discount if provided
        if (req.body.couponId) {
          const coupon = await prisma.saleCoupon.findUnique({
            where: { id: Number(req.body.couponId) },
          });

          if (coupon && coupon.status === "active") {
            const now = new Date();
            if (new Date(coupon.expirationDate) >= now && coupon.currentUses < coupon.maxUses) {
              // Check minimum order amount (before shipping)
              if (!coupon.minimumOrderAmount || cart.cartTotal >= coupon.minimumOrderAmount) {
                // Calculate discount
                let discountAmount = 0;
                if (coupon.discountType === "percentage") {
                  discountAmount = (cart.cartTotal * coupon.discountValue) / 100;
                } else if (coupon.discountType === "fixed_amount") {
                  discountAmount = coupon.discountValue;
                }

                // Ensure discount doesn't exceed cart total
                if (discountAmount > cart.cartTotal) {
                  discountAmount = cart.cartTotal;
                }

                finalAmount = Math.max(0, cart.cartTotal - discountAmount + shippingCost);
              }
            }
          }
        }

        const amountTHB = Math.round(finalAmount * 100);


    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountTHB,
      currency: "thb",
      // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};
