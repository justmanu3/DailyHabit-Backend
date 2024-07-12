const router = require("express").Router();
const admin = require("firebase-admin");
const { log } = require("firebase-functions/logger");
let data = [];
const nodemailer = require("nodemailer");
router.get("/", (req, res) => {
  return res.send("Inside the user router");
});

//token validation

router.get("/jwtVerification", async (req, res) => {
  if (!req.headers.authorization) {
    return res.status(500).send({ msg: "Token not Found" });
  }
  const token = req.headers.authorization.split(" ")[1];
  try {
    const decodedValue = await admin.auth().verifyIdToken(token);
    if (!decodedValue) {
      return res
        .status(500)
        .json({ success: false, msg: "Unauthorized Access" });
    }
    return res.status(200).json({ success: true, data: decodedValue });
  } catch (err) {
    return res.send({
      success: false,
      msg: `Error in extracting the token : ${err}`,
    });
  }
});

//function to list all the users

// const listAllUsers = async (nextpagetoken) => {
//   admin.auth().listUsers(1000, nextpagetoken).then((listuserresult)=>{
//     listuserresult.users.forEach((rec)=>{
//       data.push(rec.toJSON());
//     });

//     if(listuserresult.pageToken){

//       listAllUsers(listuserresult.pageToken)
//     }

//   })
//   .catch((error)=>console.log(error));

// };

// listAllUsers();

const listAllUsers = async (nextPageToken, userData = []) => {
  try {
    const listUserResult = await admin.auth().listUsers(1000, nextPageToken);
    listUserResult.users.forEach((rec) => {
      userData.push(rec.toJSON());
    });
    if (listUserResult.pageToken) {
      await listAllUsers(listUserResult.pageToken, userData);
    }
    return userData;
  } catch (error) {
    throw error;
  }
};

router.get("/all", async (req, res) => {
  try {
    const allUsersData = await listAllUsers();
    console.log("userdata", allUsersData);
    return res.status(200).send({ success: true, data: allUsersData });
  } catch (error) {
    return res.send({
      success: false,
      msg: `Error in listing the Users : ${error}`,
    });
  }
});

//block and unblock users

const blockUser = async (uid, disabledValue) => {
  try {
    const upatedUser = await admin
      .auth()
      .updateUser(uid, { disabled: disabledValue })
      .then((userRecord) => {
        console.log("Successfully updated user", upatedUser);
      });
    return upatedUser;
  } catch (error) {
    console.log("Error updating user:", error);
  }
};

/////

router.put("/blockUser/:uid", async (req, res) => {
  try {
    const uid = req.params.uid;
    const disabledValue = req.body.disabled;

    console.log(
      "blocking function=====------------------->>>>>>>>>",
      disabledValue,
      uid
    );

    const updatedUser = blockUser(uid, disabledValue);
    console.log("Successfully updated user", updatedUser);
    return res.send({
      status: "success",
      message: "User updated successfully",
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.send("error", error);
  }
});

///update user password

const updateUserPassword = async (uid, newPassword) => {
  try {
    const updatedUser = await admin
      .auth()
      .updateUser(uid, { password: newPassword });
    console.log("Successfully updated user", updatedUser);
    return updatedUser;
  } catch (error) {
    console.log("Error updating user:", error);
    throw error;
  }
};

//////

router.put("/updatePassword/:uid", async (req, res) => {
  try {
    const uid = req.params.uid;
    const newPassword = req.body.password;

    console.log(
      "Updating password function=====------------------->>>>>>>>>",
      newPassword,
      uid
    );

    const updatedUser = await updateUserPassword(uid, newPassword);
    console.log("Successfully updated user", updatedUser);
    return res.send({
      status: "success",
      message: "User password updated successfully",
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).send({
      status: "error",
      message: "Error updating user password",
      error: error.message,
    });
  }
});

///update username(user profile)

const updateUserProfile = async (uid, userName) => {
  try {
    const updatedUser = await admin
      .auth()
      .updateUser(uid, { displayName: userName });
    console.log("Successfully updated user", updatedUser);
    return updatedUser;
  } catch (error) {
    console.log("Error updating user:", error);
    throw error;
  }
};

//////

router.put("/updateProfile/:uid", async (req, res) => {
  try {
    const uid = req.params.uid;
    const userName = req.body.userName;

    console.log(
      "Updating profile function=====------------------->>>>>>>>>",
      userName,
      uid
    );

    const updatedUser = await updateUserProfile(uid, userName);
    console.log("Successfully updated user", updatedUser);
    return res.send({
      status: "success",
      message: "User password updated successfully",
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).send({
      status: "error",
      message: "Error updating user password",
      error: error.message,
    });
  }
});

///otp

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

//generating otp

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000); // Generate 6-digit OTP
};
router.post("/sendotp", (req, res) => {
  const { email } = req.body;
  console.log("gggggggg", req.body);
  const otp = generateOTP();
  transporter.sendMail(
    {
      from: process.env.EMAIL,
      to: email,
      subject: "Your OTP",
      text: `Your OTP is: ${otp}`,
    },
    (error, info) => {
      if (error) {
        console.log(error);
        return res.status(500).send("Error sending email");
      }
      // For simplicity and demonstration, sending OTP in response (NOT secure for real apps)
      res.status(200).json({ otp });
    }
  );
});

//verify otp

router.post("/verifyotp", (req, res) => {
  const { userOtp, storedOtp } = req.body;
  if (parseInt(userOtp, 10) === parseInt(storedOtp, 10)) {
    res.status(200).send("OTP verified successfully");
  } else {
    res.status(401).send("Incorrect OTP");
  }
});

module.exports = router;
