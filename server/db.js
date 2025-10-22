const mongoose = require("mongoose");
const { dbUser, dbPass, dbHost } = require("./config");

const mongoURI = `mongodb+srv://${dbUser}:${dbPass}@${dbHost}/user_data?retryWrites=true&w=majority`;

function connectDB() {
  return mongoose
    .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.error("MongoDB connection error:", err));
}

module.exports = { connectDB };
