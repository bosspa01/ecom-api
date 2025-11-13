const express = require("express");
const router = express.Router();

const { register, login, currentUser } = require("../controllers/auth");
const { authCheck, adminCheck, superAdminCheck } = require("../middlewares/authCheck");

router.post("/register", register);
router.post("/login", login);
router.post("/current-user", authCheck, currentUser);
router.post("/current-admin", authCheck, adminCheck, currentUser);
router.post("/current-superadmin", authCheck, superAdminCheck, currentUser);

module.exports = router;
