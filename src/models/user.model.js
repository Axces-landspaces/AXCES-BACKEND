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
      required: [true, "Email is required"],
      unique: true,
    },
    // ! Balance is rudundant here, cuz there is two place that
    // ! balance field exists, then we need to update it two sides
    // so the balance is going to exist on the coins table, where all the 
    // data around payment gonna exists
    // balance: {
    //   type: Number,
    //   default: 0,
    // },
    profilePicture: {
      type: String,
    },
    device_token: {
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
