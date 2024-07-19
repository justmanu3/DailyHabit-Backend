const router = require("express").Router();
const admin = require("firebase-admin");
const express = require("express");
const { log } = require("firebase-functions/logger");
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });
const stripe = require("stripe")(process.env.STRIPE_KEY);

router.get("/product", (req, res) => {
  return res.send("Inside the  Product router");
});

//route to add new product

router.post("/create", async (req, res) => {
  try {
    const id = Date.now();
    const data = {
      productId: id,
      product_name: req.body.product_name,
      product_category: req.body.product_category,
      product_price: req.body.product_price,
      product_count: req.body.product_count,
      imageURL: req.body.imageURL,
    };

    const response = await db.collection("products").doc(`/${id}/`).set(data);
    console.log(response);

    return res.status(200).send({ success: true, data: response });
  } catch (error) {
    return res.send({ success: false, msg: `Error: ${error}` });
  }
});

//edit product

router.put("/edit/:productId", async (req, res) => {
  try {
    const productId = req.params.productId;
    const data = {
      product_name: req.body.product_name,
      product_category: req.body.product_category,
      product_price: req.body.product_price,
      product_count: req.body.product_count,
      imageURL: req.body.imageURL,
    };

    const response = await db
      .collection("products")
      .doc(productId)
      .update(data);
    console.log(response);

    return res.status(200).send({ success: true, data: response });
  } catch (error) {
    return res.send({ success: false, msg: `Error: ${error}` });
  }
});

// getting all the products

router.get("/all", async (req, res) => {
  (async () => {
    try {
      let query = db.collection("products");
      let response = [];
      await query.get().then((querysnap) => {
        let docs = querysnap.docs;
        docs.map((doc) => {
          response.push({ ...doc.data() });
        });
        return response;
      });
      return res.status(200).send({ success: true, data: response });
    } catch (error) {
      return res.send({ success: false, msg: `Error ${error}` });
    }
  })();
});

//delete the product

router.delete("/delete/:productId", async (req, res) => {
  const productId = req.params.productId;

  try {
    await db
      .collection("products")
      .doc(`/${productId}/`)
      .delete()
      .then((result) => {
        return res.status(200).send({ success: true, data: result });
      });
  } catch (error) {
    return res.send({ success: false, msg: `Error ${error}` });
  }
});

//incrementing and decrementing product stock-count while adding to cart

router.put("/updateStockCount/:productId", async (req, res) => {
  const productId = req.params.productId;
  const type = req.query.type;

  try {
    const docRef = db.collection("products").doc(productId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).send({ success: false, msg: "Product not found" });
    }

    const productData = doc.data();
    let productCount = productData.product_count;

    if (type === "increment") {
      productCount = productCount - 1;
      if (productCount < 0) {
        return res.status(200).send({ success: false, msg: "Out of stock" });
      }
    } else if (type === "decrement") {
      productCount = productCount + 1;
    } else {
      return res
        .status(400)
        .send({ success: false, msg: "Invalid type parameter" });
    }

    await docRef.update({ product_count: productCount });

    return res.status(200).send({
      success: true,
      data: { productId, product_count: productCount },
    });
  } catch (error) {
    return res
      .status(500)
      .send({ success: false, msg: `Error: ${error.message}` });
  }
});

//create a cart

router.post("/addToCart/:userId", async (req, res) => {
  const userId = req.params.userId;
  const productId = req.body.productId;

  try {
    const doc = await db
      .collection("cartItems")
      .doc(`/${userId}/`)
      .collection("products")
      .doc(`/${productId}/`)
      .get();

    if (doc.data()) {
      const quantity = doc.data().quantity + 1;
      const updatedItem = await db
        .collection("cartItems")
        .doc(`/${userId}/`)
        .collection("products")
        .doc(`/${productId}/`)
        .update({ quantity });

      return res.status(200).send({ success: true, data: updatedItem });
    } else {
      const data = {
        productId: productId,
        product_name: req.body.product_name,
        product_category: req.body.product_category,
        product_price: req.body.product_price,
        imageURL: req.body.imageURL,
        quantity: 1,
      };

      const addProducts = await db
        .collection("cartItems")
        .doc(`/${userId}/`)
        .collection("products")
        .doc(`/${productId}/`)
        .set(data);
      return res.status(200).send({ success: true, data: addProducts });
    }
  } catch (error) {
    return res.send({ success: false, msg: `Error: ${error}` });
  }
});

