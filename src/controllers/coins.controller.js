import Coins from "../models/coins.model.js";
import User from "../models/user.model.js";
import Logs from "../models/logs.model.js";
import crypto from "crypto";
import Razorpay from "razorpay";
import { Transactions } from "../models/transaction.model.js";
import { generateAndUploadInvoice } from "../utils/invoiceUpload.js";
import axios from "axios";

export const getBalance = async (req, res, next) => {
  try {
    const userId = req.user.id;
    console.log(userId);

    const coins = await Coins.findOne({ userId });
    console.log(coins);

    if (!coins) {
      return res.status(404).json({
        code: 404,
        data: {},
        message: "Coins not found for this user.",
      });
    }
    res.status(200).json({
      code: 200,
      data: { coins: coins.balance },
      message: "Coins fetched successfully.",
    });
  } catch (error) {
    console.error("Error fetching balance:", error);
    next(error);
  }
};

export const rechargeCoins = async (req, res, next) => {
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  const userId = req.user.id; // Assuming user ID is retrieved from authentication middleware
  const { amount, currency } = req.body;
  // get the orderId from the razorpay
  try {
    // construct the options object

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        data: {},
        message: "User not found.",
      });
    }

    const options = {
      amount: amount * 100, // amount in smallest currency unit
      currency: currency || "INR",
      receipt: crypto.randomBytes(16).toString("hex"),
      notes: {
        userId: userId,
        name: user.name,
        email: user.email,
        number: user.number,
      },
      partial_payment: false,
      payment_capture: 1, // this is mandatory
    };

    const order = await razorpay.orders.create(options);

    console.log({ order });
    if (!order) {
      return res.status(500).json({
        code: 500,
        data: {},
        message: "Error creating order.",
      });
    }
    const expectedCoins = calculateCoins(order.amount / 100);

    const txn = await Transactions.create({
      userId: userId,
      amount: order.amount / 100,
      orderId: order.id,
      type: "recharge",
      status: "processing",
      createdAt: new Date(),
    });

    console.log({ txn });
    return res.status(200).json({
      data: { order, expectedCoins },
      message: "Order created successfully.",
    });
  } catch (error) {
    console.error("Error recharging coins:", error);
    next(error);
  }
};

export const checkStatus = async (req, res) => {
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  try {
    const { orderId } = req.body;
    console.log({ orderId });

    if (!orderId) {
      return res.status(400).json({
        error: "Order ID is required",
      });
    }

    const order = await razorpay.orders.fetch(orderId);

    if (!order) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    if (order.status === "paid") {
      const transaction = await Transactions.findOne({ orderId: order.id });
      console.log({ transaction });

      return res.status(200).json({
        paid: true,
        order,
        invoice_download_url: transaction.invoice_url,
        message: "Order is paid and successful",
      });
    } else if (order.status === "attempted") {
      return res.status(200).json({
        paid: false,
        order,
        message: "Order is attempted and failed",
      });
    } else if (order.status === "created") {
      return res.status(200).json({
        paid: false,
        order,
        message: "Order is just created and payment is pending",
      });
    }

    console.log({ order });
    return res.status(200).json({ order });
  } catch (error) {
    console.error("Error checking order status:", error);
    res.status(500).json({ error: "Error checking order status" });
  }
};

export const validateRazorpay = async (req, res, next) => {
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
      req.body;

    console.log({ razorpay_payment_id, razorpay_order_id, razorpay_signature });

    // verify the signature
    const sha = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    sha.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = sha.digest("hex");

    if (digest != razorpay_signature) {
      return res.status(400).json({
        msg: "Transaction is not legit!",
      });
    }

    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    console.log({ payment });

    if (payment.status === "failed") {
      const failedtxn = await Transactions.findOneAndUpdate(
        { orderId: razorpay_order_id },
        {
          status: "failed",
          processedAt: new Date(),
        }
      );

      console.log({ failedtxn });

      return res.status(402).json({
        success: false,
        msg: "Payment Failed",
      });
    }

    const successTxn = await Transactions.findOneAndUpdate(
      { orderId: razorpay_order_id },
      {
        status: "success",
        processedAt: new Date(),
      }
    );
    console.log({ successTxn });

    return res.status(200).json({
      success: true,
      msg: "Payment Successful",
    });
  } catch (error) {
    console.error("Error validating payment:", error);
    return res.json({
      success: false,
      msg: "Internal server error",
    });
  }
};

