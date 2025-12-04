const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lab-digitization-system';

async function importSeeds() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully');

    const db = mongoose.connection.db;
    const seedsDir = path.join(__dirname, '..', 'seeds');

    // Import ParameterMaster
    const parameterMasterFile = path.join(seedsDir, 'parameterMaster.seed.json');
    if (fs.existsSync(parameterMasterFile)) {
      console.log('Importing ParameterMaster...');
      const parameters = JSON.parse(fs.readFileSync(parameterMasterFile, 'utf8'));

      // Clear existing data
      await db.collection('parametermasters').deleteMany({});

      // Insert new data
      if (parameters.length > 0) {
        const result = await db.collection('parametermasters').insertMany(parameters);
        console.log(`Imported ${result.insertedCount} parameters`);
      }
    }

    // Import ParameterExclusion
    const exclusionFile = path.join(seedsDir, 'parameterExclusion.seed.json');
    if (fs.existsSync(exclusionFile)) {
      console.log('Importing ParameterExclusion...');
      const exclusions = JSON.parse(fs.readFileSync(exclusionFile, 'utf8'));

      // Clear existing data
      await db.collection('parameterexclusions').deleteMany({});

      // Add timestamps and default values
      const enrichedExclusions = exclusions.map(e => ({
        ...e,
        excludedBy: new mongoose.Types.ObjectId('000000000000000000000000'),
        excludedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      // Insert new data
      if (enrichedExclusions.length > 0) {
        const result = await db.collection('parameterexclusions').insertMany(enrichedExclusions);
        console.log(`Imported ${result.insertedCount} exclusions`);
      }
    }

    console.log('Import completed successfully!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error importing seeds:', error);
    process.exit(1);
  }
}

importSeeds();
