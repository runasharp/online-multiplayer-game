const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

function getRandomColor() {
  const colors = [
    "red",
    "green",
    "blue",
    "orange",
    "purple",
    "yellow",
    "cyan",
    "magenta",
    "lime",
    "pink",
    "teal",
    "brown",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

function authRoutes({ User, JWT_SECRET }) {
  const router = express.Router();

  router.post("/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).send({ error: "Missing fields" });

    try {
      const existing = await User.findOne({ username });
      if (existing) return res.status(400).send({ error: "Username exists" });

      const hash = await bcrypt.hash(password, 10);

      const user = new User({
        username,
        password: hash,
        color: getRandomColor(), // <-- assign random color here
      });

      await user.save();

      res.send({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: "Server error" });
    }
  });

  router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).send({ error: "Missing fields" });

    try {
      const user = await User.findOne({ username });
      if (!user) return res.status(400).send({ error: "User not found" });

      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(400).send({ error: "Wrong password" });

      const token = jwt.sign(
        { id: user._id, username: user.username },
        JWT_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ success: true, token });
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: "Server error" });
    }
  });

  return router;
}

module.exports = { authRoutes };
