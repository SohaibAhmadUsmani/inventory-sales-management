const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Category = require('./models/Category');

dotenv.config();

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('DB Connected');

    // Skip deletion if the DB user doesn't have delete permission yet —
    // just log it and move on instead of crashing.
    try {
      await User.deleteMany();
      await Category.deleteMany();
    } catch (permErr) {
      console.warn('Skipping cleanup (no delete permission):', permErr.errmsg || permErr.message);
    }

    const existingAdmin = await User.findOne({ email: 'admin@example.com' });
    if (!existingAdmin) {
      await User.create({ name: 'Admin', email: 'admin@example.com', password: 'admin123', role: 'admin' });
      await User.create({ name: 'Staff', email: 'staff@example.com', password: 'staff123', role: 'staff' });
      console.log('Users created');
    } else {
      console.log('Users already exist, skipping');
    }

    const catCount = await Category.countDocuments();
    if (catCount === 0) {
      await Category.insertMany([
        { name: 'Electronics' },
        { name: 'Clothing' },
        { name: 'Groceries' },
        { name: 'Stationery' },
        { name: 'Furniture' },
      ]);
      console.log('Categories created');
    } else {
      console.log('Categories already exist, skipping');
    }

    console.log('Seed complete!');
    console.log('Admin: admin@example.com / admin123');
    console.log('Staff: staff@example.com / staff123');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seed();