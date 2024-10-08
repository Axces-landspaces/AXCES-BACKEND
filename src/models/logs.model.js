// Desc: Logs model for storing logs of user actions
import { Schema, model } from "mongoose";
const LogsSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    logData: {
      type: Object, // Changed from JSON to Object for better MongoDB compatibility
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "payment.captured",
        // "payment.failed",
        "order.paid",
        // "payment.dispute.created",
        // "refund.processed",
        // "webhook.received",
      ],
    },
  },
  {
    timestamps: true,
  }
);

const Logs = model("Logs", LogsSchema);
export default Logs;
