import User from "../models/user.model.js";
import Coins from "../models/coins.model.js";
import Property from "../models/property.model.js";
import jwt from "jsonwebtoken";
import { errorHandler } from "../utils/error.js";
import dotenv from "dotenv";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
dotenv.config();

export const createProfile = async (req, res, next) => {
  try {
    const { number } = req.body;
    // Check if user exists with the given phone number
    let user = await User.findOne({ number });

    if (user) {
      // User exists, return user details with token
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

      return res.status(200).json({
        status: "success",
        data: { id: user._id, name: user.name, email: user.email, token },
        message: "User found successfully",
      });
    } else {
      const { number, name, email } = req.body;
      if (!number || !name || !email) {
        return next(
          errorHandler(400, res, "Please provide all the required fields")
        );
      }

      user = await User.findOne({ email });

      if (user) {
        return next(errorHandler(400, res, "Email already exists"));
      }

      // Get the default coin balance
      const defaultBalanceDoc = await Coins.findOne({});
      // console.log(defaultBalanceDoc);
      const balance = defaultBalanceDoc ? defaultBalanceDoc.balance : 200;

      // User does not exist, create a new profile
      user = new User({ number, name, email, balance });
      await user.save();

      const coins = new Coins({ userId: user._id, balance });
      await coins.save();

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

      return res.status(201).json({
        status: "success",
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          balance,
          token,
        },
        message: "User registered successfully",
      });
    }
  } catch (error) {
    console.error("Error handling user:", error);
    next(error);
  }
};

export const verifyNumber = async (req, res, next) => {
  try {
    const { number } = req.body;
    // Check if user exists with the given phone number
    let user = await User.findOne({ number });

    if (!number) {
      return next(errorHandler(400, res, "Number is required"));
    }

    if (user) {
      // User exists, return user details with token
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

      return res.status(200).json({
        status: "success",
        data: { id: user._id, name: user.name, email: user.email, token },
        message: "User found successfully",
      });
    } else {
      return next(errorHandler(404, res, "User not found"));
    }
  } catch (error) {
    console.error("Error handling user:", error);
    next(error);
  }
};

export const updateUserProfile = async (req, res, next) => {
  const { name, email } = req.body;
  console.log(req.user);
  try {
    // Find and update the user by ID from the decoded token
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { name, email } },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      code: 200,
      data: user,
      message: "Success",
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    next(error);
  }
};

export const getUserProfile = async (req, res, next) => {
  try {
    // Fetch user details by ID from the decoded token
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return next(errorHandler(404, res, "User not found"));
    }
    // get the property count of the user
    const propertyCount = await Property.countDocuments({ owner_id: user._id });
    console.log(propertyCount);

    res.status(200).json({
      code: 200,
      data: user,
      owner_properties_count: propertyCount,
      message: "Success",
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    next(error);
  }
};

export const sendOtp = async (req, res, next) => {
  const apiKey = process.env.TWOFACTOR_API_KEY; // Replace with your actual API key
  const phoneNumber = req.body.phoneNumber;

  // this is the dummy phone number for testing/demonstration purpose
  if (phoneNumber === "9780032275" || phoneNumber === 9780032275) {
    return res.status(200).json({
      Status: "Success",
      Details: "15448d90-7d7f-11ef-8b57-02004d936044",
      OTP: "123456",
    });
  }

  var requestOptions = {
    method: "GET",
    redirect: "follow",
  };

  try {
    const data = await fetch(
      `https://2factor.in/API/V1/${apiKey}/SMS/${phoneNumber}/AUTOGEN2/OTP1`,
      requestOptions
    );

    // Use the .json() method to parse the response
    const responseJson = await data.json();

    console.log(responseJson);

    // Send the parsed JSON as a response
    res.status(200).json(responseJson);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to send OTP" });
  }
};

export const verifyOtp = async (req, res, next) => {
  const apiKey = process.env.TWOFACTOR_API_KEY; // Replace with your actual API key
  const { otp, sessionId } = req.body;

  if (
    (sessionId === "15448d90-7d7f-11ef-8b57-02004d936044" &&
      otp === "123456") ||
    otp === 123456
  ) {
    return res.status(200).json({
      Status: "Success",
      Details: "OTP Matched",
    });
  }

  var requestOptions = {
    method: "GET",
    redirect: "follow",
  };

  try {
    const data = await fetch(
      `https://2factor.in/API/V1/${apiKey}/SMS/VERIFY/${sessionId}/${otp}`,
      requestOptions
    );

    // Use the .json() method to parse the response
    const responseJson = await data.json();

    console.log(responseJson);

    // Send the parsed JSON as a response
    res.status(200).json(responseJson);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to send OTP" });
  }
};

export const profileUpload = async (req, res, next) => {
  try {
    if (
      !req.files ||
      !req.files.profilePicture ||
      req.files.profilePicture.length === 0
    ) {
      return next(errorHandler(400, res, "Profile picture upload is required"));
    }

    // Upload the image to Cloudinary (or your cloud service)
    const imageLocalPath = req.files.profilePicture[0].path;
    const imageResponse = await uploadOnCloudinary(imageLocalPath);

    if (imageResponse.error) {
      return next(errorHandler(500, res, "Error uploading image"));
    }

    // Assuming req.user contains the authenticated user's ID
    const userId = req.user.id;

    // Update user's profilePicture field in the database
    const user = await User.findByIdAndUpdate(
      userId,
      { profilePicture: imageResponse.secure_url }, // Assuming imageResponse.secure_url is the Cloudinary URL
      { new: true } // Return the updated document
    );

    if (!user) {
      return next(errorHandler(404, res, "User not found"));
    }

    res.status(200).json({
      code: 200,
      data: { profilePicture: user.profilePicture },
      message: "Profile picture uploaded and updated successfully",
    });
  } catch (error) {
    console.log(error);
    next(errorHandler(500, res, "An error occurred during the upload process"));
  }
};
