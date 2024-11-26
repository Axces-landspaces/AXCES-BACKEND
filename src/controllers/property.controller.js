import Property from "../models/property.model.js";
import Coins from "../models/coins.model.js";
import User from "../models/user.model.js";
import mongoose from "mongoose";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { errorHandler } from "../utils/error.js";
import { getDistance } from "geolib";
import Prices from "../models/prices.model.js";
import { generateAndUploadInvoice } from "../utils/invoiceUpload.js";

export const postProperty = async (req, res, next) => {
  const owner_id = req.user.id;
  console.log("owner_id: ", owner_id, "typeof: ", typeof owner_id);

  const {
    listing_type,
    property_type,
    property_subtype,
    purpose,
    title,
    description,
    address,
    property_posted_by,
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

    if (property_type === "commercial" || property_type === "Commercial") {
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

    // const owner_model = await User.findById(id);
    // Create a new property
    property = new Property({
      listing_type,
      owner_id,
      property_type,
      property_subtype,
      property_posted_by,
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
    const charges = await Prices.findOne({});
    const propertyPostCharges = charges.propertyPostCost;

    let userCoins = await Coins.findOne({ userId: owner_id });
    const user = await User.findById(owner_id);

    if (!userCoins) {
      return next(errorHandler(402, res, "User coins entry not found"));
    }
    console.log({ userCoins });
    if (!userCoins || userCoins.balance < propertyPostCharges) {
      return next(errorHandler(402, res, "Insufficient balance"));
    }
    // Save the property and update user's coin balance

    userCoins.balance -= propertyPostCharges;
    // now generate the invoiceID
    const transactionId = generateTransactionId();
    const gstAmount = calculateGst(propertyPostCharges);
    console.log({ gstAmount });

    const invoiceData = {
      invoiceNumber: transactionId,
      paymentId: transactionId,
      invoiceDate: getCurrentDate(),
      quantity: propertyPostCharges,
      rate: 1,
      description: "Property Post Charges",
      grossAmount: propertyPostCharges - gstAmount,
      taxes: {
        taxSplit: [
          { taxPerc: 9, taxAmount: gstAmount / 2 },
          { taxPerc: 9, taxAmount: gstAmount / 2 },
        ],
      },
      netAmount: propertyPostCharges,
      userInfo: {
        name: user.name,
        email: user.email,
        number: user.number,
      },
    };

    const invoiceUrl = await generateAndUploadInvoice(invoiceData);
    console.log({ invoiceUrl });

    userCoins.transactions.push({
      transaction_id: transactionId,
      amount: propertyPostCharges,
      description: "property_post",
      timestamp: new Date(),
      type: "debit",
      download_invoice_url: invoiceUrl.url,
      balanceAfterDeduction: userCoins.balance - propertyPostCharges,
    });

    // generate the invoice

    await userCoins.save();
    await property.save();

    res.status(201).json({
      code: 201,
      data: property,
      download_invoice_url: invoiceUrl.url,
      message: "Property posted successfully",
    });
  } catch (error) {
    console.error("Error posting property:", error);
    next(error);
  }
};

export const editProperty = async (req, res, next) => {
  const { propertyId, updatedPropertyDetails } = req.body;

  // TODO: only allow to update certain fields if that property belong to the user
  const userId = req.user.id;
  console.log("userId: ", userId);

  if (!mongoose.Types.ObjectId.isValid(propertyId)) {
    return next(errorHandler(400, res, "Invalid property ID"));
  }

  const property = await Property.findOne({
    _id: propertyId,
    owner_id: userId,
  });

  if (!property) {
    return next(
      errorHandler(403, res, "You are not authorized to edit this property")
    );
  }

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

export const deleteProperty = async (req, res, next) => {
  const { propertyId } = req.body;
  // Delete a property, and only allow authorized users to delete
  const userId = req.user.id;
  console.log("userId: ", userId);

  if (!mongoose.Types.ObjectId.isValid(propertyId)) {
    return next(errorHandler(400, res, "Invalid property ID"));
  }

  const property = await Property.findOne({
    _id: propertyId,
    owner_id: userId,
  });
  console.log("property: ", property);

  if (!property) {
    return next(
      errorHandler(403, res, "You are not authorized to delete this property")
    );
  }

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
  const { pid } = req.params;

  const id = req.user.id;

  console.log({ pid });
  console.log({ id });

  try {
    let property = await Property.findById(pid);
    console.log({ property });

    if (!property) {
      return next(errorHandler(404, res, "Property not found"));
    }

    const owner = await User.findById(property.owner_id);
    console.log({ owner });
    // Convert to plain JavaScript object
    property = property.toObject();
    property.owner_name = owner.name;
    property.owner_phone = owner.number;
    property.owner_profile_picture = owner?.profilePicture;
    // Check if the property is in the user's wishlist

    // this is logged in user, not the owner
    // if that already in wishlist

    const user = await User.findById(id);

    console.log({ user });
    if (user && user.wishlist.includes(property._id)) {
      property.isInWishlist = true;
    } else {
      property.isInWishlist = false;
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

// export const listPropertiessafe = async (req, res, next) => {
//   const { userLatitude, userLongitude, owner_id, filters } = req.body;
//   const userId = req.user.id;
//
//   // this is the requested code for owner's properties
//   if (owner_id) {
//     console.log(owner_id);
//     try {
//       const ownerProperties = await Property.find({ owner_id });
//       console.log(ownerProperties);
//       if (!ownerProperties.length) {
//         return res.status(404).json({
//           code: 404,
//           data: {},
//           message: "No properties found for the given owner",
//         });
//       }
//
//       return res.status(200).json({
//         code: 200,
//         data: ownerProperties,
//         message: "Owner's properties fetched successfully",
//       });
//     } catch (error) {
//       console.error("Error fetching owner's properties:", error);
//       return next(error);
//     }
//   }
//
//   try {
//     // Fetch user's wishlist
//     const userWishlist = await User.findById(userId).populate("wishlist");
//     const wishlistPropertyIds =
//       userWishlist?.wishlist.map((item) => item._id.toString()) || [];
//
//     if (!userLatitude || !userLongitude) {
//       return res.status(400).json({
//         code: 400,
//         data: {},
//         message: "User latitude and longitude are required",
//       });
//     }
//
//     const exactQuery = {};
//     // Apply filters for exact match query
//     if (filters) {
//       if (filters.userId) {
//         exactQuery.userId = {
//           $regex: `\\b${filters.userId}\\b`,
//           $options: "i",
//         };
//       }
//       if (filters.listing_type) {
//         exactQuery.listing_type = {
//           $regex: `\\b${filters.listing_type}\\b`,
//           $options: "i",
//         };
//       }
//       if (filters.property_posted_by) {
//         exactQuery.property_posted_by = {
//           $regex: `\\b${filters.property_posted_by}\\b`,
//           $options: "i",
//         };
//       }
//       if (filters.property_type) {
//         exactQuery.property_type = {
//           $regex: `\\b${filters.property_type}\\b`,
//           $options: "i",
//         };
//       }
//       if (filters.purpose) {
//         exactQuery.purpose = {
//           $regex: `\\b${filters.purpose}\\b`,
//           $options: "i",
//         };
//       }
//       if (filters.title) {
//         exactQuery.title = { $regex: `\\b${filters.title}\\b`, $options: "i" };
//       }
//       if (filters.description) {
//         exactQuery.description = {
//           $regex: `\\b${filters.description}\\b`,
//           $options: "i",
//         };
//       }
//       if (filters.address) {
//         exactQuery.address = {
//           $regex: `\\b${filters.address}\\b`,
//           $options: "i",
//         };
//       }
//       if (filters.pincode) {
//         exactQuery.pincode = {
//           $regex: `\\b${filters.pincode}\\b`,
//           $options: "i",
//         };
//       }
//
//       if (filters.building_name) {
//         exactQuery.building_name = {
//           $regex: `\\b${filters.building_name}\\b`,
//           $options: "i",
//         };
//       }
//       if (filters.bedrooms) {
//         exactQuery.bedrooms = filters.bedrooms;
//       }
//       if (filters.bathrooms) {
//         exactQuery.bathrooms = filters.bathrooms;
//       }
//       if (filters.area_sqft) {
//         exactQuery.area_sqft = filters.area_sqft;
//       }
//       if (filters.property_age) {
//         exactQuery.property_age = filters.property_age;
//       }
//       if (filters.facing) {
//         exactQuery.facing = {
//           $regex: `\\b${filters.facing}\\b`,
//           $options: "i",
//         };
//       }
//       if (filters.floor_number) {
//         exactQuery.floor_number = filters.floor_number;
//       }
//       if (filters.total_floors) {
//         exactQuery.total_floors = filters.total_floors;
//       }
//       if (filters.furnish_type) {
//         exactQuery.furnish_type = {
//           $regex: `\\b${filters.furnish_type}\\b`,
//           $options: "i",
//         };
//       }
//       if (filters.available_from) {
//         exactQuery.available_from = filters.available_from;
//       }
//
//       // monthly rent filter - range based
//       if (filters.monthly_rent && Array.isArray(filters.monthly_rent)) {
//         if (filters.monthly_rent[0] && filters.monthly_rent[1]) {
//           exactQuery.monthly_rent = {
//             $gte: filters.monthly_rent[0], // Minimum value
//             $lte: filters.monthly_rent[1], // Maximum value
//           };
//         }
//       }
//
//       if (filters.security_deposit) {
//         exactQuery.security_deposit = filters.security_deposit;
//       }
//       if (filters.preferred_tenant) {
//         exactQuery.preferred_tenant = {
//           $regex: `\\b${filters.preferred_tenant}\\b`,
//           $options: "i",
//         };
//       }
//       if (filters.localities && Array.isArray(filters.localities)) {
//         exactQuery.localities = {
//           $regex: `\\b${filters.localities}\\b`,
//           $options: "i",
//         };
//       }
//       if (filters.landmark) {
//         exactQuery.landmark = {
//           $regex: `\\b${filters.landmark}\\b`,
//           $options: "i",
//         };
//       }
//       if (filters.facilities && Array.isArray(filters.facilities)) {
//         exactQuery.facilities = { $all: filters.facilities };
//       }
//     }
//
//     const exactProperties = await Property.find(exactQuery).lean();
//
//     if (exactProperties.length === 0) {
//       return res.status(200).json({
//         code: 200,
//         data: [],
//         message: "No properties match the given filters",
//       });
//     }
//
//     // Calculate distance and add it to the properties
//     const addDistanceToProperties = (properties) => {
//       return properties.map((property) => {
//         if (
//           !property.location ||
//           !property.location.latitude ||
//           !property.location.longitude
//         ) {
//           property.distance = Infinity; // or some default value
//         } else {
//           const distance = getDistance(
//             { latitude: userLatitude, longitude: userLongitude },
//             {
//               latitude: property.location.latitude,
//               longitude: property.location.longitude,
//             }
//           );
//           property.distance = distance / 1000; // distance in kilometers
//         }
//
//         // Check if the property is in the user's wishlist
//         property.isInWishlist = wishlistPropertyIds.includes(
//           property._id.toString()
//         );
//
//         return property;
//       });
//     };
//
//     const exactPropertiesWithDistance =
//       addDistanceToProperties(exactProperties);
//
//     exactPropertiesWithDistance.sort(
//       (a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)
//     );
//
//     res.status(200).json({
//       code: 200,
//       data: exactPropertiesWithDistance.slice(0, 10), // Limit to 10 properties
//       message: "Properties fetched successfully",
//     });
//   } catch (error) {
//     console.error("Error fetching properties:", error);
//     next(error);
//   }
// };

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

      // Fetch owner details
      const owner = await User.findById(owner_id);
      if (!owner) {
        return res.status(404).json({
          code: 404,
          data: {},
          message: "Owner not found",
        });
      }

      // Add owner details to each property
      const ownerPropertiesWithDetails = ownerProperties.map((property) => ({
        ...property.toObject(),
        owner_name: owner.name,
        owner_phone: owner.number,
      }));

      return res.status(200).json({
        code: 200,
        data: ownerPropertiesWithDetails,
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
      if (filters.property_posted_by) {
        exactQuery.property_posted_by = {
          $regex: `\\b${filters.property_posted_by}\\b`,
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

      // monthly rent filter - range based
      if (filters.monthly_rent && Array.isArray(filters.monthly_rent)) {
        if (filters.monthly_rent[0] && filters.monthly_rent[1]) {
          exactQuery.monthly_rent = {
            $gte: filters.monthly_rent[0], // Minimum value
            $lte: filters.monthly_rent[1], // Maximum value
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

    const sanitizeId = (id) => (id && typeof id === "string" ? id.trim() : id);
    // Fetch owner details for each property
    const ownerIds = exactProperties.map((property) =>
      sanitizeId(property.owner_id)
    );
    const owners = await User.find({ _id: { $in: ownerIds } }).lean();
    const ownerMap = owners.reduce((acc, owner) => {
      acc[sanitizeId(owner._id)] = owner;
      return acc;
    }, {});

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

        // Add owner details
        const owner = ownerMap[property.owner_id];
        if (owner) {
          property.owner_name = owner.name;
          property.owner_phone = owner.number;
        }

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
    const charges = await Prices.findOne({});
    const ownerDetailsCharges = charges.propertyContactCost;
    const userCoins = await Coins.findOne({ userId });
    if (!userCoins || userCoins.balance < ownerDetailsCharges) {
      return next(
        errorHandler(
          402,
          res,
          "Insufficient balance. Please recharge your coins"
        )
      );
    }
    const user = await User.findById(userId);

    const transactionId = generateTransactionId();
    const gstAmount = calculateGst(ownerDetailsCharges);

    // Respond with owner's contact details
    const invoiceData = {
      invoiceNumber: transactionId,
      paymentId: transactionId,
      invoiceDate: getCurrentDate(),
      quantity: ownerDetailsCharges,
      rate: 1,
      description: "Contact Owner Charges",
      grossAmount: ownerDetailsCharges - gstAmount,
      taxes: {
        taxSplit: [
          { taxPerc: 9, taxAmount: gstAmount / 2 },
          { taxPerc: 9, taxAmount: gstAmount / 2 },
        ],
      },
      netAmount: ownerDetailsCharges,
      userInfo: {
        name: user.name,
        email: user.email,
        number: user.number,
      },
    };

    const invoiceUrl = await generateAndUploadInvoice(invoiceData);

    userCoins.transactions.push({
      balanceAfterDeduction: userCoins.balance - ownerDetailsCharges,
      download_invoice_url: invoiceUrl.url,
      transaction_id: transactionId,
      amount: ownerDetailsCharges,
      description: "owner_details",
      timestamp: new Date(),
      type: "debit",
    });

    userCoins.balance -= ownerDetailsCharges;

    await userCoins.save();

    const propertyOwnerId = property.owner_id;
    console.log({ propertyOwnerId });

    const owner = await User.findById(propertyOwnerId);
    console.log({ owner });

    res.status(200).json({
      code: 200,
      data: {
        owner_details: {
          owner_name: owner.name,
          contact_phone: owner.number,
          contact_email: owner.email,
        },
      },
      download_invoice_url: invoiceUrl.url,
      message: "Contact details retrieved successfully",
    });
  } catch (error) {
    console.error("Error retrieving contact details:", error);
    next(error);
  }
};

export function calculateGst(amount) {
  const gst = 18;
  const gstAmount = (gst / 100) * amount;
  console.log(gstAmount);
  return gstAmount.toPrecision(2);
}

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

    const wishlistWithFlag = user.wishlist.map((property) => ({
      ...property.toObject(),
      isInWishlist: true,
    }));

    res.status(200).json({ status: "success", data: wishlistWithFlag });
  } catch (error) {
    console.error("Error viewing wishlist:", error);
    next(error);
  }
};

function generateTransactionId() {
  const timestamp = Date.now(); // Current timestamp in milliseconds
  const randomStr = Math.random().toString(36).substring(2, 10); // Random alphanumeric string
  return `TXN-${timestamp}-${randomStr}`; // Combine parts for the transaction ID
}

function getCurrentDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