//get all the cart items for the user

router.get("/getCartItems/:user_id", async (req, res) => {
  const userId = req.params.user_id;
  (async () => {
    try {
      let query = db
        .collection("cartItems")
        .doc(`/${userId}/`)
        .collection("products");
      let response = [];

      await query.get().then((querysnap) => {
        let docs = querysnap.docs;

        docs.map((doc) => {
          response.push({ ...doc.data() });
        });
        return response;
      });
      return res.status(200).send({ success: true, data: response });
    } catch (error) {
      return res.send({ success: false, msg: `Error: ${error}` });
    }
  })();
});

//update the cart to increase and decrease the quantity

router.post("/updateCart/:user_id", async (req, res) => {
  const userId = req.params.user_id;
  const productId = req.query.productId;
  const type = req.query.type;

  try {
    const doc = await db
      .collection("cartItems")
      .doc(`/${userId}/`)
      .collection("products")
      .doc(`/${productId}/`)
      .get();

    if (doc.data()) {
      if (type === "increment") {
        const quantity = doc.data().quantity + 1;
        const updatedItem = await db
          .collection("cartItems")
          .doc(`/${userId}/`)
          .collection("products")
          .doc(`/${productId}/`)
          .update({ quantity });

        return res.status(200).send({ success: true, data: updatedItem });
      } else {
        if (doc.data().quantity === 1) {
          await db
            .collection("cartItems")
            .doc(`/${userId}/`)
            .collection("products")
            .doc(`/${productId}/`)
            .delete()
            .then((result) => {
              return res.status(200).send({ success: true, data: result });
            });
        } else {
          const quantity = doc.data().quantity - 1;
          const updatedItem = await db
            .collection("cartItems")
            .doc(`/${userId}/`)
            .collection("products")
            .doc(`/${productId}/`)
            .update({ quantity });

          return res.status(200).send({ success: true, data: updatedItem });
        }
      }
    }
  } catch (error) {
    return res.send({ success: false, msg: `Error:${error}` });
  }
});

//get category statuses

router.get("/categorystatuses", async (req, res) => {
  try {
    const query = db.collection("categories");
    const querySnapshot = await query.get();
    let response = [];

    querySnapshot.docs.forEach((doc) => {
      response.push({
        ...doc.data(),
        documentId: doc.id, // Correctly assign the document ID here
      });
    });

    res.status(200).send({ success: true, data: response });
  } catch (error) {
    res.status(500).send({ success: false, msg: `Error ${error}` });
  }
});

// stripe  payment

router.post("/create-checkout-session", async (req, res) => {
  //creating customer

  console.log(
    "req body data kittiiii=================-------------->",
    req.body.data
  );

  const customer = await stripe.customers.create({
    metadata: {
      user_id: req.body.data.user.user_id,
      cart: JSON.stringify(req.body.data.cart),
      total: req.body.data.total,
    },
  });

  const line_items = req.body.data.cart.map((item) => {
    return {
      price_data: {
        currency: "inr",
        product_data: {
          name: item.product_name,
          // images: null,
          metadata: {
            id: item.productId,
          },
        },
        unit_amount: item.product_price * 100,
      },
      quantity: item.quantity,
    };
  });

  console.log("customer ne kittii=================---------->", customer?.id);
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    shipping_address_collection: { allowed_countries: ["IN", "US"] },
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: {
            amount: 0,
            currency: "inr",
          },
          display_name: "Free Shipping",
          delivery_estimate: {
            minimum: { unit: "hour", value: 1 },
            maximum: { unit: "hour", value: 2 },
          },
        },
      },
    ],
    phone_number_collection: {
      enabled: true,
    },
    line_items,
    customer: customer.id,
    mode: "payment",
    success_url: `${process.env.CLIENT_URL}/checkoutsuccess`,
    cancel_url: `${process.env.CLIENT_URL}/home`,
  });

  res.status(200).send({ url: session.url });
  console.log("res kittiii=====================-------------------->", session);
});

