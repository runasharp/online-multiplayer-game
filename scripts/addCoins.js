// node scripts/addCoins.js
// to run the script
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
});

const User = mongoose.model("User", userSchema, "users");

async function addCoinsField() {
  try {
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const result = await User.updateMany(
      { coins: { $exists: false } },
      { $set: { coins: 0 } }
    );

    console.log("Updated users:", result.modifiedCount);
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

addCoinsField();
