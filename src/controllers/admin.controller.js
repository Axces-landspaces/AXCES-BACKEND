import Admin from "../models/admin.model.js";
import User from "../models/user.model.js";
import Property from "../models/property.model.js";
import Prices from "../models/prices.model.js";
import excelJs from "exceljs";
import { errorHandler } from "../utils/error.js";
import Coins from "../models/coins.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { Transactions } from "../models/transaction.model.js";

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

export const signupAdmin = async (req, res) => {
  const { token, email, username, password } = req.body;

  // Verify the hard-coded token
  if (token !== HARD_CODED_SECRET_TOKEN) {
    return res.status(403).json({ message: "Invalid hard-coded token" });
  }

  try {
    // Check if admin exists
    const isAdminExists = await Admin.findOne({ username });
    if (isAdminExists) {
      return res.status(404).json({ message: "Admin already exist" });
    }

    // Compare password
    const isPasswordValid = await bcrypt.hash(password, 10);

    // Create new admin
    const newAdmin = await Admin.create({
      email,
      username,
      password: isPasswordValid,
    });
    console.log({ newAdmin });

    // Generate JWT token
    const token = jwt.sign(
      { id: newAdmin._id, username: newAdmin.username, email: newAdmin.email },
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

async function generateExcelUser(users) {
  const workbook = new excelJs.Workbook({ useSharedStrings: true });
  const worksheet = workbook.addWorksheet("Users");

  worksheet.columns = [
    { header: "ID", key: "id", width: 30 },
    { header: "Name", key: "name", width: 30 },
    { header: "Phone Number", key: "number", width: 30 },
    { header: "Email", key: "email", width: 50 },
    { header: "Profile Picture", key: "profile_picture", width: 50 },
    { header: "Balance", key: "balance", width: 20 },
    { header: "Device Token", key: "device_token", width: 80 },
    { header: "Wishlist", key: "wishlist", width: 50 },
    { header: "Properties", key: "properties", width: 50 },
    { header: "Transactions", key: "transactions", width: 50 },
    { header: "Created At", key: "createdAt", width: 30 },
    { header: "Updated At", key: "updatedAt", width: 30 },
  ];

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Add data rows
  users.forEach((user) => {
    worksheet.addRow({
      id: user._id.toString(),
      name: user.name,
      number: user.number,
      email: user.email,
      profile_picture: user.profilePicture || "",
      balance: user.balance,
      device_token: user.device_token,
      wishlist: user.wishlist.length ? JSON.stringify(user.wishlist) : "",
      properties: user.properties.length ? JSON.stringify(user.properties) : "",
      transactions: user.transactions.length ? JSON.stringify(user.transactions) : "",
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });
  });

  return await workbook.xlsx.writeBuffer();
}

// Get All Users working
export const getAllUsers = async (req, res) => {
  const { excel_download, filters } = req.body;

  const exactQuery = {};
  if (filters) {
    if (filters.dateRange) {
      const { startDate, endDate } = filters.dateRange;
      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        exactQuery.createdAt = {
          $gte: start, // Greater than or equal to start date
          $lte: end, // Less than or equal to end date
        };
      }
    }
    if (filters.number) {
      exactQuery.number = filters.number;
    }
    if (filters.email) {
      exactQuery.email = filters.email;
    }

    if (filters.userId) {
      exactQuery._id = filters.userId;
    }
  }
  console.log(exactQuery);

  try {
    const users = await User.find(exactQuery);
    const usersWithBalances = await Promise.all(
      users.map(async (user) => {
        const userBalance = await Coins.findOne({ userId: user._id });

        const properties = await Property.find({
          owner_id: user._id,
        });

        const coins = await Coins.findOne({ userId: user._id });
        const sortedCoins = coins.transactions.sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        );
        return {
          ...user.toObject(),
          balance: userBalance ? userBalance.balance : 0,
          properties,
          transactions: sortedCoins,
        };
      })
    );

    console.log({ usersWithBalances });

    if (excel_download) {
      // Generate Excel file based on the filtered data
      const excelBuffer = await generateExcelUser(usersWithBalances);
      // set headers for excel download
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", "attachment; filename=users.xlsx");

      return res.status(200).send(excelBuffer);
    }

    return res.json(usersWithBalances);
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
/**
 * Generate Excel file for properties data
 * @param {Array} properties - Filtered properties data
 * @returns {Promise<Buffer>} Excel file buffer
 */
async function generateExcel(properties) {
  const workbook = new excelJs.Workbook();
  const worksheet = workbook.addWorksheet("Properties");

  // Define columns based on your Property schema
  worksheet.columns = [
    { header: "Title", key: "title", width: 30 },
    { header: "Listing Type", key: "listing_type", width: 15 },
    { header: "Property Type", key: "property_type", width: 15 },
    { header: "Property Subtype", key: "property_subtype", width: 20 },
    { header: "Posted By", key: "property_posted_by", width: 15 },
    { header: "Address", key: "address", width: 40 },
    { header: "Pincode", key: "pincode", width: 10 },
    { header: "Building Name", key: "building_name", width: 25 },
    { header: "Bedrooms", key: "bedrooms", width: 10 },
    { header: "Bathrooms", key: "bathrooms", width: 10 },
    { header: "Area (sq ft)", key: "area_sqft", width: 15 },
    { header: "Property Age", key: "property_age", width: 15 },
    { header: "Facing", key: "facing", width: 15 },
    { header: "Floor Number", key: "floor_number", width: 15 },
    { header: "Total Floors", key: "total_floors", width: 15 },
    { header: "Furnish Type", key: "furnish_type", width: 20 },
    { header: "Available From", key: "available_from", width: 15 },
    { header: "Monthly Rent", key: "monthly_rent", width: 15 },
    { header: "Security Deposit", key: "security_deposit", width: 15 },
    { header: "Preferred Tenant", key: "preferred_tenant", width: 15 },
    { header: "Localities", key: "localities", width: 30 },
    { header: "Landmark", key: "landmark", width: 25 },
    { header: "Facilities", key: "facilities", width: 40 },
    { header: "Owner Name", key: "owner_name", width: 20 },
    { header: "Owner Email", key: "owner_email", width: 30 },
    { header: "Owner Phone", key: "owner_phone", width: 15 },
    {
      header: "Owner Profile Picture",
      key: "owner_profilepictures",
      width: 45,
    },
  ];

  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Add data rows
  properties.forEach((property) => {
    worksheet.addRow({
      title: property.title,
      listing_type: property.listing_type,
      property_type: property.property_type,
      property_subtype: property.property_subtype,
      property_posted_by: property.property_posted_by,
      address: property.address,
      pincode: property.pincode,
      building_name: property.building_name,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      area_sqft: property.area_sqft,
      property_age: property.property_age,
      facing: property.facing,
      floor_number: property.floor_number,
      total_floors: property.total_floors,
      furnish_type: property.furnish_type,
      available_from: property.available_from
        ? new Date(property.available_from).toLocaleDateString()
        : "",
      monthly_rent: property.monthly_rent,
      security_deposit: property.security_deposit,
      preferred_tenant: property.preferred_tenant,
      localities: Array.isArray(property.localities)
        ? property.localities.join(", ")
        : property.localities,
      landmark: property.landmark,
      facilities: Array.isArray(property.facilities)
        ? property.facilities.join(", ")
        : property.facilities,
      owner_name: property.owner_name,
      owner_email: property.owner_email,
      owner_phone: property.owner_phone,
      owner_profilepictures: property.owner_profilepictures,
    });
  });

  // Format number columns
  worksheet.getColumn("monthly_rent").numFmt = "₹#,##0";
  worksheet.getColumn("security_deposit").numFmt = "₹#,##0";
  worksheet.getColumn("area_sqft").numFmt = "#,##0";

  // Auto-filter for all columns
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columns.length },
  };

  return await workbook.xlsx.writeBuffer();
}

export const viewAllProperties = async (req, res, next) => {
  try {
    const { excel_download, filters } = req.body;
    // Fetch properties
    // filtering based on the state, pincode
    const exactQuery = {};
    // Apply filters for exact match query
    if (filters) {
      if (filters.dateRange) {
        const { startDate, endDate } = filters.dateRange;

        if (startDate && endDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);

          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);

          exactQuery.createdAt = {
            $gte: start, // Greater than or equal to start date
            $lte: end, // Less than or equal to end date
          };
        }
      }

      if (filters.pincode) {
        exactQuery.pincode = filters.pincode;
      }

      // Add enum validation for specific fields
      const enumFields = {
        listing_type: ["buy", "rent"],
        property_type: [
          "residential",
          "Residential",
          "Commercial",
          "commercial",
        ],
        property_subtype: [
          "office",
          "shop",
          "plot",
          "others",
          "apartment",
          "independent house",
          "villa",
          "independent floor",
          "pg",
        ],
        property_posted_by: ["owner", "agent"],
        furnish_type: ["Fully Furnished", "Semi Furnished", "Un-Furnished"],
        preferred_tenant: ["any", "family", "bachelor"],
      };

      // Validate and apply enum filters
      Object.entries(enumFields).forEach(([field, validValues]) => {
        if (filters[field] && validValues.includes(filters[field])) {
          exactQuery[field] = filters[field];
        }
      });
    }

    console.log({ exactQuery });
    const exactProperties = await Property.find(exactQuery).lean();
    console.log({ exactProperties });

    // ! don't touch this code below "propertiesWithUserDetails"
    // Manually fetch user details for each property
    const propertiesWithUserDetails = await Promise.all(
      exactProperties.map(async (property) => {
        // Sanitize owner_id to remove any newlines or extra spaces
        const sanitizedOwnerId = property?.owner_id?.trim();

        // Fetch user details based on the sanitized owner_id
        const ownerDetails = await User.findOne(
          { _id: sanitizedOwnerId },
          "name email number profilePicture"
        );

        return {
          ...property, // Spread the property details
          owner_name: ownerDetails?.name, // Attach the owner's details
          owner_phone: ownerDetails?.number,
          owner_email: ownerDetails?.email,
          owner_profilepictures: ownerDetails?.profilePicture,
        };
      })
    );
    console.log({ propertiesWithUserDetails });

    if (excel_download) {
      // Generate Excel file based on the filtered data
      const excelBuffer = await generateExcel(propertiesWithUserDetails);
      // set headers for excel download
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=properties.xlsx"
      );
      return res.status(200).send(excelBuffer);
    }

    return res.status(200).json({
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
// without date filter
// export const adminDashboard = async (req, res, next) => {
//   try {
//     // this is the total number of users
//     const totalUsers = await User.countDocuments();
//     // this is the total number of properties
//     const totalProperties = await Property.countDocuments();
//     // this is the number of wallet which is 1 to 1 relationship with user
//     // const totalTransactions = await Coins.countDocuments();
//     // total transactions made on the platform including credit and debit
//     const totalTransactions = await Coins.aggregate([
//       {
//         $unwind: "$transactions",
//       },
//       {
//         $group: {
//           _id: null,
//           totalTransactions: { $sum: 1 },
//           totalCreditTransactions: {
//             $sum: {
//               $cond: [
//                 { $eq: ["$transactions.type", "credit"] },
//                 "$transactions.amount",
//                 0,
//               ],
//             },
//           },
//           totalDebitTransactions: {
//             $sum: {
//               $cond: [
//                 { $eq: ["$transactions.type", "debit"] },
//                 "$transactions.amount",
//                 0,
//               ],
//             },
//           },
//         },
//       },
//     ]);

//     const totalPropertiesByTypes = await Property.aggregate([
//       {
//         $group: {
//           _id: { $toLower: "$property_type" }, // Convert property_type to lowercase
//           count: { $sum: 1 },
//         },
//       },
//       {
//         $project: {
//           _id: 0,
//           property_type: "$_id",
//           count: 1,
//           percentage: {
//             $multiply: [{ $divide: ["$count", totalProperties] }, 100],
//           },
//         },
//       },
//     ]);

//     // Daily Aggregation
//     const dailyAggregation = await Coins.aggregate([
//       { $unwind: "$transactions" },
//       {
//         $group: {
//           _id: {
//             $dateToString: {
//               format: "%Y-%m-%d",
//               date: "$transactions.timestamp",
//             },
//           },
//           total_amount: { $sum: "$transactions.amount" },
//           total_transactions: { $sum: 1 },
//         },
//       },
//       { $sort: { _id: 1 } },
//       {
//         $project: {
//           _id: 0,
//           date: "$_id",
//           total_amount: 1,
//           total_transactions: 1,
//         },
//       },
//       { $limit: 30 }, // Limit to the last 30 days
//     ]);

//     // Weekly Aggregation
//     const weeklyAggregation = await Coins.aggregate([
//       { $unwind: "$transactions" },
//       {
//         $group: {
//           _id: {
//             $dateToString: {
//               format: "%Y-%U",
//               date: "$transactions.timestamp",
//               timezone: "UTC",
//             },
//           },
//           total_amount: { $sum: "$transactions.amount" },
//           total_transactions: { $sum: 1 },
//         },
//       },
//       { $sort: { _id: 1 } },
//       {
//         $project: {
//           _id: 0,
//           week: "$_id",
//           total_amount: 1,
//           total_transactions: 1,
//         },
//       },
//       { $limit: 7 }, // Limit to the last 7 weeks
//     ]);

//     // Monthly Aggregation
//     const monthlyAggregation = await Coins.aggregate([
//       { $unwind: "$transactions" },
//       {
//         $group: {
//           _id: {
//             $dateToString: { format: "%Y-%m", date: "$transactions.timestamp" },
//           },
//           total_amount: { $sum: "$transactions.amount" },
//           total_transactions: { $sum: 1 },
//         },
//       },
//       { $sort: { _id: 1 } },
//       {
//         $project: {
//           _id: 0,
//           month: "$_id",
//           total_amount: 1,
//           total_transactions: 1,
//         },
//       },
//       { $limit: 12 }, // Limit to the last 12 months
//     ]);

//     // this is the default coins values
//     const propertyPostAndOwnerDetailsCost = await Prices.findOne();
//     const propertyContactAndPostCost = {
//       propertyPostCost: propertyPostAndOwnerDetailsCost.propertyPostCost,
//       ownerDetailsCost: propertyPostAndOwnerDetailsCost.propertyContactCost,
//     };

//     const totalRevenue = await Coins.aggregate([
//       {
//         $unwind: "$transactions",
//       },
//       {
//         $group: {
//           _id: null,
//           totalRevenue: {
//             $sum: {
//               $cond: [
//                 { $eq: ["$transactions.type", "debit"] },
//                 "$transactions.amount",
//                 0,
//               ],
//             },
//           },
//         },
//       },
//     ]);

//     const totalCoinsAddedByUsers = await Coins.aggregate([
//       {
//         $unwind: "$transactions",
//       },
//       {
//         $match: {
//           "transactions.type": "credit",
//         },
//       },
//       {
//         $group: {
//           _id: null,
//           totalCoinsAdded: { $sum: "$transactions.amount" },
//         },
//       },
//     ]);

//     const totalCoinsRedeemedInContactOwner = await Coins.aggregate([
//       {
//         $unwind: "$transactions",
//       },
//       {
//         $match: {
//           "transactions.type": "debit",
//           "transactions.description": "owner_details",
//         },
//       },
//       {
//         $group: {
//           _id: null,
//           totalCoinsRedeemed: { $sum: "$transactions.amount" },
//         },
//       },
//     ]);

//     const totalCoinsRedeemedInPropertyPost = await Coins.aggregate([
//       {
//         $unwind: "$transactions",
//       },
//       {
//         $match: {
//           "transactions.type": "debit",
//           "transactions.description": "property_post",
//         },
//       },
//       {
//         $group: {
//           _id: null,
//           totalCoinsRedeemed: { $sum: "$transactions.amount" },
//         },
//       },
//     ]);

//     const totalCoinsAdded = totalCoinsAddedByUsers[0]?.totalCoinsAdded || 0;
//     const totalCoinsRedeemedInContact =
//       totalCoinsRedeemedInContactOwner[0]?.totalCoinsRedeemed || 0;
//     const totalCoinsRedeemedInPost =
//       totalCoinsRedeemedInPropertyPost[0]?.totalCoinsRedeemed || 0;
//     const totalRevenueAmount = totalRevenue[0]?.totalRevenue || 0;

//     const totalRevenuePayload = {
//       totalCoinsAdded,
//       totalCoinsRedeemedInContact,
//       totalCoinsRedeemedInPost,
//       totalRevenueAmount,
//     };

//     res.status(200).json({
//       data: {
//         totalUsers,
//         totalProperties,
//         totalTransactions,
//         totalPropertiesByTypes,
//         totalRevenue: totalRevenuePayload,
//         dailyAggregation,
//         weeklyAggregation,
//         monthlyAggregation,
//         propertyContactAndPostCost,
//       },
//       message: "Dashboard data fetched successfully.",
//     });
//   } catch (error) {
//     console.error("Error fetching dashboard data:", error);
//     next(error);
//   }
// };

export const adminDashboard = async (req, res, next) => {
  try {
    // Get date range from query parameters
    const { fromDate, toDate } = req.query;

    // Create date filter object if dates are provided
    const dateFilter = {};
    if (fromDate && toDate) {
      dateFilter.createdAt = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate),
      };
    }

    // Basic counts with date filter
    const totalUsers = await User.countDocuments(dateFilter);
    const totalProperties = await Property.countDocuments(dateFilter);

    // Transaction aggregation with date filter
    const totalTransactions = await Coins.aggregate([
      {
        $unwind: "$transactions",
      },
      ...(fromDate && toDate
        ? [
            {
              $match: {
                "transactions.timestamp": {
                  $gte: new Date(fromDate),
                  $lte: new Date(toDate),
                },
              },
            },
          ]
        : []),
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

    // Properties by type with date filter
    const totalPropertiesByTypes = await Property.aggregate([
      ...(fromDate && toDate
        ? [
            {
              $match: {
                createdAt: {
                  $gte: new Date(fromDate),
                  $lte: new Date(toDate),
                },
              },
            },
          ]
        : []),
      {
        $group: {
          _id: { $toLower: "$property_type" },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          property_type: "$_id",
          count: 1,
          percentage: {
            $multiply: [
              { $divide: ["$count", { $literal: totalProperties }] },
              100,
            ],
          },
        },
      },
    ]);

    // Daily Aggregation with date filter
    const dailyAggregation = await Coins.aggregate([
      { $unwind: "$transactions" },
      ...(fromDate && toDate
        ? [
            {
              $match: {
                "transactions.timestamp": {
                  $gte: new Date(fromDate),
                  $lte: new Date(toDate),
                },
              },
            },
          ]
        : []),
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
    ]);

    // Weekly Aggregation with date filter
    const weeklyAggregation = await Coins.aggregate([
      { $unwind: "$transactions" },
      ...(fromDate && toDate
        ? [
            {
              $match: {
                "transactions.timestamp": {
                  $gte: new Date(fromDate),
                  $lte: new Date(toDate),
                },
              },
            },
          ]
        : []),
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
    ]);

    // Monthly Aggregation with date filter
    const monthlyAggregation = await Coins.aggregate([
      { $unwind: "$transactions" },
      ...(fromDate && toDate
        ? [
            {
              $match: {
                "transactions.timestamp": {
                  $gte: new Date(fromDate),
                  $lte: new Date(toDate),
                },
              },
            },
          ]
        : []),
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
    ]);

    const propertyPostAndOwnerDetailsCost = await Prices.findOne();
    const propertyContactAndPostCost = {
      propertyPostCost: propertyPostAndOwnerDetailsCost.propertyPostCost,
      ownerDetailsCost: propertyPostAndOwnerDetailsCost.propertyContactCost,
    };

    // Total Revenue with date filter
    const totalRevenue = await Coins.aggregate([
      { $unwind: "$transactions" },
      ...(fromDate && toDate
        ? [
            {
              $match: {
                "transactions.timestamp": {
                  $gte: new Date(fromDate),
                  $lte: new Date(toDate),
                },
              },
            },
          ]
        : []),
      {
        $group: {
          _id: null,
          totalRevenue: {
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

    // Coins added by users with date filter
    const totalCoinsAddedByUsers = await Coins.aggregate([
      { $unwind: "$transactions" },
      {
        $match: {
          "transactions.type": "credit",
          ...(fromDate && toDate
            ? {
                "transactions.timestamp": {
                  $gte: new Date(fromDate),
                  $lte: new Date(toDate),
                },
              }
            : {}),
        },
      },
      {
        $group: {
          _id: null,
          totalCoinsAdded: { $sum: "$transactions.amount" },
        },
      },
    ]);

    // Coins redeemed in contact owner with date filter
    const totalCoinsRedeemedInContactOwner = await Coins.aggregate([
      { $unwind: "$transactions" },
      {
        $match: {
          "transactions.type": "debit",
          "transactions.description": "owner_details",
          ...(fromDate && toDate
            ? {
                "transactions.timestamp": {
                  $gte: new Date(fromDate),
                  $lte: new Date(toDate),
                },
              }
            : {}),
        },
      },
      {
        $group: {
          _id: null,
          totalCoinsRedeemed: { $sum: "$transactions.amount" },
        },
      },
    ]);

    // Coins redeemed in property post with date filter
    const totalCoinsRedeemedInPropertyPost = await Coins.aggregate([
      { $unwind: "$transactions" },
      {
        $match: {
          "transactions.type": "debit",
          "transactions.description": "property_post",
          ...(fromDate && toDate
            ? {
                "transactions.timestamp": {
                  $gte: new Date(fromDate),
                  $lte: new Date(toDate),
                },
              }
            : {}),
        },
      },
      {
        $group: {
          _id: null,
          totalCoinsRedeemed: { $sum: "$transactions.amount" },
        },
      },
    ]);

    const totalCoinsAdded = totalCoinsAddedByUsers[0]?.totalCoinsAdded || 0;
    const totalCoinsRedeemedInContact =
      totalCoinsRedeemedInContactOwner[0]?.totalCoinsRedeemed || 0;
    const totalCoinsRedeemedInPost =
      totalCoinsRedeemedInPropertyPost[0]?.totalCoinsRedeemed || 0;
    const totalRevenueAmount = totalRevenue[0]?.totalRevenue || 0;

    const totalRevenuePayload = {
      totalCoinsAdded,
      totalCoinsRedeemedInContact,
      totalCoinsRedeemedInPost,
      totalRevenueAmount,
    };

    res.status(200).json({
      data: {
        totalUsers,
        totalProperties,
        totalTransactions,
        totalPropertiesByTypes,
        totalRevenue: totalRevenuePayload,
        dailyAggregation,
        weeklyAggregation,
        monthlyAggregation,
        propertyContactAndPostCost,
        dateRange: {
          from: fromDate || null,
          to: toDate || null,
        },
      },
      message: "Dashboard data fetched successfully.",
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    next(error);
  }
};

export const updatePropertyAndContractCharges = async (req, res, next) => {
  const { propertyPostCost, propertyContactCost } = req.body;
  try {
    const updateFields = {};

    if (propertyPostCost !== undefined) {
      // Ensure the new default value is a valid number
      if (typeof propertyPostCost !== "number" || propertyPostCost < 0) {
        return res
          .status(400)
          .json({ code: 400, message: "Invalid property post coin value" });
      }
      updateFields.propertyPostCost = propertyPostCost;
    }

    if (propertyContactCost !== undefined) {
      // Ensure the new default value is a valid number
      if (typeof propertyContactCost !== "number" || propertyContactCost < 0) {
        return res
          .status(400)
          .json({ code: 400, message: "Invalid owner details coin value" });
      }
      updateFields.propertyContactCost = propertyContactCost;
    }

    await Prices.updateOne({}, { $set: updateFields });
    const updatedValues = await Prices.findOne({});
    console.log({ updatedValues });
    res.status(200).json({
      message: "Property and Contact charges updated successfully",
      updatedCharges: {
        propertyPostCost: updatedValues.propertyPostCost,
        propertyContactCost: updatedValues.propertyContactCost,
      },
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

export const generateExcelFiles = async (req, res, next) => {
  const {} = req.body;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=filtered-data.xlsx"
  );

  res.send();
};

async function generateExcelTransaction(transaction) {
  const workbook = new excelJs.Workbook();
  const worksheet = workbook.addWorksheet("Transactions");

  worksheet.columns = [
    { header: "User Id", key: "userId", width: 30 },
    { header: "Order Id", key: "orderId", width: 30 },
    { header: "Amount", key: "amount", width: 50 },
    { header: "Status", key: "status", width: 30 },
    { header: "Created At", key: "createdAt", width: 30 },
    { header: "Name", key: "name", width: 20 },
    { header: "Email", key: "email", width: 30 },
    { header: "Phone", key: "phone", width: 15 },
    {
      header: "Profile Picture",
      key: "profilepictures",
      width: 45,
    },
  ];
  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // add data rows
  transaction.forEach((transaction) => {
    worksheet.addRow({
      userId: transaction.userId,
      orderId: transaction.orderId,
      paymentId: transaction.paymentId,
      amount: transaction.amount,
      status: transaction.status,
      createdAt: transaction.createdAt,
      name: transaction.name,
      email: transaction.email,
      phone: transaction.phone,
      profilepictures: transaction.profilepictures,
    });
  });

  return await workbook.xlsx.writeBuffer();
}

export const viewAllTransactions = async (req, res, next) => {
  try {
    const { excel_download, filters } = req.body;
    // Fetch properties
    const exactQuery = {};
    // Apply filters for exact match query
    if (filters) {
      if (filters.dateRange) {
        const { startDate, endDate } = filters.dateRange;
        if (startDate && endDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);

          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);

          exactQuery.createdAt = {
            $gte: start, // Greater than or equal to start date
            $lte: end, // Less than or equal to end date
          };
        }
      }

      if (filters.orderId) {
        exactQuery.orderId = filters.orderId;
      }
      if (filters.userId) {
        exactQuery.userId = filters.userId;
      }
    }

    const enumFields = {
      status: ["processing", "success", "failed"],
    };

    Object.entries(enumFields).forEach(([field, validValues]) => {
      if (filters[field] && validValues.includes(filters[field])) {
        exactQuery[field] = filters[field];
      }
    });

    console.log(exactQuery);
    const transactionsFromTransactionsModel = await Transactions.find(
      exactQuery
    ).lean();

    const razorpayTransactionWithUserDetails = await Promise.all(
      transactionsFromTransactionsModel.map(async (transaction) => {
        // Sanitize owner_id to remove any newlines or extra spaces
        const sanitizedOwnerId = transaction?.userId?.trim();

        // Fetch user details based on the sanitized owner_id
        const ownerDetails = await User.findOne(
          { _id: sanitizedOwnerId },
          "name email number profilePicture"
        );

        return {
          ...transaction, // Spread the property details
          userId: sanitizedOwnerId,
          name: ownerDetails?.name, // Attach the owner's details
          phone: ownerDetails?.number,
          email: ownerDetails?.email,
          profilepictures: ownerDetails?.profilePicture,
        };
      })
    );

    const coinsQuery = {};

    if (filters.userId) {
      coinsQuery.userId = filters.userId;
    }

    if (filters.transactionId) {
      const pipeline = [
        { $unwind: "$transactions" },
        {
          $match: {
            "transactions.transaction_id": filters.transactionId,
          },
        },
        {
          $project: {
            userId: 1,
            transaction: "$transactions",
          },
        },
      ];

      const transactionsFromCoinsModel = await Coins.aggregate(pipeline);
      const userId = transactionsFromCoinsModel[0]?.userId;
      const user = await User.findOne(
        { _id: userId },
        "number email name profilePicture"
      );
      if (!user) {
        return next(errorHandler(404, res, "User not found"));
      }
      const transactionsWithUserDetails = transactionsFromCoinsModel.map(
        (transaction) => ({
          ...transaction,
          user,
        })
      );

      return res.json({ transactionsWithUserDetails });
    }

    if (filters.dateRange) {
      const { startDate, endDate } = filters.dateRange;
      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        coinsQuery["transactions.timestamp"] = {
          $gte: start,
          $lte: end,
        };
      }
    }

    const transactionsFromCoinsModel = await Coins.aggregate([
      { $unwind: "$transactions" },
      { $match: coinsQuery },
      {
        $project: {
          userId: 1,
          transaction: "$transactions",
        },
      },
    ]);

    const coinTransactionWithUserDetails = await Promise.all(
      transactionsFromCoinsModel.map(async (transaction) => {
        // Sanitize owner_id to remove any newlines or extra spaces
        const sanitizedOwnerId = transaction?.userId;

        // Fetch user details based on the sanitized owner_id
        const ownerDetails = await User.findOne(
          { _id: sanitizedOwnerId },
          "name email number profilePicture"
        );

        return {
          ...transaction, // Spread the property details
          userId: sanitizedOwnerId,
          name: ownerDetails?.name, // Attach the owner's details
          phone: ownerDetails?.number,
          email: ownerDetails?.email,
          profilepictures: ownerDetails?.profilePicture,
        };
      })
    );

    if (excel_download) {
      const excelBuffer = await generateExcelTransaction(
        razorpayTransactionWithUserDetails
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=transactions.xlsx"
      );
      return res.status(200).send(excelBuffer);
    }

    return res.status(200).json({
      code: 200,
      razorpayTransactionWithUserDetails,
      coinTransactionWithUserDetails,
      message: "Properties fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching properties: ", error);
    next(error);
  }
};

export const searchProperties = async (req, res) => {
  try {
    // Destructure query parameters
    const {
      keyword = "",
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Validate keyword length to prevent overly broad searches
    if (keyword.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Keyword must be at least 2 characters long",
      });
    }

    // Create a search query focusing on title, description, and address
    const searchQuery = {
      $or: [
        { title: { $regex: keyword, $options: "i" } },
        { description: { $regex: keyword, $options: "i" } },
        { address: { $regex: keyword, $options: "i" } },
      ],
    };

    // Validate sort parameters
    const validSortFields = ["createdAt", "title"];
    const sanitizedSortBy = validSortFields.includes(sortBy)
      ? sortBy
      : "createdAt";
    const sanitizedSortOrder = sortOrder === "asc" ? 1 : -1;

    // Pagination
    const pageNumber = Math.max(1, Number(page));
    const itemsPerPage = Math.max(1, Number(limit));
    const skip = (pageNumber - 1) * itemsPerPage;

    // Perform search with pagination and sorting
    const [properties, total] = await Promise.all([
      Property.find(searchQuery)
        .select("-__v") // Exclude version key
        .sort({ [sanitizedSortBy]: sanitizedSortOrder })
        .skip(skip)
        .limit(itemsPerPage)
        .lean(), // Convert to plain JavaScript object for better performance
      Property.countDocuments(searchQuery),
    ]);

    // Calculate total pages
    const totalPages = Math.ceil(total / itemsPerPage);

    // Return paginated results
    res.status(200).json({
      success: true,
      page: pageNumber,
      totalPages,
      totalProperties: total,
      propertiesPerPage: itemsPerPage,
      properties: properties.map((property) => ({
        ...property,
        // Highlight matching keywords in results
        highlightedTitle: highlightKeyword(property.title, keyword),
        highlightedDescription: highlightKeyword(property.description, keyword),
        highlightedAddress: highlightKeyword(property.address, keyword),
      })),
    });
  } catch (error) {
    console.error("Search Properties Error:", error);
    res.status(500).json({
      success: false,
      message: "Error searching properties",
      error: error.message,
    });
  }
};

// Utility function to highlight matching keywords
function highlightKeyword(text, keyword) {
  if (!text || !keyword) return text;

  // Escape special regex characters
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Create a case-insensitive regex
  const regex = new RegExp(`(${escapedKeyword})`, "gi");

  // Replace matches with highlighted version
  return text.replace(regex, "<mark>$1</mark>");
}

// Additional search method with more advanced filtering
export const advancedSearch = async (req, res) => {
  try {
    const {
      keyword = "",
      exactMatch = false,
      page = 1,
      limit = 10,
    } = req.query;

    // Construct search query based on exact match or partial match
    let searchQuery;
    if (exactMatch) {
      // Exact match search
      searchQuery = {
        $or: [
          { title: keyword },
          { description: keyword },
          { address: keyword },
        ],
      };
    } else {
      // Partial match with word boundary for more precise matching
      searchQuery = {
        $or: [
          { title: { $regex: `\\b${keyword}\\b`, $options: "i" } },
          { description: { $regex: `\\b${keyword}\\b`, $options: "i" } },
          { address: { $regex: `\\b${keyword}\\b`, $options: "i" } },
        ],
      };
    }

    // Pagination
    const pageNumber = Math.max(1, Number(page));
    const itemsPerPage = Math.max(1, Number(limit));
    const skip = (pageNumber - 1) * itemsPerPage;

    // Perform search
    const [properties, total] = await Promise.all([
      Property.find(searchQuery).skip(skip).limit(itemsPerPage),
      Property.countDocuments(searchQuery),
    ]);

    // Calculate total pages
    const totalPages = Math.ceil(total / itemsPerPage);

    res.status(200).json({
      success: true,
      page: pageNumber,
      totalPages,
      totalProperties: total,
      propertiesPerPage: itemsPerPage,
      properties,
    });
  } catch (error) {
    console.error("Advanced Search Error:", error);
    res.status(500).json({
      success: false,
      message: "Error in advanced search",
      error: error.message,
    });
  }
};
