// node scripts/addColor.js
// to run: `node scripts/addColor.js`

require("dotenv").config();
const mongoose = require("mongoose");

const dbUser = process.env.DB_USER;
const dbPass = process.env.DB_PASSWORD;
const dbHost = process.env.DB_HOST;

const mongoURI = `mongodb+srv://${dbUser}:${dbPass}@${dbHost}/user_data?retryWrites=true&w=majority`;

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  coins: { type: Number, default: 0 },
  color: String,
});

const User = mongoose.model("User", userSchema, "users");

async function addColorField() {
  try {
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const result = await User.updateMany(
      { color: { $exists: false } },
      { $set: { color: "green" } }
    );

    console.log("Updated users with color:", result.modifiedCount);
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

addColorField();
