require('dotenv').config();

module.exports = {
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017',
  dbName: process.env.DB_NAME || 'recetario',
  port: Number(process.env.PORT) || 3000,
  sessionSecret: process.env.SESSION_SECRET, // usado desde la Etapa 3
};
