require('dotenv').config();
const mongoose = require('mongoose');

async function fixOrderIndexes() {
  try {
    console.log('[FIX] Connecting to MongoDB...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log('[FIX] Connected to MongoDB successfully');

    const db = mongoose.connection.db;
    const collection = db.collection('orders');

    // Get existing indexes
    console.log('[FIX] Current indexes:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log('[FIX]   -', JSON.stringify(index));
    });

    // Drop the problematic barcode index if it exists
    try {
      console.log('[FIX] Dropping barcode index...');
      await collection.dropIndex('barcode_1');
      console.log('[FIX] Barcode index dropped successfully');
    } catch (error) {
      console.log('[FIX] Barcode index not found or already dropped');
    }

    // Create the new sparse index for barcode
    console.log('[FIX] Creating new sparse barcode index...');
    await collection.createIndex(
      { barcode: 1 },
      { unique: true, sparse: true }
    );
    console.log('[FIX] New barcode index created successfully');

    // Verify the indexes
    console.log('[FIX] Updated indexes:');
    const newIndexes = await collection.indexes();
    newIndexes.forEach(index => {
      console.log('[FIX]   -', JSON.stringify(index));
    });

    console.log('[FIX] Index fix completed successfully');

  } catch (error) {
    console.error('[FIX] ERROR:', error);
    console.error('[FIX] Stack trace:', error.stack);
  } finally {
    // Close database connection
    console.log('[FIX] Closing database connection...');
    await mongoose.connection.close();
    console.log('[FIX] Database connection closed');
    process.exit(0);
  }
}

// Run the fix function
fixOrderIndexes();