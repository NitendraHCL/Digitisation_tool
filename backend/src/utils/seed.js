// Seed script to create initial super admin user
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const seedAdmin = async () => {
  try {
    console.log('[SEED] Starting seed process...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[SEED] Connected to MongoDB');

    // Check if super admin exists
    const existingAdmin = await User.findOne({ role: 'super_admin' });
    if (existingAdmin) {
      console.log('[SEED] Super admin already exists:', existingAdmin.email);
      process.exit(0);
    }

    // Create super admin
    const superAdmin = new User({
      email: 'admin@labdigital.com',
      password: 'Admin@123', // Change this in production!
      name: 'Super Admin',
      role: 'super_admin',
      isActive: true
    });

    await superAdmin.save();
    console.log('[SEED] ✓ Super admin created successfully!');
    console.log('[SEED] Email: admin@labdigital.com');
    console.log('[SEED] Password: Admin@123');
    console.log('[SEED] ⚠️  Please change the password after first login!');

    process.exit(0);
  } catch (error) {
    console.error('[SEED] Error:', error);
    process.exit(1);
  }
};

seedAdmin();