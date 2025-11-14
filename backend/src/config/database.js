const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('[DATABASE] ========== DATABASE CONNECTION ATTEMPT ==========');
    console.log('[DATABASE] Timestamp:', new Date().toISOString());
    console.log('[DATABASE] Mongoose version:', mongoose.version);
    console.log('[DATABASE] Node version:', process.version);
    console.log('[DATABASE] Platform:', process.platform);

    console.log('[DATABASE] Attempting to connect to MongoDB...');
    console.log('[DATABASE] URI:', process.env.MONGODB_URI?.replace(/\/\/.*@/, '//***@')); // Hide credentials in logs

    // Check if URI is set
    if (!process.env.MONGODB_URI) {
      console.error('[DATABASE] ✗ MONGODB_URI environment variable is not set!');
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    console.log('[DATABASE] Connection options:');
    console.log('[DATABASE]   - serverSelectionTimeoutMS: 5000');
    console.log('[DATABASE]   - socketTimeoutMS: 45000');

    const connectionStartTime = Date.now();
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Modern Mongoose options (v6+)
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    const connectionDuration = Date.now() - connectionStartTime;

    console.log('[DATABASE] ========== CONNECTION SUCCESSFUL ==========');
    console.log(`[DATABASE] ✓ MongoDB Connected: ${conn.connection.host}`);
    console.log(`[DATABASE] ✓ Database Name: ${conn.connection.name}`);
    console.log(`[DATABASE] ✓ Connection Port: ${conn.connection.port}`);
    console.log(`[DATABASE] ✓ Ready State: ${conn.connection.readyState} (1=connected)`);
    console.log(`[DATABASE] ✓ Connection established in ${connectionDuration}ms`);
    console.log('[DATABASE] ========================================');

    // Add connection event listeners for debugging
    mongoose.connection.on('error', (err) => {
      console.error('[DATABASE] ✗✗✗ MongoDB connection error ✗✗✗');
      console.error('[DATABASE] Error type:', err.constructor.name);
      console.error('[DATABASE] Error message:', err.message);
      console.error('[DATABASE] Error stack:', err.stack);
      console.error('[DATABASE] Timestamp:', new Date().toISOString());
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[DATABASE] ⚠️⚠️⚠️ MongoDB disconnected ⚠️⚠️⚠️');
      console.warn('[DATABASE] Connection state:', mongoose.connection.readyState);
      console.warn('[DATABASE] Timestamp:', new Date().toISOString());
    });

    mongoose.connection.on('reconnected', () => {
      console.log('[DATABASE] ✓✓✓ MongoDB reconnected ✓✓✓');
      console.log('[DATABASE] Connection state:', mongoose.connection.readyState);
      console.log('[DATABASE] Timestamp:', new Date().toISOString());
    });

    mongoose.connection.on('connected', () => {
      console.log('[DATABASE] ✓ MongoDB connection established');
      console.log('[DATABASE] Timestamp:', new Date().toISOString());
    });

    mongoose.connection.on('connecting', () => {
      console.log('[DATABASE] MongoDB connecting...');
      console.log('[DATABASE] Timestamp:', new Date().toISOString());
    });

    return conn;
  } catch (error) {
    console.error('[DATABASE] ========================================');
    console.error('[DATABASE] ✗✗✗ MongoDB Connection Failed ✗✗✗');
    console.error('[DATABASE] ========================================');
    console.error('[DATABASE] Error type:', error.constructor.name);
    console.error('[DATABASE] Error message:', error.message);
    console.error('[DATABASE] Error code:', error.code);
    console.error('[DATABASE] Stack trace:', error.stack);
    console.error('[DATABASE] Timestamp:', new Date().toISOString());
    console.error('[DATABASE] ========================================');

    // Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDB;