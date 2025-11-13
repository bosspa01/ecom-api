const express = require("express");
const router = express.Router();

const { create, list, read, update, remove, listby, searchFilters, createImages, removeImage, getTopSellingProducts } = require("../controllers/product");
const { adminCheck, authCheck } = require("../middlewares/authCheck");


// Protect create/update/remove operations so we can reliably log admin actions
router.post("/product", authCheck, adminCheck, create);
router.get("/products/:count", list);
router.get("/product/:id", read);
router.put("/product/:id", authCheck, adminCheck, update);
router.delete("/product/:id", authCheck, adminCheck, remove);
router.post("/productby", listby);
router.post("/search/filters", searchFilters);

router.post("/images",authCheck,adminCheck,createImages)
router.post("/removeimages",authCheck,adminCheck,removeImage)
router.get("/top-selling", getTopSellingProducts);

module.exports = router;