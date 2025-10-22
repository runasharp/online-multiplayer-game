require("dotenv").config();

module.exports = {
  wsUrlProduction: process.env.WS_URL_PRODUCTION,
  dbUser: process.env.DB_USER,
  dbPass: process.env.DB_PASSWORD,
  dbHost: process.env.DB_HOST,
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET,
};
