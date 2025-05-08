import { upsertStreamUser } from "../lib/stream.js";
import User from "../models/User.js";
import jwt from "jsonwebtoken";

import bcrypt from 'bcrypt'


export async function signup(req, res) {
  const { email, password, fullName } = req.body;

  try {
    if (!email || !password || !fullName) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists, please use a different one" });
    }

    const idx = Math.floor(Math.random() * 100) + 1; // generate a num between 1-100
    const randomAvatar = `https://avatar.iran.liara.run/public/${idx}.png`;

    // Hash password before saving

    const newUser = await new  User({
      email,
      fullName,
      password: password,  // Store hashed password
      profilePic: randomAvatar,
    });

    await newUser.save();

    // JWT Token Generation
    const token = jwt.sign({ userId: newUser._id }, "secret", {
      expiresIn: "7d", // Token expiration
    });

    // Sending token in cookies
    res.cookie("jwt", token, {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days expiration
      httpOnly: true,  // Prevent XSS attacks
      sameSite: "strict",  // Prevent CSRF attacks
      secure: process.env.NODE_ENV === "production",  // Ensure it's secure only in production
    });

    res.status(201).json({ success: true, user: newUser });
  } catch (error) {
    console.log("Error in signup controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// export async function login(req, res) {
//   try {
//     const { email, password } = req.body;
//     console.log(req.body);

//     if (!email || !password) {
//       return res.status(400).json({ message: "All fields are required" });
//     }

//     const user = await User.findOne({ email });
//     // console.log(user);
//      if (!user) return res.status(401).json({ message: "Invalid email or password" });
//      console.log("User:", user);
   

//     const isPasswordCorrect = await user.matchPassword(password);
//     if (!isPasswordCorrect) return res.status(401).json({ message: "Invalid email or password" });

//     const token = jwt.sign({ userId: user._id }, "secret", {
//       expiresIn: "7d",
//     });

//     res.cookie("jwt", token, {
//       maxAge: 7 * 24 * 60 * 60 * 1000,
//       httpOnly: true, // prevent XSS attacks,
//       sameSite: "strict", // prevent CSRF attacks
//       secure: process.env.NODE_ENV === "production",
//     });

//     res.status(200).json({ success: true, user });
//   } catch (error) {
//     console.log("Error in login controller", error.message);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// }



export async function login(req, res) {
  try {
    const { email, password } = req.body;
    console.log("Email:", email);
    console.log("Password:", password);

    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({ email: email.trim() });
    console.log("User found:", user);

    if (!user) {
      console.log("❌ User not found after DB query");
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordCorrect = await user.matchPassword(password);
    console.log("Password match:", isPasswordCorrect);

    if (!isPasswordCorrect) {
      console.log("❌ Password is incorrect");
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user._id }, "secret", {
      expiresIn: "7d",
    });

    res.cookie("jwt", token, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    console.log("✅ Login successful");
    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("💥 Error in login controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export function logout(req, res) {
  res.clearCookie("jwt");
  res.status(200).json({ success: true, message: "Logout successful" });
}

export async function onboard(req, res) {
  try {
    const userId = req.user._id;

    const { fullName, bio, nativeLanguage, learningLanguage, location } = req.body;

    if (!fullName || !bio || !nativeLanguage || !learningLanguage || !location) {
      return res.status(400).json({
        message: "All fields are required",
        missingFields: [
          !fullName && "fullName",
          !bio && "bio",
          !nativeLanguage && "nativeLanguage",
          !learningLanguage && "learningLanguage",
          !location && "location",
        ].filter(Boolean),
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        ...req.body,
        isOnboarded: true,
      },
      { new: true }
    );

    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    try {
      await upsertStreamUser({
        id: updatedUser._id.toString(),
        name: updatedUser.fullName,
        image: updatedUser.profilePic || "",
      });
      console.log(`Stream user updated after onboarding for ${updatedUser.fullName}`);
    } catch (streamError) {
      console.log("Error updating Stream user during onboarding:", streamError.message);
    }

    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Onboarding error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
