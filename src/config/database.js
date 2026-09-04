const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const dbType = process.env.DB_TYPE || 'mongodb';

    if (dbType === 'mongodb') {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } else {
      // PostgreSQL via Sequelize
      const { Sequelize } = require('sequelize');
      const sequelize = new Sequelize(
        process.env.DB_NAME,
        process.env.DB_USER,
        process.env.DB_PASSWORD,
        {
          host: process.env.DB_HOST,
          port: process.env.DB_PORT || 5432,
          dialect: 'postgres',
          logging: process.env.NODE_ENV === 'development' ? console.log : false,
          pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
          }
        }
      );
      await sequelize.authenticate();
      console.log('✅ PostgreSQL Connected');
      global.sequelize = sequelize;
    }
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
