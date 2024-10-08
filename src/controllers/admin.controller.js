import Admin from "../models/admin.model.js";
import User from "../models/user.model.js";
import Property from "../models/property.model.js";
import { errorHandler } from "../utils/error.js";
import Coins from "../models/coins.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

const HARD_CODED_SECRET_TOKEN = "ADMIN"; // Hard-coded token for verification

// Admin Sign-In Function
export const signinAdmin = async (req, res) => {
  const { token, username, password } = req.body;

  // Verify the hard-coded token
  if (token !== HARD_CODED_SECRET_TOKEN) {
    return res.status(403).json({ message: "Invalid hard-coded token" });
  }

  try {
    // Check if admin exists
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: admin._id, username: admin.username, email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: "12h" } // Set token expiration time as needed
    );

    // Send token back in the response
    res.status(200).json({ message: "Sign in successful", token });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Get All Users working
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    const usersWithBalances = await Promise.all(
      users.map(async (user) => {
        const userBalance = await Coins.findOne({ userId: user._id });
        return {
          ...user.toObject(),
          balance: userBalance ? userBalance.balance : 0,
        };
      })
    );
    res.json(usersWithBalances);
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

// Get User Details -- /admin/user/:userId - working
export const getUserDetails = async (req, res) => {
  const { userId } = req.params;
  console.log(userId);

  try {
    const user = await User.findById(userId);
    console.log(user);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const userBalance = await Coins.findOne({ userId: userId });
    console.log({ userBalance });

    res.json({
      user: {
        ...user.toObject(),
        balance: userBalance ? userBalance.balance : 0, // Include balance in the user object
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

// this the zod server side validation
const updateUserSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  number: z.string().optional(),
  balance: z.number().optional(),
});

// Update User ----- Working
export const updateUser = async (req, res) => {
  const { success, data } = updateUserSchema.safeParse(req.body);
  if (!success) {
    return res.status(400).json({ message: "Invalid input" });
  }
  const { userId, name, email, number, balance } = data;
  console.log(userId, name, email, number, balance);

  try {
    // Update user details
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { name, email, number } },
      { new: true, runValidators: true }
    );
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // If balance is provided, update it in the Coins table
    if (balance !== undefined) {
      let coins = await Coins.findOne({ userId });
      if (!coins) {
        coins = new Coins({ userId, balance: 0 }); // Initialize with balance 0 or any default value
      }
      coins.balance = balance;
      await coins.save();
    }

    res.json({ message: "User updated successfully", updatedUser });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating user", error: error.message });
  }
};

// View All Properties

// TODO: also add the respective owner_name, owner_phone, owner_email, owner_profilepictures
export const viewAllPropertiesdemo = async (req, res, next) => {
  try {
    const properties = await Property.find();

    // Fetch owner details for each property
    const propertiesWithUserDetails = await Promise.all(
      properties.map(async (property) => {
        const ownerDetails = await User.findOne(
          { _id: property.owner_id },
          "name email"
        ); // Fetch only name and email from User

        return {
          ...property._doc, // Spread the property details
          owner: ownerDetails, // Attach the owner's details
        };
      })
    );

    res.status(200).json({
      code: 200,
      data: propertiesWithUserDetails,
      message: "All properties fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching all properties:", error);
    next(errorHandler(500, res, "Something went wrong"));
  }
};

export const viewAllProperties = async (req, res, next) => {
  try {
    // Fetch properties
    const properties = await Property.find();
    // Manually fetch user details for each property
    const propertiesWithUserDetails = await Promise.all(
      properties.map(async (property) => {
        // Sanitize owner_id to remove any newlines or extra spaces
        const sanitizedOwnerId = property?.owner_id?.trim();

        // Fetch user details based on the sanitized owner_id
        const ownerDetails = await User.findOne(
          { _id: sanitizedOwnerId },
          "name email"
        );

        return {
          ...property._doc, // Spread the property details
          owner_name: ownerDetails?.name, // Attach the owner's details
          owner_phone: ownerDetails?.number,
          owner_email: ownerDetails?.email,
          owner_profilepictures: ownerDetails?.profilePicture,
        };
      })
    );

    res.status(200).json({
      code: 200,
      data: propertiesWithUserDetails,
      message: "Properties fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching properties:", error);
    next(error);
  }
};

// View Property Details --- working
export const viewPropertyDetails = async (req, res, next) => {
  const { propertyId } = req.params;

  try {
    const property = await Property.findById(propertyId);

    if (!property) {
      return next(errorHandler(404, res, "Property not found"));
    }

    const owner = await User.findById(property.owner_id);

    const propertyWithOwnerDetails = {
      ...property.toObject(),
      owner_name: owner.name,
      owner_phone: owner.number,
      owner_email: owner.email,
      owner_profilepictures: owner.profilePicture,
    };
    if (!property) {
      return next(errorHandler(404, res, "Property not found"));
    }

    res.status(200).json({
      code: 200,
      data: propertyWithOwnerDetails,
      message: "Property details fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching property details:", error);
    next(errorHandler(500, res, "Something went wrong"));
  }
};

// Update Property - /updatePropeties
export const updateProperty = async (req, res, next) => {
  const { propertyId, ...updatedDetails } = req.body;

  try {
    const property = await Property.findById(propertyId);
    console.log(property);
    if (!property) {
      return next(errorHandler(404, res, "Property not found"));
    }

    // Update each field individually
    Object.keys(updatedDetails).forEach((field) => {
      property[field] = updatedDetails[field];
    });

    await property.save();

    res.status(200).json({
      data: property,
      message: "Property updated successfully",
    });
  } catch (error) {
    console.error("Error updating property:", error);
    next(errorHandler(500, res, "Something went wrong"));
  }
};

// Update a user's coin balance as admin
export const adminUpdateBalance = async (req, res, next) => {
  const { userId } = req.params; // Admin provides the user ID
  const { amount } = req.body; // Amount to update the balance with

  try {
    let coins = await Coins.findOne({ userId });

    if (!coins) {
      coins = new Coins({ userId, balance: 0 }); // Initialize with balance 0 or any default value
    }

    coins.balance += amount;
    await coins.save();

    res.status(200).json({
      code: 200,
      data: { balance: coins.balance },
      message: "Coins updated successfully.",
    });
  } catch (error) {
    console.error("Error updating balance:", error);
    next(error);
  }
};

// Utility function to parse date in DD/MM/YYYY format
const parseDate = (dateStr) => {
  const [day, month, year] = dateStr.split("/").map(Number);
  return new Date(year, month - 1, day);
};
// this is the admin get transactions
export const adminGetTransactions = async (req, res, next) => {
  const { userId } = req.params;
  const { startDate, endDate } = req.body;

  try {
    // Parse startDate and endDate
    const start = parseDate(startDate);
    start.setHours(0, 0, 0, 0); // Set start time to 12:00 AM

    const end = parseDate(endDate);
    end.setHours(23, 59, 59, 999); // Set end time to 11:59 PM

    console.log(`Fetching transactions from ${start} to ${end}`);

    // Fetch the coins document
    const coins = await Coins.findOne({ userId });

    if (!coins) {
      return res.status(404).json({
        code: 404,
        data: {},
        message: "Coins not found for this user.",
      });
    }

    // Filter transactions within the specified date range
    const transactions = coins.transactions.filter(
      (transaction) =>
        new Date(transaction.timestamp) >= start &&
        new Date(transaction.timestamp) <= end
    );

    console.log("Filtered Transactions:", transactions);

    if (!transactions.length) {
      return res.status(404).json({
        code: 404,
        data: {},
        message: "No transactions found for this user in the specified period.",
      });
    }

    res.status(200).json({
      code: 200,
      data: { transactions },
      message: "Transactions fetched successfully.",
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    next(error);
  }
};

export const adminDashboard = async (req, res, next) => {
  try {
    // this is the total number of users
    const totalUsers = await User.countDocuments();
    // this is the total number of properties
    const totalProperties = await Property.countDocuments();
    // this is the number of wallet which is 1 to 1 relationship with user
    // const totalTransactions = await Coins.countDocuments();

    // total transactions made on the platform including credit and debit
    const totalTransactions = await Coins.aggregate([
      {
        $unwind: "$transactions",
      },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalCreditTransactions: {
            $sum: {
              $cond: [
                { $eq: ["$transactions.type", "credit"] },
                "$transactions.amount",
                0,
              ],
            },
          },
          totalDebitTransactions: {
            $sum: {
              $cond: [
                { $eq: ["$transactions.type", "debit"] },
                "$transactions.amount",
                0,
              ],
            },
          },
        },
      },
    ]);

    const totalPropertiesByTypes = await Property.aggregate([
      {
        $group: {
          _id: { $toLower: "$property_type" }, // Convert property_type to lowercase
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          property_type: "$_id",
          count: 1,
          percentage: {
            $multiply: [{ $divide: ["$count", totalProperties] }, 100],
          },
        },
      },
    ]);

    // Daily Aggregation
    const dailyAggregation = await Coins.aggregate([
      { $unwind: "$transactions" },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$transactions.timestamp",
            },
          },
          total_amount: { $sum: "$transactions.amount" },
          total_transactions: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: "$_id",
          total_amount: 1,
          total_transactions: 1,
        },
      },
      { $limit: 30 }, // Limit to the last 30 days
    ]);

    // Weekly Aggregation
    const weeklyAggregation = await Coins.aggregate([
      { $unwind: "$transactions" },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%U",
              date: "$transactions.timestamp",
              timezone: "UTC",
            },
          },
          total_amount: { $sum: "$transactions.amount" },
          total_transactions: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          week: "$_id",
          total_amount: 1,
          total_transactions: 1,
        },
      },
      { $limit: 7 }, // Limit to the last 7 weeks
    ]);

    // Monthly Aggregation
    const monthlyAggregation = await Coins.aggregate([
      { $unwind: "$transactions" },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m", date: "$transactions.timestamp" },
          },
          total_amount: { $sum: "$transactions.amount" },
          total_transactions: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          month: "$_id",
          total_amount: 1,
          total_transactions: 1,
        },
      },
      { $limit: 12 }, // Limit to the last 12 months
    ]);

    res.status(200).json({
      data: {
        totalUsers,
        totalProperties,
        totalTransactions,
        totalPropertiesByTypes,

        dailyAggregation,
        weeklyAggregation,
        monthlyAggregation,
      },
      message: "Dashboard data fetched successfully.",
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    next(error);
  }
};