//webhook

let endpointSecret;
//endpointecret is declared

// const endpointSecret = process.env.WEBHOOK_SECRET;

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    console.log(
      "req,body kittiii=====================----------------->",
      req.body
    );
    const sig = req.headers["stripe-signature"];

    let eventType;
    let data;

    if (endpointSecret) {
      let event;

      try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } catch (err) {
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
      }
      data = event.data.object;
      eventType = event.type;
    } else {
      data = req.body.data.object;
      eventType = req.body.type;
    }

    // Handle the event

    if (eventType === "checkout.session.completed") {
      stripe.customers.retrieve(data.customer).then((customer) => {
        console.log("Data kitti======---------->", data);
        console.log("res kitti======-------->", res);
        createOrder(customer, data, res);
      });
    }

    // Return a 200 res to acknowledge receipt of the event
    res.send().end();
  }
);

//creating order in db for Online Payment

const createOrder = async (customer, intent, res) => {
  console.log("inside the orderrrrrr===================------------->");
  console.log("customer===================------------->", customer);
  console.log("intent===================------------->", intent);
  try {
    const orderId = Date.now();
    const date = new Date();
    const data = {
      intentId: intent.id,
      orderId,
      amount: intent.amount_total / 100,
      created: intent.created,
      payment_method_types: intent.payment_method_types,
      status: intent.payment_status,
      customer: intent.customer_details,
      shipping_details: intent.shipping_details,
      userId: customer.metadata.user_id,
      items: JSON.parse(customer.metadata.cart),
      total: customer.metadata.total,
      sts: "preparing",
      date,
    };

    await db.collection("orders").doc(`${orderId}`).set(data);

    await deleteCart(
      customer.metadata.user_id,
      JSON.parse(customer.metadata.cart)
    );

    return res.status(200).send({ success: true });
  } catch (err) {
    console.error("Error creating order:", err);
    return res.status(500).send("Internal Server Error");
  }
};

const deleteCart = async (userId, items) => {
  console.log(userId);

  for (const data of items) {
    console.log(
      "----------------Inside----------------",
      userId,
      data.productId
    );

    try {
      await db
        .collection("cartItems")
        .doc(`${userId}`)
        .collection("products")
        .doc(`${data.productId}`)
        .delete();

      console.log("----------------Success----------------");
    } catch (err) {
      console.error("Error deleting item:", err);
    }
  }
};

//cod order

router.post("/createcodorder/:user_id", async (req, res) => {
  try {
    const userId = req.params.user_id;
    const orderId = Date.now();
    const date = new Date();
    console.log(req.body);

    const data = {
      // intentId: intent.id,
      orderId: orderId,
      amount: req.body.customerdata.total,
      // created: intent.created,
      status: req.body.status,
      // status: intent.payment_status,
      customer: req.body.customer_details,
      shipping_details: req.body.customer_details,
      userId: userId,
      items: req.body.customerdata.cart,
      total: req.body.customerdata.total,
      sts: "preparing",
      date,
    };

    await db.collection("orders").doc(`${orderId}`).set(data);

    await deleteCODCart(userId, req.body.customerdata.cart);

    console.log("COD order created=============----------------->");

    return res.status(200).send({ success: true });
  } catch (error) {
    console.error("Error creating order:", error);
    return res.status(500).send("Internal Server Error");
  }
});

const deleteCODCart = async (userId, items) => {
  console.log(userId);

  for (const data of items) {
    console.log(
      "----------------Inside----------------",
      userId,
      data.productId
    );

    try {
      await db
        .collection("cartItems")
        .doc(`${userId}`)
        .collection("products")
        .doc(`${data.productId}`)
        .delete();

      console.log("----------------Success----------------");
    } catch (err) {
      console.error("Error deleting item:", err);
    }
  }
};

//wallet orders

