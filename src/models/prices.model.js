import mongoose from "mongoose";

const PricesSchema = new mongoose.Schema(
  {
    propertyPostCost: {
      type: Number,
      required: true,
    },
    propertyContactCost: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

const Prices = new mongoose.model("Prices", PricesSchema);
export default Prices;
