const functions = require('firebase-functions')
const admin = require('firebase-admin')
require('dotenv').config()

const serviceAccountKey = require('./serviceAccountKey.json')

const express = require('express')
const app= express();

//bodyparser for the json data

app.use(express.json());

//cors

const cors = require('cors')
app.use(cors({origin:true}));
app.use((req,res,next)=>{
    res.set("Access-Control-Allow-Origin", "*")
    next();
});


//firebase credentials

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountKey),
  databaseURL: "https://food-delivery-app-daily-habit.firebaseio.com",
});




//api endpoints

app.get('/test',(req,res)=>{
    return res.send('hello world')
});


const userRoute = require('./routes/user')
app.use('/api/users', userRoute)


const productRoute = require('./routes/product');
app.use('/api/products', productRoute)




exports.app = functions.https.onRequest(app)