router.post("/createwalletorder/:user_id", async (req, res) => {
  try {
    const userId = req.params.user_id;
    const orderId = Date.now();
    const date = new Date();
    console.log(req.body);

    const data = {
      // intentId: intent.id,
      orderId: orderId,
      amount: req.body.customerdata.total,
      // created: intent.created,
      status: req.body.status,
      // status: intent.payment_status,
      customer: req.body.customer_details,
      shipping_details: req.body.customer_details,
      userId: userId,
      items: req.body.customerdata.cart,
      total: req.body.customerdata.total,
      sts: "preparing",
      date,
    };

    await db.collection("orders").doc(`${orderId}`).set(data);

    await deletewalletCart(userId, req.body.customerdata.cart);

    console.log("COD order created=============----------------->");

    return res.status(200).send({ success: true });
  } catch (error) {
    console.error("Error creating order:", error);
    return res.status(500).send("Internal Server Error");
  }
});

const deletewalletCart = async (userId, items) => {
  console.log(userId);

  for (const data of items) {
    console.log(
      "----------------Inside----------------",
      userId,
      data.productId
    );

    try {
      await db
        .collection("cartItems")
        .doc(`${userId}`)
        .collection("products")
        .doc(`${data.productId}`)
        .delete();

      console.log("----------------Success----------------");
    } catch (err) {
      console.error("Error deleting item:", err);
    }
  }
};

//orders

router.get("/orders", async (req, res) => {
  (async () => {
    try {
      let query = db.collection("orders");
      let response = [];
      await query.get().then((querysnap) => {
        let docs = querysnap.docs;
        docs.map((doc) => {
          response.push({ ...doc.data() });
        });
        return response;
      });
      return res.status(200).send({ success: true, data: response });
    } catch (error) {
      return res.send({ success: false, msg: `Error ${error}` });
    }
  })();
});

//update order status

router.post("/updateOrder/:order_id", async (req, res) => {
  try {
    const order_id = req.params.order_id;
    const sts = req.query.sts;

    console.log("order is kittii=====------------->", order_id);

    const updatedItem = await db
      .collection("orders")
      .doc(`/${order_id}/`)
      .update({ sts });
    return res.status(200).send({ success: true, data: updatedItem });
  } catch (error) {
    return res.send({ success: false, msg: `Error: ${error}` });
  }
});

//add new address

router.post("/createaddress/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {
    const id = Date.now();
    const data = {
      addressId: id,
      line1: req.body.line1,
      line2: req.body.line2,
      city: req.body.city,
      state: req.body.state,
      pincode: req.body.postal_code,
      email: req.body.email,
      phone: req.body.phone,
    };

    const response = await db
      .collection("address")
      .doc(`/${userId}/`)
      .collection("useraddress")
      .doc(`/${id}/`)
      .set(data);
    console.log(response);

    return res.status(200).send({ success: true, data: response });
  } catch (error) {
    return res.send({ success: false, msg: `Error: ${error}` });
  }
});

//getting all the addresses

router.get("/alladdress/:userId", async (req, res) => {
  const userId = req.params.userId;

  (async () => {
    try {
      let query = db
        .collection("address")
        .doc(`/${userId}/`)
        .collection("useraddress");
      let response = [];
      await query.get().then((querysnap) => {
        let docs = querysnap.docs;
        docs.map((doc) => {
          response.push({ ...doc.data() });
        });
        return response;
      });
      return res.status(200).send({ success: true, data: response });
    } catch (error) {
      return res.send({ success: false, msg: `Error ${error}` });
    }
  })();
});

// get an address

router.get("/address/:userId/:addressId", async (req, res) => {
  const { userId, addressId } = req.params;

  try {
    const docRef = db
      .collection("address")
      .doc(userId)
      .collection("useraddress")
      .doc(addressId);

    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).send({ success: false, msg: "Address not found" });
    }

    return res.status(200).send({ success: true, data: doc.data() });
  } catch (error) {
    return res
      .status(500)
      .send({ success: false, msg: `Error: ${error.message}` });
  }
});

//delete an address

router.delete("/deleteAddress/:userId/:addressId", async (req, res) => {
  const { userId, addressId } = req.params;

  try {
    await db
      .collection("address")
      .doc(`/${userId}/`)
      .collection("useraddress")
      .doc(`/${addressId}/`)
      .delete()
      .then((result) => {
        return res.status(200).send({ success: true, data: result });
      });
  } catch (error) {
    return res.send({ success: false, msg: `Error ${error}` });
  }
});

