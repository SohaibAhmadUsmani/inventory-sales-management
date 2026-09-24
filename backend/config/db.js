const dns = require('dns');
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not defined. Please configure it in your .env file.');
    }

    // Set reliable public DNS servers for MongoDB SRV record resolution when needed
    if (
      process.env.MONGODB_URI?.startsWith('mongodb+srv://') &&
      process.env.DISABLE_PUBLIC_DNS !== 'true'
    ) {
      try {
        dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
      } catch (err) {
        // Ignore if DNS server override is restricted
      }
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;

