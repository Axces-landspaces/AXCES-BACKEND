import Property from "../models/property.model.js";
import Coins from "../models/coins.model.js";
import User from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { errorHandler } from "../utils/error.js";

export const postProperty = async (req, res, next) => {
  const id = req.params.id;

  const {
    listing_type,
    property_type,
    property_subtype,
    title,
    description,
    address,
    pincode,
    building_name,
    bedrooms,
    bathrooms,
    area_sqft,
    property_age,
    facing,
    floor_number,
    total_floors,
    furnish_type,
    available_from,
    monthly_rent,
    security_deposit,
    preferred_tenant,
    localities,
    landmark,
    facilities,
  } = req?.body;

  let location = JSON.parse(req.body.location);

  try {
    let property = await Property.findOne({
      "location.latitude": location.latitude,
      "location.longitude": location.longitude,
    });

    if (property) {
      if (
        property.location.latitude === location.latitude &&
        property.location.longitude === location.longitude
      ) {
        return next(errorHandler(400, res, "Property already exists"));
      }
    }

    if (!req.files || !req.files.images || req.files.images.length === 0) {
      return next(errorHandler(400, res, "Image upload is required"));
    }

    if (!property_type) {
      return next(errorHandler(400, res, "Property type is required"));
    }

    // making things mandatory for residential properties\
    // cuz i remove most of it from schema as required
    if (property_type === "residential") {
      if (
        !bedrooms ||
        !bathrooms ||
        !furnish_type ||
        !preferred_tenant ||
        !facilities
      ) {
        return next(
          errorHandler(
            400,
            res,
            "For residential properties, bedrooms, bathrooms,furnish type, facilities and preferred tenant are mandatory fields"
          )
        );
      }
    }

    if (!property_subtype) {
      return next(errorHandler(400, res, "Property subtype is required"));
    }

    if (property_type === "residential") {
      if (
        property_subtype === "office" ||
        property_subtype === "shop" ||
        property_subtype === "plot" ||
        property_subtype === "others"
      ) {
        return next(
          errorHandler(
            400,
            res,
            "commercial subtype is not allowed in residential"
          )
        );
      }
    }

    if (property_type === "commercial") {
      if (
        property_subtype === "apartment" ||
        property_subtype === "independent house" ||
        property_subtype === "independent floor" ||
        property_subtype === "pg" ||
        property_subtype === "villa"
      ) {
        return next(
          errorHandler(
            400,
            res,
            "residential subtype is not allowed in commercial"
          )
        );
      }
    }

    const imageLocalPath = req.files.images[0].path;
    console.log(req.files);
    const imageResponse = await uploadOnCloudinary(imageLocalPath);

    const owner_model = await User.findById(id);
    const owner_name = owner_model.name;
    const owner_phone = owner_model.number;

    // Create a new property
    property = new Property({
      listing_type,
      owner_name,
      owner_phone,
      property_type,
      property_subtype,
      purpose,
      title,
      description,
      address,
      pincode,
      location,
      building_name,
      bedrooms,
      bathrooms,
      area_sqft,
      property_age,
      facing,
      floor_number,
      total_floors,
      furnish_type,
      available_from,
      monthly_rent,
      security_deposit,
      preferred_tenant,
      localities,
      landmark,
      facilities,
      images: imageResponse.url,
    });

    // Fetch the default property post cost and user's coin balance
    const defaultCoinConfig = await Coins.findOne({});
    const defaultPropertyPostCost = defaultCoinConfig.defaultPropertyPostCost;

    const userCoins = await Coins.findOne({ userId: id });
    if (!userCoins || userCoins.balance < defaultPropertyPostCost) {
      return next(errorHandler(402, res, "Insufficient balance"));
    }

    // Save the property and update user's coin balance
    await property.save();

    userCoins.balance -= defaultPropertyPostCost;
    await userCoins.save();

    res.status(201).json({
      code: 201,
      data: property,
      message: "Property posted successfully",
    });
  } catch (error) {
    console.error("Error posting property:", error);
    next(error);
  }
};

export const editProperty = async (req, res, next) => {
  const { propertyId, updatedPropertyDetails } = req.body;

  try {
    const property = await Property.findOne({ _id: propertyId });

    if (!property) {
      return next(errorHandler(404, res, "Property not found"));
    }

    // Update property details
    Object.assign(property, updatedPropertyDetails);
    await property.save();

    res.status(201).json({
      code: 201,
      data: { updatedProperty: property },
      message: "Property updated successfully",
    });
  } catch (error) {
    console.error("Error updating property:", error);
    next(error);
  }
};

export const deleteProperty = async (req, res) => {
  const { propertyId } = req.body;

  try {
    const property = await Property.findByIdAndDelete(propertyId);

    if (!property) {
      return next(errorHandler(402, res, "Property not found"));
    }

    res
      .status(200)
      .json({ code: 200, data: {}, message: "Property deleted successfully" });
  } catch (error) {
    console.error("Error deleting property:", error);
    next(error);
  }
};