//edit address

// router.put("/editaddress/:userId/:addressId", async (req, res) => {
//   try {
//     const { userId, addressId } = req.params;

//     const data = {
//       line1: req.body.line1,
//       line2: req.body.line2,
//       city: req.body.city,
//       state: req.body.state,
//       pincode: req.body.pincode,
//       email: req.body.email,
//       phone: req.body.phone,
//     };

//     const response = await db
//       .collection("address")
//       .doc(`/${userId}/`)
//       .collection("useraddress")
//       .doc(`/${addressId}/`)
//       .update(data);
//     console.log(response);

//     return res.status(200).send({ success: true, data: response });
//   } catch (error) {
//     return res.send({ success: false, msg: `Error: ${error}` });
//   }
// });

//activating wallet for new user

router.post("/createwallet/:userId", async (req, res) => {
  const userId = req.params.userId;
  const date = req.body.date;
  try {
    const id = Date.now().toString();
    const initialAmount = 0;
    const data = {
      walletId: id,
      amount: initialAmount,
      created_at: date,
      // created_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db
      .collection("wallet")
      .doc(userId)
      .collection("userwallet")
      .doc(id)
      .set(data);

    console.log(`Wallet created with id: ${id}`);

    return res.status(200).send({ success: true, data });
  } catch (error) {
    console.error(`Error creating wallet: ${error}`);
    return res.status(500).send({ success: false, msg: `Error: ${error}` });
  }
});

//updating the wallet
router.put("/updatewallet/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const walletId = req.query.walletId;
    const total = parseFloat(req.query.total);

    if (isNaN(total)) {
      return res
        .status(400)
        .send({ success: false, msg: "Invalid total amount" });
    }

    // Current wallet
    const walletRef = db
      .collection("wallet")
      .doc(userId)
      .collection("userwallet")
      .doc(walletId);
    const walletDoc = await walletRef.get();

    if (!walletDoc.exists) {
      return res.status(404).send({ success: false, msg: "Wallet not found" });
    }

    const currentAmount = walletDoc.data().amount || 0;
    const newAmount = currentAmount + total;

    // Update wallet amount
    const data = { amount: newAmount };
    await walletRef.update(data);

    // Add new transaction
    const transaction = {
      amount: total,
      reason: "cancelled product",
      transactiontype: "credit",
      date: new Date().toISOString(),
    };

    const walletData = walletDoc.data();
    const transactions = walletData.transactions || [];
    transactions.push(transaction);

    await walletRef.update({ transactions });

    return res.status(200).send({ success: true, data: data });
  } catch (error) {
    return res
      .status(500)
      .send({ success: false, msg: `Error: ${error.message}` });
  }
});

//paying by wallet

router.put("/paybywallet/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const walletId = req.query.walletId;
    const total = parseFloat(req.query.total);

    if (isNaN(total)) {
      return res
        .status(400)
        .send({ success: false, msg: "Invalid total amount" });
    }

    // current wallet
    const walletRef = db
      .collection("wallet")
      .doc(userId)
      .collection("userwallet")
      .doc(walletId);
    const walletDoc = await walletRef.get();

    if (!walletDoc.exists) {
      return res.status(404).send({ success: false, msg: "Wallet not found" });
    }

    const currentAmount = walletDoc.data().amount;
    const newAmount = currentAmount - total;

    // Update wallet amount
    const data = { amount: newAmount };
    await walletRef.update(data);

    // Add new transaction
    const transaction = {
      amount: total,
      reason: "Purchase ",
      transactiontype: "debit",
      date: new Date().toISOString(),
    };

    const walletData = walletDoc.data();
    const transactions = walletData.transactions || [];
    transactions.push(transaction);

    await walletRef.update({ transactions });

    return res.status(200).send({ success: true, data: data });
  } catch (error) {
    return res
      .status(500)
      .send({ success: false, msg: `Error: ${error.message}` });
  }
});

//get the wallet details