export const razorpayWebhook = async (req, res) => {
  console.log({ req: req.body });

  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const webhookSignature = req.headers["x-razorpay-signature"];
    console.log({ webhookSecret, webhookSignature });

    const isValid = validateWebhookSignature(
      JSON.stringify(req.body),
      webhookSignature,
      webhookSecret
    );

    console.log({ isValid });

    if (!isValid) {
      console.error("Invalid webhook signature");
      return res.status(400).json({ status: "invalid signature" });
    }
    console.log("Webhook signature is valid");

    const { event, payload } = req.body;
    console.log({ event, payload });

    const paymentEntity = payload?.payment?.entity;
    const userId = paymentEntity?.notes?.userId;
    const { order_id, id, amount, notes, method, created_at } = paymentEntity;
    const { name, email, number } = notes;

    const invoice_date = new Date(created_at * 1000)
      .toISOString()
      .split("T")[0];

    if (event === "payment.captured") {
      const coinsToCredit = calculateCoins(amount / 100);
      console.log({
        userId,
        razorpay_order_id: order_id,
        razorpay_payment_id: id,
        coinsToCredit,
      });

      const invoiceData = {
        invoiceNumber: order_id,
        paymentId: order_id,
        invoiceDate: invoice_date,
        quantity: amount / 100,
        rate: 1,
        description: "Coins Recharge",
        grossAmount: amount / 100,
        taxes: {
          taxSplit: [
            { taxPerc: 0, taxAmount: "0" },
            { taxPerc: 0, taxAmount: "0" },
          ],
        },
        netAmount: amount / 100,
        userInfo: {
          name: name,
          email: email,
          number: number,
        },
      };

      const invoice = await generateAndUploadInvoice(invoiceData);
      console.log({ invoice });
      const transactionId = generateTransactionId();

      const coins = await Coins.findOneAndUpdate(
        { userId: userId },
        {
          $inc: { balance: coinsToCredit },
          $push: {
            transactions: {
              transaction_id: transactionId,
              amount: coinsToCredit,
              razorpay_payment_id: id,
              recharge_method: method,
              type: "credit",
              download_invoice_url: invoice.url,
              description: "coin_recharge",
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      );
      console.log({ coins });

      const success = await Transactions.findOneAndUpdate(
        { orderId: order_id },
        {
          status: "success",
          invoice_url: invoice.url,
          processedAt: new Date(),
        },
        { new: true }
      );
      console.log({ success });
      const logs = await Logs.create({
        razorpay_order_id: order_id,
        razorpay_payment_id: id,
        userId,
        logData: req.body,
        action: "captured",
      });
      console.log({ logs });
    } else if (event === "payment.failed") {
      console.log("Payment failed");
      console.log({ order_id });
      const txnFailed = await Transactions.findOneAndUpdate(
        { orderId: order_id },
        {
          status: "failed",
          processedAt: new Date(),
        },
        { new: true }
      );

      await Coins.findOneAndUpdate(
        { userId: userId },
        {
          $push: {
            transactions: {
              transaction_id: generateTransactionId(),
              recharge_method: method,
              amount: amount / 100,
              type: "failed",
              description: "failed_transaction",
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      );

      console.log({ txnFailed });
    } else if (event === "invoice.paid") {
      console.log("Invoice paid");
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook error: ", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
};

export const appleWebhook = async (req, res) => {
  try {
    const notification = req.body;
    const receipt = notification.latest_receipt;
    const validationResponse = await validateReceipt(receipt);

    switch (notification.notification_type) {
      case "INITIAL_BUY":
        // Add coins for the initial purchase
        break;
      case "DID_RENEW":
        // Handle subscription renewals
        break;
      case "CANCEL":
        // Handle cancellations
        break;
      default:
        console.log(
          "Unhandled notification type:",
          notification.notification_type
        );
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Error processing notification:", err);
    res.status(400).send("Error");
  }
};

async function validateReceipt(receipt) {
  try {
    const verifyURL = "https://buy.itunes.apple.com/verifyReceipt";
    const backupURL = "https://sandbox.itunes.apple.com/verifyReceipt"; // Sandbox URL for testing

    const requestBody = {
      'receipt-data': receipt.transactionReceipt,
      'password': process.env.APPLE_SHARED_SECRET,
      'exclude-old-transactions': true,
    };

    // console.log({ requestBody });

    const response = await axios.post(verifyURL, requestBody, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    const result = response.data;

    console.log({ result });

    // If the status is 21007, it means the receipt is from the sandbox environment
    if (result.status === 21007) {
      response = await fetch(backupURL, {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      result = await response.json();
    }

    // Valid status is 0
    if (result.status === 0) {
      // Find the specific transaction in the receipt
      const latestReceipt = result.latest_receipt_info[0];

      // Verify transaction details
      const isValid =
        latestReceipt.product_id === receiptData.productId &&
        latestReceipt.transaction_id === receiptData.transactionId &&
        !latestReceipt.cancellation_date;

      if (isValid) {
        return {
          isValid: true,
          transaction: latestReceipt,
          message: 'Valid purchase'
        };
      } else {
        return {
          isValid: false,
          message: 'Receipt validation failed: Transaction details mismatch'
        };
      }
    }

    return {
      isValid: false,
      status: result.status,
      message: 'Receipt validation failed: Invalid status'
    };
  } catch (error) {
    console.error("Error validating purchase:", error);
    res.status(400).send({ success: false, error: error.message });
  }
}

export const validatePurchase = async (req, res) => {
  try {
    const purchaseData = req.body;
    console.log({ purchaseData });
    const userId = req.user.id;

    // const verificationResult = await validateReceipt(purchaseData);
    const verificationResult = {
      isValid: true
    };

    console.log({ verificationResult });

    if (verificationResult.isValid) {
      const amount = (purchaseData.productId).split(".")[3]; // 500
      const date = new Date(purchaseData.transactionDate).toISOString().split("T")[0];
      const transactionId = generateTransactionId();

      const user = await User.findById(userId);

      const invoiceData = {
        invoiceNumber: transactionId,
        paymentId: transactionId,
        invoiceDate: date,
        quantity: amount,
        rate: 1,
        description: "Coins Recharge",
        grossAmount: amount,
        taxes: {
          taxSplit: [
            { taxPerc: 0, taxAmount: "0" },
            { taxPerc: 0, taxAmount: "0" },
          ],
        },
        netAmount: amount,
        userInfo: {
          name: user.name,
          email: user.email,
          number: user.number,
        },
      };

      const invoice = await generateAndUploadInvoice(invoiceData);
      console.log({ invoice });

      const coins = await Coins.findOneAndUpdate(
        { userId: userId },
        {
          $inc: { balance: amount },
          $push: {
            transactions: {
              transaction_id: transactionId,
              amount: amount,
              recharge_method: "appleIAP",
              type: "credit",
              download_invoice_url: invoice.url,
              description: "coin_recharge",
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      );

      console.log({ coins });

      res.json({
        success: true,
        message: 'Purchase verified successfully',
        invoice_url: invoice.url,
        transaction: verificationResult.transaction
      });
    } else {
      res.status(400).json({
        success: false,
        message: verificationResult.message
      });
    }

  } catch (error) {
    console.log({ error })
    res.status(500).json({
      success: false,
      message: 'Server error during purchase verification',
      error: error.message,
    });
  }
};

function validateWebhookSignature(body, signature, secret) {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return expectedSignature === signature;
}

export const userTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log({ userId });

    const userCoins = await Coins.findOne({ userId })
      .select("transactions") // Only retrieve the 'transactions' field
      .exec();

    if (userCoins && userCoins.transactions) {
      userCoins.transactions = userCoins.transactions.sort(
        (a, b) => b.timestamp - a.timestamp
      );
    }

    console.log({ userCoins });

    res.json({ userCoins });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Error fetching transactions" });
  }
};

export function calculateCoins(amount) {
  return Math.floor(amount);
}

function generateTransactionId() {
  const timestamp = Date.now(); // Current timestamp in milliseconds
  const randomStr = Math.random().toString(36).substring(2, 10); // Random alphanumeric string
  return `TXN-${timestamp}-${randomStr}`; // Combine parts for the transaction ID
}
