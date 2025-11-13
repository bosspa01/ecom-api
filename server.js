require('dotenv').config();
const express = require("express");
const app = express();
const morgan = require("morgan");
const { readdirSync } = require("fs");
const path = require("path");
const cors = require("cors");

// middleware
app.use(morgan("dev"));
app.use(express.json({limit:"20mb"}));
app.use(cors());


// Load routes relative to this file (robust to cwd)
const routesDir = path.join(__dirname, "routes");
readdirSync(routesDir).forEach((file) => {
    const routePath = path.join(routesDir, file);
    try {
        app.use("/api", require(routePath));
    } catch (err) {
        console.error("Failed to load route:", routePath, err);
    }
});


app.listen(5000, () => {
    console.log("Server is running on port 5000");
});





