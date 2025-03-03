import express from "express";
import { authenticateToken } from "../middlewares/verifyUser.js";
import {
  getBalance,
  razorpayWebhook,
  rechargeCoins,
  validateRazorpay,
  userTransactions,
  checkStatus,
  appleWebhook,
  validatePurchase
} from "../controllers/coins.controller.js";

const router = express.Router();

router.get("/balance", authenticateToken, getBalance);
// this is used to get orderId from the razorpay + get some metadata from the user
router.post("/recharge", authenticateToken, rechargeCoins);
// router.post("/recharge", rechargeCoins);

router.post("/order/validate", authenticateToken, validateRazorpay);
// router.post("/order/validate", validateRazorpay);
router.get("/transactions", authenticateToken, userTransactions);
router.post("/payment/status", authenticateToken, checkStatus);
router.post("/webhook", razorpayWebhook);

router.post("/applewebhook", appleWebhook);
router.post('/validate-purchase', authenticateToken, validatePurchase);
export default router;
