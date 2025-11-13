const prisma = require("../config/prisma");
const bcrypt = require("bcryptjs");
const e = require("cors");
const jwt = require("jsonwebtoken");

//register
exports.register = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email are required" });
    }
    if (!password) {
      return res.status(400).json({ message: "Password are required" });
    }

    //check email in db
    const user = await prisma.user.findFirst({
      where: {
        email: email,
      },
    });
    if (user) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email: email,
        password: hashedPassword,
        role: 'user',
        enabled: true
      },
    });

    res.status(201).json({
      message: "Registration successful",
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
      return res.status(400).json({ message: "Email already exists" });
    }
    res.status(500).json({ message: "Registration failed. Please try again later." });
  }
};
//login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(req.body);
    const user = await prisma.user.findFirst({
      where: {
        email: email,
      },
    });
    if (!user || !user.enabled) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    jwt.sign(payload, process.env.SECRET, { expiresIn: "1d" }, (err, token) => {
      if (err) {
        return res.status(500).json({ message: "Server Error" });
      }
      res.json({ payload, token });
    });
  } catch (error) {
    //err
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};

exports.currentUser = async (req, res) => {
  try {
    const user = await prisma.user.findFirst({
      where: { email: req.user.email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });
    res.json({ user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Failed" });
  }
};
