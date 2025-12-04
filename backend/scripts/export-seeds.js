const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lab-digitization-system';

async function exportSeeds() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully');

    const db = mongoose.connection.db;

    // Export ParameterMaster
    console.log('Exporting ParameterMaster...');
    const parameterMasters = await db.collection('parametermasters').find({}).toArray();
    const cleanedParameters = parameterMasters.map(p => ({
      parameterId: p.parameterId,
      parameterName: p.parameterName,
      aliases: p.aliases || [],
      possibleUnits: p.possibleUnits || [],
      valueType: p.valueType || 'numeric',
      description: p.description || ''
    }));

    const seedsDir = path.join(__dirname, '..', 'seeds');
    if (!fs.existsSync(seedsDir)) {
      fs.mkdirSync(seedsDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(seedsDir, 'parameterMaster.seed.json'),
      JSON.stringify(cleanedParameters, null, 2)
    );
    console.log(`Exported ${cleanedParameters.length} parameters to parameterMaster.seed.json`);

    // Export ParameterExclusion
    console.log('Exporting ParameterExclusion...');
    const exclusions = await db.collection('parameterexclusions').find({}).toArray();
    const cleanedExclusions = exclusions.map(e => ({
      excludedParameter: e.excludedParameter || '',
      unit: e.unit || null,
      reason: e.reason || '',
      isActive: e.isActive !== false,
      labName: e.labName || null
    }));

    fs.writeFileSync(
      path.join(seedsDir, 'parameterExclusion.seed.json'),
      JSON.stringify(cleanedExclusions, null, 2)
    );
    console.log(`Exported ${cleanedExclusions.length} exclusions to parameterExclusion.seed.json`);

    console.log('Export completed successfully!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error exporting seeds:', error);
    process.exit(1);
  }
}

exportSeeds();
