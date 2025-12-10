require('dotenv').config();
const mongoose = require('mongoose');
const ParameterMaster = require('../models/ParameterMaster');

// Common lab parameters based on Example.json analysis
const commonParameters = [
  // Endocrine / Diabetes
  {
    parameterName: "HbA1c",
    aliases: ["HBA1C", "GLYCOSYLATED HEMOGLOBIN", "HEMOGLOBIN A1C", "A1C", "GLYCATED HEMOGLOBIN"],
    possibleUnits: ["%", "mmol/mol"],
    valueType: "numeric",
    description: "Average blood glucose over past 2-3 months"
  },
  {
    parameterName: "Glucose Fasting",
    aliases: ["FBS", "FASTING BLOOD SUGAR", "FASTING GLUCOSE", "GLUCOSE FASTING", "FASTING BLOOD GLUCOSE"],
    possibleUnits: ["mg/dL", "mmol/L"],
    valueType: "numeric",
    description: "Blood glucose after overnight fast"
  },
  {
    parameterName: "Glucose Postprandial",
    aliases: ["PPBS", "PP BLOOD SUGAR", "POSTPRANDIAL GLUCOSE", "GLUCOSE PP", "POST PRANDIAL BLOOD SUGAR"],
    possibleUnits: ["mg/dL", "mmol/L"],
    valueType: "numeric",
    description: "Blood glucose 2 hours after meal"
  },

  // Hematology
  {
    parameterName: "Hemoglobin",
    aliases: ["HB", "HGB", "HEMOGLOBIN (HB)"],
    possibleUnits: ["g/dL", "g/L"],
    valueType: "numeric",
    description: "Oxygen-carrying protein in red blood cells"
  },
  {
    parameterName: "WBC Count",
    aliases: ["WHITE BLOOD CELL COUNT", "WBC", "TOTAL LEUCOCYTE COUNT", "TLC", "LEUCOCYTE COUNT"],
    possibleUnits: ["thou/µL", "10^3/µL", "cells/µL", "x10^3/µL"],
    valueType: "numeric",
    description: "White blood cell count"
  },
  {
    parameterName: "RBC Count",
    aliases: ["RED BLOOD CELL COUNT", "RBC", "ERYTHROCYTE COUNT", "TOTAL RBC COUNT"],
    possibleUnits: ["mil/µL", "10^6/µL", "x10^6/µL"],
    valueType: "numeric",
    description: "Red blood cell count"
  },
  {
    parameterName: "Platelet Count",
    aliases: ["PLATELETS", "PLT", "PLATELET"],
    possibleUnits: ["thou/µL", "10^3/µL", "lakhs/µL", "x10^3/µL"],
    valueType: "numeric",
    description: "Platelet count for blood clotting"
  },
  {
    parameterName: "PCV",
    aliases: ["PACKED CELL VOLUME", "PCV (HAEMATOCRIT)", "HEMATOCRIT", "HCT"],
    possibleUnits: ["%"],
    valueType: "numeric",
    description: "Percentage of blood volume occupied by red blood cells"
  },
  {
    parameterName: "MCV",
    aliases: ["MEAN CORPUSCULAR VOLUME"],
    possibleUnits: ["fL"],
    valueType: "numeric",
    description: "Average red blood cell volume"
  },
  {
    parameterName: "MCH",
    aliases: ["MEAN CORPUSCULAR HEMOGLOBIN"],
    possibleUnits: ["pg"],
    valueType: "numeric",
    description: "Average hemoglobin per red blood cell"
  },
  {
    parameterName: "MCHC",
    aliases: ["MEAN CORPUSCULAR HEMOGLOBIN CONCENTRATION"],
    possibleUnits: ["g/dL", "%"],
    valueType: "numeric",
    description: "Average hemoglobin concentration in red blood cells"
  },
  {
    parameterName: "RDW",
    aliases: ["RED CELL DISTRIBUTION WIDTH", "RDW-CV"],
    possibleUnits: ["%"],
    valueType: "numeric",
    description: "Variation in red blood cell size"
  },

  // Lipid Profile
  {
    parameterName: "Cholesterol Total",
    aliases: ["TOTAL CHOLESTEROL", "CHOLESTEROL, TOTAL", "TC", "SERUM CHOLESTEROL"],
    possibleUnits: ["mg/dL", "mmol/L"],
    valueType: "numeric",
    description: "Total cholesterol in blood"
  },
  {
    parameterName: "Triglycerides",
    aliases: ["TG", "TRIGLYCERIDE", "SERUM TRIGLYCERIDES"],
    possibleUnits: ["mg/dL", "mmol/L"],
    valueType: "numeric",
    description: "Fat molecules in blood"
  },
  {
    parameterName: "HDL Cholesterol",
    aliases: ["HDL", "HDL CHOLESTEROL", "HIGH DENSITY LIPOPROTEIN", "CHOLESTEROL HDL"],
    possibleUnits: ["mg/dL", "mmol/L"],
    valueType: "numeric",
    description: "Good cholesterol"
  },
  {
    parameterName: "LDL Cholesterol",
    aliases: ["LDL", "CHOLESTEROL LDL", "LOW DENSITY LIPOPROTEIN", "LDL DIRECT"],
    possibleUnits: ["mg/dL", "mmol/L"],
    valueType: "numeric",
    description: "Bad cholesterol"
  },
  {
    parameterName: "VLDL Cholesterol",
    aliases: ["VLDL", "CHOLESTEROL VLDL", "VERY LOW DENSITY LIPOPROTEIN"],
    possibleUnits: ["mg/dL", "mmol/L"],
    valueType: "numeric",
    description: "Very low density lipoprotein"
  },
  {
    parameterName: "TC/HDL Ratio",
    aliases: ["TOTAL CHOLESTEROL/HDL RATIO", "CHOLESTEROL RATIO"],
    possibleUnits: [],
    valueType: "numeric",
    description: "Ratio of total cholesterol to HDL"
  },
  {
    parameterName: "LDL/HDL Ratio",
    aliases: ["LDL HDL RATIO"],
    possibleUnits: [],
    valueType: "numeric",
    description: "Ratio of LDL to HDL cholesterol"
  },

  // Liver Function
  {
    parameterName: "ALT",
    aliases: ["SGPT", "ALANINE AMINOTRANSFERASE", "SGPT/ALT", "ALT/SGPT", "ALANINE TRANSAMINASE"],
    possibleUnits: ["U/L", "IU/L"],
    valueType: "numeric",
    description: "Liver enzyme"
  },
  {
    parameterName: "AST",
    aliases: ["SGOT", "ASPARTATE AMINOTRANSFERASE", "SGOT/AST", "AST/SGOT", "ASPARTATE TRANSAMINASE"],
    possibleUnits: ["U/L", "IU/L"],
    valueType: "numeric",
    description: "Liver enzyme"
  },
  {
    parameterName: "ALP",
    aliases: ["ALKALINE PHOSPHATASE", "ALK PHOS"],
    possibleUnits: ["U/L", "IU/L"],
    valueType: "numeric",
    description: "Alkaline phosphatase enzyme"
  },
  {
    parameterName: "Bilirubin Total",
    aliases: ["TOTAL BILIRUBIN", "BILIRUBIN, TOTAL", "SERUM BILIRUBIN"],
    possibleUnits: ["mg/dL", "µmol/L"],
    valueType: "numeric",
    description: "Liver function and hemolysis marker"
  },
  {
    parameterName: "Bilirubin Direct",
    aliases: ["DIRECT BILIRUBIN", "BILIRUBIN, DIRECT", "CONJUGATED BILIRUBIN"],
    possibleUnits: ["mg/dL", "µmol/L"],
    valueType: "numeric",
    description: "Direct (conjugated) bilirubin"
  },
  {
    parameterName: "Bilirubin Indirect",
    aliases: ["INDIRECT BILIRUBIN", "BILIRUBIN, INDIRECT", "UNCONJUGATED BILIRUBIN"],
    possibleUnits: ["mg/dL", "µmol/L"],
    valueType: "numeric",
    description: "Indirect (unconjugated) bilirubin"
  },
  {
    parameterName: "Protein Total",
    aliases: ["TOTAL PROTEIN", "SERUM PROTEIN"],
    possibleUnits: ["g/dL", "g/L"],
    valueType: "numeric",
    description: "Total protein in blood"
  },
  {
    parameterName: "Albumin",
    aliases: ["SERUM ALBUMIN"],
    possibleUnits: ["g/dL", "g/L"],
    valueType: "numeric",
    description: "Main protein in blood"
  },
  {
    parameterName: "Globulin",
    aliases: ["SERUM GLOBULIN"],
    possibleUnits: ["g/dL", "g/L"],
    valueType: "numeric",
    description: "Globulin protein fraction"
  },
  {
    parameterName: "A/G Ratio",
    aliases: ["ALBUMIN GLOBULIN RATIO", "A:G RATIO", "ALBUMIN/GLOBULIN RATIO"],
    possibleUnits: [],
    valueType: "numeric",
    description: "Ratio of albumin to globulin"
  },

  // Kidney Function
  {
    parameterName: "Creatinine",
    aliases: ["CREATININE SERUM", "SERUM CREATININE", "CREAT"],
    possibleUnits: ["mg/dL", "µmol/L"],
    valueType: "numeric",
    description: "Kidney function marker"
  },
  {
    parameterName: "Blood Urea Nitrogen",
    aliases: ["BUN", "BLOOD UREA", "UREA NITROGEN", "UREA"],
    possibleUnits: ["mg/dL", "mmol/L"],
    valueType: "numeric",
    description: "Kidney function and protein metabolism marker"
  },
  {
    parameterName: "Uric Acid",
    aliases: ["URIC ACID SERUM", "SERUM URIC ACID", "UA"],
    possibleUnits: ["mg/dL", "µmol/L"],
    valueType: "numeric",
    description: "Gout and kidney stone marker"
  },
  {
    parameterName: "BUN/Creatinine Ratio",
    aliases: ["UREA/CREATININE RATIO"],
    possibleUnits: [],
    valueType: "numeric",
    description: "Ratio of BUN to creatinine"
  },

  // Thyroid Function
  {
    parameterName: "TSH",
    aliases: ["TSH (ULTRASENSITIVE)", "THYROID STIMULATING HORMONE", "THYROTROPIN"],
    possibleUnits: ["µIU/mL", "uIU/mL", "mIU/L"],
    valueType: "numeric",
    description: "Thyroid stimulating hormone"
  },
  {
    parameterName: "T3",
    aliases: ["TRIIODOTHYRONINE", "T3 TOTAL", "TOTAL T3"],
    possibleUnits: ["ng/dL", "nmol/L"],
    valueType: "numeric",
    description: "Triiodothyronine hormone"
  },
  {
    parameterName: "T4",
    aliases: ["THYROXINE", "T4 TOTAL", "TOTAL T4"],
    possibleUnits: ["µg/dL", "nmol/L"],
    valueType: "numeric",
    description: "Thyroxine hormone"
  },
  {
    parameterName: "Free T3",
    aliases: ["FT3", "FREE TRIIODOTHYRONINE"],
    possibleUnits: ["pg/mL", "pmol/L"],
    valueType: "numeric",
    description: "Free triiodothyronine"
  },
  {
    parameterName: "Free T4",
    aliases: ["FT4", "FREE THYROXINE"],
    possibleUnits: ["ng/dL", "pmol/L"],
    valueType: "numeric",
    description: "Free thyroxine"
  },

  // Electrolytes
  {
    parameterName: "Sodium",
    aliases: ["NA", "SERUM SODIUM", "SODIUM (NA+)"],
    possibleUnits: ["mEq/L", "mmol/L"],
    valueType: "numeric",
    description: "Sodium electrolyte"
  },
  {
    parameterName: "Potassium",
    aliases: ["K", "SERUM POTASSIUM", "POTASSIUM (K+)"],
    possibleUnits: ["mEq/L", "mmol/L"],
    valueType: "numeric",
    description: "Potassium electrolyte"
  },
  {
    parameterName: "Chloride",
    aliases: ["CL", "SERUM CHLORIDE", "CHLORIDE (CL-)"],
    possibleUnits: ["mEq/L", "mmol/L"],
    valueType: "numeric",
    description: "Chloride electrolyte"
  },

  // Urine Analysis
  {
    parameterName: "Protein (Urine)",
    aliases: ["URINE PROTEIN", "URINARY PROTEIN", "PROTEIN"],
    possibleUnits: [],
    valueType: "text",
    description: "Protein in urine (qualitative)"
  },
  {
    parameterName: "Glucose (Urine)",
    aliases: ["URINE GLUCOSE", "URINARY GLUCOSE", "URINE SUGAR"],
    possibleUnits: [],
    valueType: "text",
    description: "Glucose in urine (qualitative)"
  },
  {
    parameterName: "Ketones (Urine)",
    aliases: ["URINE KETONES", "KETONE BODIES"],
    possibleUnits: [],
    valueType: "text",
    description: "Ketones in urine (qualitative)"
  },
  {
    parameterName: "Specific Gravity",
    aliases: ["URINE SPECIFIC GRAVITY", "SP. GRAVITY"],
    possibleUnits: [],
    valueType: "numeric",
    description: "Urine concentration"
  },
  {
    parameterName: "pH (Urine)",
    aliases: ["URINE PH", "URINARY PH"],
    possibleUnits: [],
    valueType: "numeric",
    description: "Urine acidity/alkalinity"
  },
  {
    parameterName: "Pus Cells",
    aliases: ["PUS CELL (WBCS)", "URINARY PUS CELLS", "WBC (URINE)"],
    possibleUnits: ["/HPF"],
    valueType: "range",
    description: "Pus cells in urine microscopy"
  },
  {
    parameterName: "RBC (Urine)",
    aliases: ["RED BLOOD CELLS (URINE)", "URINARY RBC"],
    possibleUnits: ["/HPF"],
    valueType: "range",
    description: "Red blood cells in urine microscopy"
  },
  {
    parameterName: "Epithelial Cells",
    aliases: ["EPITHELIAL CELLS (URINE)", "EPI CELLS"],
    possibleUnits: ["/HPF", "/LPF"],
    valueType: "range",
    description: "Epithelial cells in urine"
  },

  // Other Common Parameters
  {
    parameterName: "ESR",
    aliases: ["ERYTHROCYTE SEDIMENTATION RATE", "SED RATE"],
    possibleUnits: ["mm/hr", "mm/1st hr"],
    valueType: "numeric",
    description: "Inflammation marker"
  },
  {
    parameterName: "CRP",
    aliases: ["C-REACTIVE PROTEIN", "C REACTIVE PROTEIN"],
    possibleUnits: ["mg/L", "mg/dL"],
    valueType: "numeric",
    description: "Inflammation marker"
  },
  {
    parameterName: "Calcium",
    aliases: ["SERUM CALCIUM", "CA"],
    possibleUnits: ["mg/dL", "mmol/L"],
    valueType: "numeric",
    description: "Calcium electrolyte"
  },
  {
    parameterName: "Vitamin D",
    aliases: ["25-OH VITAMIN D", "VITAMIN D3", "25-HYDROXY VITAMIN D"],
    possibleUnits: ["ng/mL", "nmol/L"],
    valueType: "numeric",
    description: "Vitamin D level"
  },
  {
    parameterName: "Vitamin B12",
    aliases: ["CYANOCOBALAMIN", "B12"],
    possibleUnits: ["pg/mL", "pmol/L"],
    valueType: "numeric",
    description: "Vitamin B12 level"
  }
];

