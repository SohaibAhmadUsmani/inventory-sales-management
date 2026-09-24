const dotenv = require('dotenv');
const connectDB = require('./config/db');
const User = require('./models/User');
const Category = require('./models/Category');

dotenv.config();

const seed = async () => {
  try {
    if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
      console.error('Refusing to run seeder in production without --force flag.');
      process.exit(1);
    }

    await connectDB();
    console.log('DB Connected');

    const shouldDestroy = process.argv.includes('--destroy') || process.argv.includes('--force') || process.env.NODE_ENV !== 'production';
    if (shouldDestroy) {
      // Skip deletion if the DB user doesn't have delete permission yet —
      // just log it and move on instead of crashing.
      try {
        await User.deleteMany();
        await Category.deleteMany();
      } catch (permErr) {
        console.warn('Skipping cleanup (no delete permission):', permErr.errmsg || permErr.message);
      }
    }

    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';
    const staffPassword = process.env.SEED_STAFF_PASSWORD || 'staff123';

    const existingAdmin = await User.findOne({ email: 'admin@example.com' });
    if (!existingAdmin) {
      await User.create({ name: 'Admin', email: 'admin@example.com', password: adminPassword, role: 'admin' });
      await User.create({ name: 'Staff', email: 'staff@example.com', password: staffPassword, role: 'staff' });
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
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Admin: admin@example.com / ${adminPassword}`);
      console.log(`Staff: staff@example.com / ${staffPassword}`);
    }
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seed();