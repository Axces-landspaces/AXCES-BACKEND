import jwt from 'jsonwebtoken';
import Admin from '../models/admin.model.js';

const JWT_SECRET = process.env.JWT_SECRET;

export const verifyAdminToken = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]; // Assuming Bearer token
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = await Admin.findOne({email: decoded.email}); // Assuming the token contains admin ID
    if (!admin) {
      return res.status(401).json({ message: 'Invalid token or admin not found' });
    }
    req.admin = admin;
    next();
  } catch (error) {
    console.log(error);
    return res.status(401).json({ message: 'Invalid token' });
    
  }
};

export const verifyAdminDetails = (requiredUsername, requiredEmail) => async (req, res, next) => {
  try {
    const { admin } = req;
    if (requiredUsername && admin.username !== requiredUsername) {
      return res.status(403).json({ message: 'Username does not match' });
    }
    if (requiredEmail && admin.email !== requiredEmail) {
      return res.status(403).json({ message: 'Email does not match' });
    }
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Error verifying admin details' });
  }
};