export const updateDefaultCoinValues = async (req, res, next) => {
  const { newDefaultPropertyPostCost, newDefaultOwnerDetailsCost } = req.body;

  try {
    // Prepare the update object
    const updateFields = {};

    if (newDefaultPropertyPostCost !== undefined) {
      // Ensure the new default value is a valid number
      if (
        typeof newDefaultPropertyPostCost !== "number" ||
        newDefaultPropertyPostCost < 0
      ) {
        return res
          .status(400)
          .json({ code: 400, message: "Invalid property post coin value" });
      }
      updateFields.defaultPropertyPostCost = newDefaultPropertyPostCost;
    }

    if (newDefaultOwnerDetailsCost !== undefined) {
      // Ensure the new default value is a valid number
      if (
        typeof newDefaultOwnerDetailsCost !== "number" ||
        newDefaultOwnerDetailsCost < 0
      ) {
        return res
          .status(400)
          .json({ code: 400, message: "Invalid owner details coin value" });
      }
      updateFields.defaultOwnerDetailsCost = newDefaultOwnerDetailsCost;
    }

    // Check if there are fields to update
    if (Object.keys(updateFields).length === 0) {
      return res
        .status(400)
        .json({ code: 400, message: "No fields to update" });
    }

    // Update the default coin values in the Coins collection
    const updatedCoinConfig = await Coins.updateOne({}, { $set: updateFields });

    if (updatedCoinConfig.nModified === 0) {
      return res
        .status(404)
        .json({ code: 404, message: "Failed to update default coin values" });
    }

    res
      .status(200)
      .json({ code: 200, message: "Default coin values updated successfully" });
  } catch (error) {
    console.error("Error updating default coin values:", error);
    next(error);
  }
};
