const dns = require('dns');
const mongoose = require('mongoose');

// Set reliable public DNS servers for MongoDB SRV record resolution on Windows
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (err) {
  // Ignore if DNS server override is restricted
}

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb+srv://vendorhub:vendorhub123@cluster0.lxzbk8y.mongodb.net/vendorhub-ai?appName=Cluster0';
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