export const getPropertyDetails = async (req, res, next) => {
  const { id } = req.params;
  // console.log(id);

  try {
    const property = await Property.findById(id);
    // console.log(property);

    if (!property) {
      return next(errorHandler(404, res, "Property not found"));
    }

    res.status(200).json({
      code: 200,
      data: property,
      message: "Property details fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching property details:", error);
    next(error);
  }
};

import { getDistance } from "geolib";

export const listProperties = async (req, res, next) => {
  const { userLatitude, userLongitude, owner_id, filters } = req.body;
  const userId = req.user.id; 

  // this is the requested code for owner's properties
  if (owner_id) {
    console.log(owner_id);
    try {
      const ownerProperties = await Property.find({ owner_id });
      console.log(ownerProperties);
      if (!ownerProperties.length) {
        return res.status(404).json({
          code: 404,
          data: {},
          message: "No properties found for the given owner",
        });
      }

      return res.status(200).json({
        code: 200,
        data: ownerProperties,
        message: "Owner's properties fetched successfully",
      });
    } catch (error) {
      console.error("Error fetching owner's properties:", error);
      return next(error);
    }
  }

  try {
    // Fetch user's wishlist
    const userWishlist = await User.findById(userId).populate("wishlist");
    const wishlistPropertyIds =
      userWishlist?.wishlist.map((item) => item._id.toString()) || [];

    if (!userLatitude || !userLongitude) {
      return res.status(400).json({
        code: 400,
        data: {},
        message: "User latitude and longitude are required",
      });
    }

    const exactQuery = {};
    // Apply filters for exact match query
    if (filters) {
      if (filters.userId) {
        exactQuery.userId = {
          $regex: `\\b${filters.userId}\\b`,
          $options: "i",
        };
      }
      if (filters.listing_type) {
        exactQuery.listing_type = {
          $regex: `\\b${filters.listing_type}\\b`,
          $options: "i",
        };
      }
      if (filters.property_type) {
        exactQuery.property_type = {
          $regex: `\\b${filters.property_type}\\b`,
          $options: "i",
        };
      }
      if (filters.purpose) {
        exactQuery.purpose = {
          $regex: `\\b${filters.purpose}\\b`,
          $options: "i",
        };
      }
      if (filters.title) {
        exactQuery.title = { $regex: `\\b${filters.title}\\b`, $options: "i" };
      }
      if (filters.description) {
        exactQuery.description = {
          $regex: `\\b${filters.description}\\b`,
          $options: "i",
        };
      }
      if (filters.address) {
        exactQuery.address = {
          $regex: `\\b${filters.address}\\b`,
          $options: "i",
        };
      }
      if (filters.pincode) {
        exactQuery.pincode = {
          $regex: `\\b${filters.pincode}\\b`,
          $options: "i",
        };
      }

      if (filters.building_name) {
        exactQuery.building_name = {
          $regex: `\\b${filters.building_name}\\b`,
          $options: "i",
        };
      }
      if (filters.bedrooms) {
        exactQuery.bedrooms = filters.bedrooms;
      }
      if (filters.bathrooms) {
        exactQuery.bathrooms = filters.bathrooms;
      }
      if (filters.area_sqft) {
        exactQuery.area_sqft = filters.area_sqft;
      }
      if (filters.property_age) {
        exactQuery.property_age = filters.property_age;
      }
      if (filters.facing) {
        exactQuery.facing = {
          $regex: `\\b${filters.facing}\\b`,
          $options: "i",
        };
      }
      if (filters.floor_number) {
        exactQuery.floor_number = filters.floor_number;
      }
      if (filters.total_floors) {
        exactQuery.total_floors = filters.total_floors;
      }
      if (filters.furnish_type) {
        exactQuery.furnish_type = {
          $regex: `\\b${filters.furnish_type}\\b`,
          $options: "i",
        };
      }
      if (filters.available_from) {
        exactQuery.available_from = filters.available_from;
      }


      // if (filters.monthly_rent) {
      //   exactQuery.monthly_rent = filters.monthly_rent;
      // }

      // monthly rent filter - range based
      if (filters.monthly_rent && Array.isArray(filters.monthly_rent)) {
        if (filters.monthly_rent[0] && filters.monthly_rent[1]) {
          exactQuery.monthly_rent = {
            $gte: filters.monthly_rent[0],  // Minimum value
            $lte: filters.monthly_rent[1]   // Maximum value
          };
        }
      }


      if (filters.security_deposit) {
        exactQuery.security_deposit = filters.security_deposit;
      }
      if (filters.preferred_tenant) {
        exactQuery.preferred_tenant = {
          $regex: `\\b${filters.preferred_tenant}\\b`,
          $options: "i",
        };
      }
      if (filters.localities && Array.isArray(filters.localities)) {
        exactQuery.localities = {
          $regex: `\\b${filters.localities}\\b`,
          $options: "i",
        };
      }
      if (filters.landmark) {
        exactQuery.landmark = {
          $regex: `\\b${filters.landmark}\\b`,
          $options: "i",
        };
      }
      if (filters.facilities && Array.isArray(filters.facilities)) {
        exactQuery.facilities = { $all: filters.facilities };
      }
    }

    const exactProperties = await Property.find(exactQuery).lean();

    if (exactProperties.length === 0) {
      return res.status(200).json({
        code: 200,
        data: [],
        message: "No properties match the given filters",
      });
    }

    // Calculate distance and add it to the properties
    const addDistanceToProperties = (properties) => {
      return properties.map((property) => {
        if (
          !property.location ||
          !property.location.latitude ||
          !property.location.longitude
        ) {
          property.distance = Infinity; // or some default value
        } else {
          const distance = getDistance(
            { latitude: userLatitude, longitude: userLongitude },
            {
              latitude: property.location.latitude,
              longitude: property.location.longitude,
            }
          );
          property.distance = distance / 1000; // distance in kilometers
        }

        // Check if the property is in the user's wishlist
        property.isInWishlist = wishlistPropertyIds.includes(
          property._id.toString()
        );

        return property;
      });
    };

    const exactPropertiesWithDistance =
      addDistanceToProperties(exactProperties);

    exactPropertiesWithDistance.sort(
      (a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)
    );

    res.status(200).json({
      code: 200,
      data: exactPropertiesWithDistance.slice(0, 10), // Limit to 10 properties
      message: "Properties fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching properties:", error);
    next(error);
  }
};

export const contactOwner = async (req, res, next) => {
  const { propertyId } = req.params;
  const userId = req.user.id;

  try {
    if (!propertyId.match(/^[a-fA-F0-9]{24}$/)) {
      return next(errorHandler(404, res, "Property not found"));
    }

    // Find the property by ID
    const property = await Property.findById(propertyId);
    if (!property) {
      return next(errorHandler(404, res, "Property not found"));
    }

    // Fetch the default cost for contacting owner and user's coin balance
    const defaultCoinConfig = await Coins.findOne({});
    const defaultOwnerDetailsBalance =
      defaultCoinConfig.defaultOwnerDetailsCost;

    const userCoins = await Coins.findOne({ userId });
    if (!userCoins || userCoins.balance < defaultOwnerDetailsBalance) {
      return next(
        errorHandler(
          402,
          res,
          "Insufficient balance. Please recharge your coins"
        )
      );
    }

    // Deduct coins
    userCoins.balance -= defaultOwnerDetailsBalance;
    await userCoins.save();

    // Respond with owner's contact details
    res.status(200).json({
      code: 200,
      data: {
        owner_details: {
          owner_name: property.owner_name,
          contact_phone: property.owner_phone,
        },
      },
      message: "Contact details retrieved successfully",
    });
  } catch (error) {
    console.error("Error retrieving contact details:", error);
    next(error);
  }
};

export const addToWishlist = async (req, res, next) => {
  const { propertyId, action } = req.body;
  const userId = req.user.id;

  try {
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return next(errorHandler(404, res, "User not found"));
    }

    // Find the property
    const property = await Property.findById(propertyId);
    if (!property) {
      return next(errorHandler(404, res, "Property not found"));
    }

    // Check action and update wishlist
    if (action === 1) {
      // Add to wishlist
      if (user.wishlist.includes(propertyId)) {
        return next(errorHandler(400, res, "Property already in wishlist"));
      }
      user.wishlist.push(propertyId);
    } else if (action === -1) {
      // Remove from wishlist
      if (!user.wishlist.includes(propertyId)) {
        return next(errorHandler(400, res, "Property not found in wishlist"));
      }
      user.wishlist = user.wishlist.filter(
        (id) => id.toString() !== propertyId.toString()
      );
    } else {
      return next(errorHandler(400, res, "Invalid action"));
    }

    // Save the updated user
    await user.save();

    res.status(200).json({
      code: 200,
      data: { wishlist: user.wishlist },
      message:
        action === 1
          ? "Property added to wishlist"
          : "Property removed from wishlist",
    });
  } catch (error) {
    console.error("Error updating wishlist:", error);
    next(error);
  }
};

export const viewWishlist = async (req, res, next) => {
  const userId = req.user.id;
  console.log(userId);
  const user = await User.findById(userId).populate("wishlist");
  console.log(user);

  try {
    const user = await User.findById(userId).populate("wishlist");
    if (!user) {
      return next(errorHandler(404, res, "User not found"));
    }

    res.status(200).json({ status: "success", data: user.wishlist });
  } catch (error) {
    console.error("Error viewing wishlist:", error);
    next(error);
  }
};