async function seedParameterMaster() {
  try {
    console.log('========================================');
    console.log('[SEED] Starting Parameter Master Seed');
    console.log('========================================');

    // Connect to MongoDB
    console.log('[SEED] Connecting to MongoDB...');
    console.log('[SEED] Connection string:', process.env.MONGODB_URI || 'mongodb://localhost:27017/lab-digitization');

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lab-digitization');
    console.log('[SEED] ✓ Connected to MongoDB');

    // Clear existing parameters (optional - comment out if you want to preserve existing data)
    // console.log('[SEED] Clearing existing parameters...');
    // await ParameterMaster.deleteMany({});
    // console.log('[SEED] ✓ Existing parameters cleared');

    console.log('[SEED] Seeding', commonParameters.length, 'parameters...');

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const param of commonParameters) {
      try {
        // Check if parameter already exists
        const existing = await ParameterMaster.findOne({ parameterName: param.parameterName });

        if (existing) {
          console.log('[SEED] Parameter already exists, skipping:', param.parameterName);
          skipped++;
        } else {
          // Generate parameterId from parameter name
          const parameterId = param.parameterName.toUpperCase().replace(/\s+/g, '_').replace(/[()]/g, '');

          const newParam = new ParameterMaster({
            ...param,
            parameterId
          });
          await newParam.save();
          console.log('[SEED] ✓ Created:', param.parameterName, '(ID:', newParam.parameterId, ')');
          created++;
        }
      } catch (error) {
        console.error('[SEED] ✗ Error creating parameter:', param.parameterName);
        console.error('[SEED] Error:', error.message);
      }
    }

    console.log('========================================');
    console.log('[SEED] Seed Complete!');
    console.log('[SEED] Created:', created);
    console.log('[SEED] Updated:', updated);
    console.log('[SEED] Skipped:', skipped);
    console.log('========================================');

    // Close connection
    await mongoose.connection.close();
    console.log('[SEED] Database connection closed');

    process.exit(0);
  } catch (error) {
    console.error('========================================');
    console.error('[SEED] ✗✗✗ SEED FAILED ✗✗✗');
    console.error('[SEED] Error:', error.message);
    console.error('[SEED] Stack:', error.stack);
    console.error('========================================');
    process.exit(1);
  }
}

// Run seed if called directly
if (require.main === module) {
  seedParameterMaster();
}

module.exports = { seedParameterMaster, commonParameters };
