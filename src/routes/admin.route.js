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
  updatePropertyAndContractCharges,
  generateExcelFiles,
  viewAllTransactions,
} from "../controllers/admin.controller.js";
import { verifyAdminToken } from "../middlewares/verifyAdmin.middleware.js";

const router = express.Router();
// Admin Signin
router.post("/signinAdmin", signinAdmin);

// Admin Signup
router.post("/signupAdmin", signinAdmin);

// Get All Users
router.post("/users", verifyAdminToken, getAllUsers);

router.post("/transactions", verifyAdminToken, viewAllTransactions);

router.get("/dashboard", verifyAdminToken, adminDashboard);

router.put(
  "/update/charges",
  verifyAdminToken,
  updatePropertyAndContractCharges
);

// Get User Details
router.get("/users/:userId", verifyAdminToken, getUserDetails);

// Update User
// router.put("/users/:userId", verifyAdminToken, updateUser);
router.put("/updateUser", verifyAdminToken, updateUser);

// Get All Properties
router.post("/properties", verifyAdminToken, viewAllProperties);

// Get Property Details
router.get("/properties/:propertyId", verifyAdminToken, viewPropertyDetails);

// Update Property
// router.put("/properties/:propertyId", verifyAdminToken, updateProperty);
router.put("/updateProperties", verifyAdminToken, updateProperty);

// router.put("/coins/:userId", verifyAdminToken, adminUpdateBalance);
// route to get transactions of a particular user
router.get("/transactions/:userId", verifyAdminToken, adminGetTransactions);

// router.patch("/coins/default", verifyAdminToken, updateDefaultCoinValues);
router.post("/generate-excel", verifyAdminToken, generateExcelFiles);

export default router;
