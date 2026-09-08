const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Category = require('./models/Category');

dotenv.config();

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('DB Connected');

    await User.deleteMany();
    await Category.deleteMany();

    const admin = await User.create({ name: 'Admin', email: 'admin@example.com', password: 'admin123', role: 'admin' });
    const staff = await User.create({ name: 'Staff', email: 'staff@example.com', password: 'staff123', role: 'staff' });

    await Category.insertMany([
      { name: 'Electronics' },
      { name: 'Clothing' },
      { name: 'Groceries' },
      { name: 'Stationery' },
      { name: 'Furniture' },
    ]);

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
