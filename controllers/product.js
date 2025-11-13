const prisma = require("../config/prisma");
const { logAdminAction, logAdminActionDetailed } = require('../utils/adminLog');
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.create = async (req, res) => {
  try {
    const { title, description, price, quantity, categoryId, images } =
      req.body;
    const product = await prisma.product.create({
      data: {
        title: title,
        description: description,
        price: parseFloat(price),
        quantity: parseInt(quantity),
        categoryId: parseInt(categoryId),
        images: {
          create: images.map((item) => ({
            asset_id: item.asset_id,
            public_id: item.public_id,
            url: item.url,
            secure_url: item.secure_url,
          })),
        },
      },
    });

    // Admin activity log (detailed snapshot of created entity)
    await logAdminActionDetailed(req, {
      action: 'CREATE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: product.id,
      before: null,
      after: product,
    });
    res.send(product);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};

exports.list = async (req, res) => {
  try {
    const { count } = req.params;
    const products = await prisma.product.findMany({
      take: parseInt(count),
      orderBy: { createdAt: "desc" },
      include: { category: true, images: true },
    });
    res.send(products);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};
exports.read = async (req, res) => {
  try {
    const { id } = req.params;
    const products = await prisma.product.findFirst({
      where: { id: Number(id) },
      include: { category: true, images: true },
    });
    res.send(products);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};

exports.update = async (req, res) => {
  try {
    const { title, description, price, quantity, categoryId, images } =
      req.body;

    //clear images
    await prisma.image.deleteMany({
      where: {
        productId: Number(req.params.id),
      },
    });

    // Fetch before snapshot (exclude heavy image arrays if needed)
    const before = await prisma.product.findUnique({
      where: { id: Number(req.params.id) },
      include: { images: true },
    });

    const product = await prisma.product.update({
      where: {
        id: Number(req.params.id),
      },
      data: {
        title: title,
        description: description,
        price: parseFloat(price),
        quantity: parseInt(quantity),
        categoryId: parseInt(categoryId),
        images: {
          create: images.map((item) => ({
            asset_id: item.asset_id,
            public_id: item.public_id,
            url: item.url,
            secure_url: item.secure_url,
          })),
        },
      },
    });
    await logAdminActionDetailed(req, {
      action: 'UPDATE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: product.id,
      before,
      after: product,
    });
    res.send(product);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    //ค้นหาสินค้า include images
    const product = await prisma.product.findFirst({
      where: { id: Number(id) },
      include: { images: true },
    });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    // promise ลบรูปใน cloud ลบแบบ รอฉันด้วย
    const deleteImage = product.images.map(
      (image) =>
        new Promise((resolve, reject) => {
          // ลบรูปใน cloudinary
          cloudinary.uploader.destroy(image.public_id, (error, result) => {
            if (error) reject(error);
            else resolve(result);
          });
        })
    );
    await Promise.all(deleteImage);

    // ลบสินค้า
    const beforeDelete = await prisma.product.findFirst({
      where: { id: Number(id) },
      include: { images: true },
    });

    await prisma.product.delete({
      where: {
        id: Number(id),
      },
    });
    await logAdminActionDetailed(req, {
      action: 'DELETE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: Number(id),
      before: beforeDelete,
      after: null,
    });
    res.send("product remove");
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};

exports.listby = async (req, res) => {
  try {
    const { sort, order, limit } = req.body;
    console.log(sort, order, limit);
    const products = await prisma.product.findMany({
      take: limit,
      orderBy: { [sort]: order },
      include: { category: true },
    });

    res.send(products);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};

//search filters
const handleQuery = async (req, res, query) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        title: {
          contains: query,
        },
      },
      include: { category: true, images: true },
    });
    res.send(products);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Search Failed" });
  }
};

const handlePrice = async (req, res, priceRange) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        price: {
          gte: priceRange[0],
          lte: priceRange[1],
        },
      },
      include: { category: true, images: true },
    });
    res.send(products);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Search Failed" });
  }
};

const handleCategory = async (req, res, categoryId) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        categoryId: {
          in: categoryId.map((id) => Number(id)),
        },
      },
      include: { category: true, images: true },
    });
    res.send(products);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Search Failed" });
  }
};

exports.searchFilters = async (req, res) => {
  try {
    const { query, price, category } = req.body;

    if (query) {
      console.log("query-->", query);
      await handleQuery(req, res, query);
    }
    if (category) {
      console.log("category-->", category);
      await handleCategory(req, res, category);
    }
    if (price) {
      console.log("price-->", price);
      await handlePrice(req, res, price);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};

exports.createImages = async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(req.body.image, {
      public_id: `Bosspa-${Date.now()}`,
      resource_type: "auto",
      folder: "E-com",
    });
    res.send(result);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};
exports.removeImage = async (req, res) => {
  try {
    const { public_id } = req.body;
    cloudinary.uploader.destroy(public_id, (result) => {
      res.send("ลบรูปภาพสำเร็จ");
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};

// Get top 3 selling products
exports.getTopSellingProducts = async (req, res) => {
    try {
        // First check if we have any orders
        const orderCount = await prisma.order.count();
        console.log('Total orders:', orderCount);

        // Get orders with their products
        const orders = await prisma.order.findMany({
            include: {
                products: {
                    include: {
                        product: true
                    }
                }
            }
        });
        
        // Calculate total sales per product
        const productSales = {};
        orders.forEach(order => {
            order.products.forEach(item => {
                const productId = item.productId;
                if (!productSales[productId]) {
                    productSales[productId] = {
                        count: 0,
                        total: 0
                    };
                }
                productSales[productId].count += item.count;
                productSales[productId].total += item.price * item.count;
            });
        });

        // Convert to array and sort by count
        const topProducts = Object.entries(productSales)
            .map(([productId, sales]) => ({
                productId: parseInt(productId),
                _sum: { count: sales.count }
            }))
            .sort((a, b) => b._sum.count - a._sum.count)
            .slice(0, 3);
        
        console.log('Top products:', JSON.stringify(topProducts, null, 2));

        // Get full product details for each top selling product
        const productsWithDetails = await Promise.all(
            topProducts.map(async (item) => {
                const product = await prisma.product.findUnique({
                    where: { id: item.productId },
                    include: {
                        category: true,
                        images: true
                    }
                });
                return {
                    ...product,
                    totalSold: item._sum.count
                };
            })
        );

        res.json(productsWithDetails);
    } catch (error) {
        console.error("Error getting top selling products:", error);
        res.status(500).send("Error getting top selling products");
    }
};
