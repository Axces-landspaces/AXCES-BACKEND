import jwt from "jsonwebtoken";

export const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization.split(" ")[1];
  console.log({ token });
  if (!token) {
    return res.status(401).json({
      code: 401,
      data: {},
      message: "Access denied. No token provided.",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log({ decoded });
    req.user = decoded;
    next();
  } catch (error) {

    return res
      .status(401)
      .json({ code: 401, data: {}, message: "Unauthorized user" });
  }
};
