import { model, Schema } from "mongoose";

const UserSchema = new Schema(
  {
    number: {
      type: Number,
      required: true,
      unique: true,
    },
    name: {
      type: String,
    },
    email: {
      type: String,
      unique: true,
    },
    balance: {
      type: Number,
      default: 0,
    },
    profilePicture: {
      type: String,
    },

    wishlist: [
      {
        type: Schema.Types.ObjectId,
        ref: "Property",
      },
    ],
  },
  { timestamps: true }
);

const User = model("User", UserSchema);
export default User;
