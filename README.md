# Backend Service Documentation

## Overview

This backend service is built with Node.js, Express, and MongoDB. It provides functionalities for managing properties, users, coins, and administrative tasks. The service includes features such as property listings, user profiles, coin transactions, and administrative actions.


## Models

### # Property

The Property model represents property listings. Key fields include:

- listing_type: Type of listing (buy or rent)
- owner_name, owner_phone, owner_id: Owner details
- property_type, purpose: Property type and purpose
- title, description, address, pincode: Basic property information
- location: Geographical coordinates (latitude and longitude)
- building_name, bedrooms, bathrooms, area_sqft, property_age, facing, floor_number, total_floors, furnish_type, available_from, monthly_rent, security_deposit, preferred_tenant: Detailed property attributes
- localities, landmark, facilities, images: Additional property data

### # User

The User model represents users in the system. Key fields include:

- number: Unique phone number
- name, email: User's personal information
- balance: Coin balance
- profilePicture: URL to the user's profile picture
- wishlist: List of properties saved by the user

### # Coins

The Coins model manages user coin balances and transactions. Key fields include:

- userId: Unique identifier for the user
- balance: Current coin balance
- defaultPropertyPostCost, defaultOwnerDetailsCost: Default costs for posting properties and owner details
- transactions: Array of transactions including amount and timestamp

### # Admin

The Admin model represents administrative users. Key fields include:

- username, password, email: Admin credentials
- role: Role of the admin (default is "admin")
- created_at, last_login: Timestamps for account creation and last login
- actions: Array of administrative actions with details and timestamps

## Controllers

### # Property Controller

Handles operations related to properties:

- createProperty: Adds a new property listing
- updateProperty: Updates an existing property
- deleteProperty: Deletes a property listing
- getPropertyById: Fetches property details by ID
- listProperties: Retrieves a list of properties with optional filters

### # User Controller

Manages user-related functionalities:

- createUser: Creates a new user
- updateUserProfile: Updates user profile details
- getUserProfile: Fetches user profile by ID
- addToWishlist: Adds a property to the user's wishlist
- removeFromWishlist: Removes a property from the user's wishlist

### # Coins Controller

Handles coin transactions and balance management:

- getBalance: Retrieves the user's coin balance
- rechargeCoins: Recharges the user's coin balance
- deductCoins: Deducts coins for specific actions

### # Admin Controller

Manages administrative tasks and actions:

- createAdmin: Creates a new admin user
- loginAdmin: Authenticates an admin user
- logAdminAction: Logs an administrative action with details
- getAdminActions: Retrieves a list of actions performed by the admin

## Services

### # Database Connection

- connectDB: Connects to MongoDB using Mongoose. Ensure process.env.MONGO_URL is set to your MongoDB connection string.

### # Cloudinary Integration

- uploadOnCloudinary(localFilePath): Uploads files to Cloudinary. Ensure Cloudinary credentials (process.env.CLOUDINARY_CLOUD_NAME, process.env.CLOUDINARY_API_KEY, process.env.CLOUDINARY_API_SECRET) are configured.

### # Distance Calculation

- calculateDistance(lat1, lon1, lat2, lon2): Calculates the distance between two geographical coordinates using the Haversine formula.

### # Error Handling

- errorHandler(statusCode, res, message): Standardizes error responses with a status code and message.

### # Autocomplete Service

- getAutocompleteSuggestions(req, res, next): Provides location-based autocomplete suggestions using the Nominatim API.

## Environment Variables

Ensure the following environment variables are set in your .env file:

- MONGO_URL: MongoDB connection string
- CLOUDINARY_CLOUD_NAME: Cloudinary cloud name
- CLOUDINARY_API_KEY: Cloudinary API key
- CLOUDINARY_API_SECRET: Cloudinary API secret

## Running the Project

1. Install Dependencies: npm install
2. Start the Server: npm start