router.get("/userwallet/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const userWalletCollection = db
      .collection("wallet")
      .doc(userId)
      .collection("userwallet");

    // Query for the first document in the collection
    const snapshot = await userWalletCollection.limit(1).get();

    if (snapshot.empty) {
      return res.status(404).send({ success: false, msg: "Wallet not found" });
    }

    // Get the first document data
    const doc = snapshot.docs[0];
    const walletData = doc.data();

    return res.status(200).send({ success: true, data: walletData });
  } catch (error) {
    return res
      .status(500)
      .send({ success: false, msg: `Error: ${error.message}` });
  }
});

//add new coupon

router.post("/createcoupon", async (req, res) => {
  try {
    const id = Date.now();
    const data = {
      couponId: id,
      coupon_name: req.body.coupon_name,
      coupon_discount: req.body.coupon_discount,
      min_amount: req.body.min_amount,
      max_discount: req.body.max_discount,
    };

    const response = await db.collection("coupons").doc(`/${id}/`).set(data);
    console.log(response);

    return res.status(200).send({ success: true, data: response });
  } catch (error) {
    return res.send({ success: false, msg: `Error: ${error}` });
  }
});

//getting all coupons

router.get("/allcoupons", async (req, res) => {
  (async () => {
    try {
      let query = db.collection("coupons");
      let response = [];
      await query.get().then((querysnap) => {
        let docs = querysnap.docs;
        docs.map((doc) => {
          response.push({ ...doc.data() });
        });
        return response;
      });
      return res.status(200).send({ success: true, data: response });
    } catch (error) {
      return res.send({ success: false, msg: `Error ${error}` });
    }
  })();
});

//get a single coupon

router.get("/coupon/:couponId", async (req, res) => {
  const { couponId } = req.params;
  console.log(couponId);
  try {
    const docRef = db.collection("coupons").doc(couponId);

    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).send({ success: false, msg: "Coupon not found" });
    }

    return res.status(200).send({ success: true, data: doc.data() });
  } catch (error) {
    return res
      .status(500)
      .send({ success: false, msg: `Error: ${error.message}` });
  }
});

//deleting a coupon

router.delete("/deletecoupon/:couponId", async (req, res) => {
  const couponId = req.params.couponId;

  try {
    await db
      .collection("coupons")
      .doc(`/${couponId}/`)
      .delete()
      .then((result) => {
        return res.status(200).send({ success: true, data: result });
      });
  } catch (error) {
    return res.send({ success: false, msg: `Error ${error}` });
  }
});

//add new offer

router.post("/createoffer", async (req, res) => {
  try {
    const id = Date.now();
    const data = {
      offerId: id,
      offer_name: req.body.offer_name,
      offer_discount: Number(req.body.offer_discount),
      productId: req.body.productId,
    };

    const response = await db.collection("offers").doc(`/${id}/`).set(data);
    console.log(response);

    return res.status(200).send({ success: true, data: response });
  } catch (error) {
    return res.send({ success: false, msg: `Error: ${error}` });
  }
});

//get all offers

router.get("/alloffers", async (req, res) => {
  (async () => {
    try {
      let query = db.collection("offers");
      let response = [];
      await query.get().then((querysnap) => {
        let docs = querysnap.docs;
        docs.map((doc) => {
          response.push({ ...doc.data() });
        });
        return response;
      });
      return res.status(200).send({ success: true, data: response });
    } catch (error) {
      return res.send({ success: false, msg: `Error ${error}` });
    }
  })();
});

//get a single offer module

router.get("/offer/:offerId", async (req, res) => {
  const { offerId } = req.params;
  console.log(offerId);
  try {
    const docRef = db.collection("offers").doc(offerId);

    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).send({ success: false, msg: "Offer not found" });
    }

    return res.status(200).send({ success: true, data: doc.data() });
  } catch (error) {
    return res
      .status(500)
      .send({ success: false, msg: `Error: ${error.message}` });
  }
});

//deleting an offer

router.delete("/deleteoffer/:offerId", async (req, res) => {
  const offerId = req.params.offerId;

  try {
    await db
      .collection("offers")
      .doc(`/${offerId}/`)
      .delete()
      .then((result) => {
        return res.status(200).send({ success: true, data: result });
      });
  } catch (error) {
    return res.send({ success: false, msg: `Error ${error}` });
  }
});

module.exports = router;
