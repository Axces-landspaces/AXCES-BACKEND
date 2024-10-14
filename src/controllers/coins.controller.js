import Coins from "../models/coins.model.js";
import User from "../models/user.model.js";
import Logs from "../models/logs.model.js";
import crypto from "crypto";
import Razorpay from "razorpay";
import mongoose from "mongoose";

// Get user's coin balance
export const getBalance = async (req, res, next) => {
  try {
    const userId = req.user.id; // Assuming user ID is retrieved from authentication middleware
    console.log(userId);
    // Check if coins document exists for the user
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

// Recharge user's coins
// this is perfect no problem in this
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

    console.log(order);
    return res.status(200).json({
      data: { order, expectedCoins },
      message: "Order created successfully.",
    });
  } catch (error) {
    console.error("Error recharging coins:", error);
    next(error);
  }
};

export const validateRazorpay = async (req, res, next) => {
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  try {
    // get the userId from the req.user.id
    // const userId = req.user.id; // Assuming user ID is retrieved from authentication middleware
    console.log(req.body);
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
      return res.status(402).json({
        success: false,
        msg: "Payment Failed",
      });
    }

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

  let session;
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

    if (event === "payment.captured") {
      // update the user balance
      const paymentEntity = payload?.payment?.entity;
      const userId = paymentEntity?.notes?.userId;
      const { order_id, id, amount } = paymentEntity;
      const coinsToCredit = calculateCoins(amount / 100);
      // update the user balances put it in the transaction history
      console.log({
        userId,
        razorpay_order_id: order_id,
        razorpay_payment_id: id,
        coinsToCredit,
      });
      // transactions here
      // session = await mongoose.startSession();
      // session.startTransaction();

      const coins = await Coins.findOneAndUpdate(
        { userId: userId },
        {
          $inc: { balance: coinsToCredit },
          $push: {
            transactions: {
              amount: coinsToCredit,
              razorpay_payment_id: id,
              type: "credit",
              description: "coin_recharge",
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      );
      console.log({ coins });

      // Log the payment details to the server
      // update the user balances
      const logs = await Logs.create({
        razorpay_order_id: order_id,
        razorpay_payment_id: id,
        userId,
        logData: req.body,
        action: "captured",
      });
      console.log({ logs });
      // await session.commitTransaction();
    }
    // this is mandatory, to tell the razorpay backend to
    // know that you captured the request
    return res.status(200).json({ received: true });
  } catch (error) {
    // await session.abortTransaction();
    console.error("Webhook error: ", error);
    res.status(500).json({ error: "Webhook processing failed" });
  } finally {
    // await session.endSession();
  }
};

function validateWebhookSignature(body, signature, secret) {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return expectedSignature === signature;
}

// async function handlePaymentFailure(orderId) {
//   try {
//     await Transactions.findOneAndUpdate(
//       { razorpay_order_id: orderId },
//       {
//         status: "failed",
//         processedAt: new Date(),
//       }
//     );

//     return { success: false };
//   } catch (error) {
//     console.error("Error handling payment failure:", error);
//     throw error;
//   }
// }

export function calculateCoins(amount) {
  return Math.floor(amount / 2); // 1/2 of the payment amount
}
