const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

exports.authCheck = async (req, res, next) => {
  try {
    const headerToken = req.headers.authorization;
    if (!headerToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const token = headerToken.split(" ")[1];
    const decode = jwt.verify(token, process.env.SECRET);
    req.user = decode;

    const user = await prisma.user.findFirst({
      where: {
        email: req.user.email,
      },
    });
    if (!user.enabled) {
      return res.status(403).json({ message: "User Disabled" });
    }

    next();
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Token Invalid" });
  }
};

exports.adminCheck = async (req, res, next) => {
  try {
    const { email } = req.user;
    const adminUser = await prisma.user.findFirst({
      where: {
        email: email,
      },
    });
    if (!adminUser || (adminUser.role !== "admin" && adminUser.role !== "superadmin")) {
      return res
        .status(403)
        .json({ message: "Admin Resource. Access Denied." });
    }
    next();
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Admin Resource. Access Denied." });
  }
};

// Superadmin only guard
exports.superAdminCheck = async (req, res, next) => {
  try {
    const { email } = req.user;
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Superadmin only. Access denied.' });
    }
    next();
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Superadmin only. Access denied.' });
  }
};
