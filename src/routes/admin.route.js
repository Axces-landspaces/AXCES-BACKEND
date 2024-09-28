import express from "express";
import {
  adminGetTransactions,
  adminUpdateBalance,
  adminDashboard,
  getAllUsers,
  getUserDetails,
  updateProperty,
  updateUser,
  viewAllProperties,
  viewPropertyDetails,
  signinAdmin,
  updateDefaultCoinValues,
} from "../controllers/admin.controller.js";
import { verifyAdminToken } from "../middlewares/verifyAdmin.middleware.js";

const router = express.Router();
// Admin Signin
router.post("/signinAdmin", verifyAdminToken, signinAdmin);
// Get All Users
router.get("/users", verifyAdminToken, getAllUsers);


router.get("/dashboard", verifyAdminToken, adminDashboard);

// Get User Details
router.get("/users/:userId", verifyAdminToken, getUserDetails);

// Update User
// router.put("/users/:userId", verifyAdminToken, updateUser);
router.put("/updateUser", verifyAdminToken, updateUser);

// Get All Properties
router.get("/properties", verifyAdminToken, viewAllProperties);

// Get Property Details
router.get("/properties/:propertyId", verifyAdminToken, viewPropertyDetails);

// Update Property
// router.put("/properties/:propertyId", verifyAdminToken, updateProperty);
router.put("/updateProperties", verifyAdminToken, updateProperty);

// router.put("/coins/:userId", verifyAdminToken, adminUpdateBalance);
// route to get transactions of a particular user
router.get("/transactions/:userId", verifyAdminToken, adminGetTransactions);

router.patch("/coins/default", verifyAdminToken, updateDefaultCoinValues);

export default router;
