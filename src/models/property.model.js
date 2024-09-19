import mongoose from "mongoose";

const PropertySchema = new mongoose.Schema(
  {
    listing_type: {
      type: String,
      enum: ["buy", "rent"],
      required: true,
    },
    owner_name: {
      type: String,
    },
    owner_phone: {
      type: Number,
    },
    // this is required as we have to get all the properties that a user has
    owner_id: {
      // type: mongoose.Schema.Types.ObjectId,
      type: String,
      // ref: "User",
      required: true,
    },

    // TODO: add types and subtypes - done 
    property_type: {
      type: String,
      enum: ["residential", "commercial"],
      required: true,
    },
    property_subtype: {
      type: String,
      enum: [
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
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    pincode: {
      type: String,
      required: true,
    },
    location: {
      latitude: {
        type: Number,
        required: true,
      },
      longitude: {
        type: Number,
        required: true,
      },
    },
    building_name: {
      type: String,
      required: true,
    },
    bedrooms: {
      type: Number,
    },
    bathrooms: {
      type: Number,
    },
    area_sqft: {
      type: Number,
      required: true,
    },
    property_age: {
      type: String,
      required: true,
    },
    facing: {
      type: String,
      required: true,
    },
    floor_number: {
      type: Number,
      required: true,
    },
    total_floors: {
      type: Number,
      required: true,
    },
    furnish_type: {
      type: String,
    },
    available_from: {
      type: Date,
      required: true,
    },
    monthly_rent: {
      type: Number,
      required: true,
    },
    security_deposit: {
      type: Number,
      required: true,
    },
    preferred_tenant: {
      type: String,
    },
    localities: [
      {
        type: String,
        required: true,
      },
    ],
    landmark: {
      type: String,
      required: true,
    },
    facilities: [
      {
        type: String,
      },
    ],
    images: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true }
);

const Property = mongoose.model("Property", PropertySchema);
export default Property;
