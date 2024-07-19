const functions = require("firebase-functions");
const admin = require("firebase-admin");
require("dotenv").config();

const serviceAccountKey = require("./serviceAccountKey.json");

const express = require("express");
const app = express();

// Body parser for JSON data
app.use(express.json());

// CORS
const cors = require("cors");
app.use(
  cors({
    origin: "https://master.d3u1bkigz8q10q.amplifyapp.com",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Firebase credentials
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountKey),
  databaseURL: "https://food-delivery-app-daily-habit.firebaseio.com",
});

// API endpoints
app.get("/test", (req, res) => {
  return res.send("hello world");
});

const userRoute = require("./routes/user");
app.use("/api/users", userRoute);

const productRoute = require("./routes/product");
app.use("/api/products", productRoute);

exports.app = functions.https.onRequest(app);
