require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../models/Order');

// Sample order data based on the provided example
const sampleOrders = [
  {
    order_id: "333565373232",
    cug_code: "663b673d3467316c603231626e296037685d296836605e7d313762366066326633353430793430-3f3b67666731306c606660346e2960376858293033630c7d3a37396034666532686e6660793e31",
    VISIT_CODE: "4f4b1334404f4c717833",
    patient_age: "37 Y,4 M,15 D",
    gender: "female",
    date_of_test: new Date("2025-03-05"),
    lab_name: "Agilus Diagnostics",
    location: "Noida",
    status: "pending",
    test_types: ["Complete Blood Count", "Lipid Profile"],
    priority: "normal"
  },
  {
    order_id: "333565373233",
    cug_code: "773c783e4578327d713342737f3a1848685e3a9847716f8e424873477177337744354541804541-4040787778423171717771457f3a18499a3a4447741d8e4b48403a718877347f717181804f42",
    VISIT_CODE: "5g5c2445515d8282944",
    patient_age: "45 Y,2 M,10 D",
    gender: "male",
    date_of_test: new Date("2025-03-04"),
    lab_name: "Agilus Diagnostics",
    location: "Delhi",
    status: "in_progress",
    test_types: ["Thyroid Profile", "Vitamin D"],
    priority: "urgent"
  },
  {
    order_id: "333565373234",
    cug_code: "883d894f5689438e824453848g4b2959796f4ba958827ga955998458288448556652915251-5151898889534282828882568g4b295aab4b5558852e9f5c59514b829988458g8282928915g53",
    VISIT_CODE: "6h6d3556626e9393a55",
    patient_age: "28 Y,0 M,5 D",
    gender: "female",
    date_of_test: new Date("2025-03-03"),
    lab_name: "Dr. Lal PathLabs",
    location: "Gurugram",
    status: "completed",
    test_types: ["Liver Function Test", "Kidney Function Test"],
    priority: "normal"
  },
  {
    order_id: "333565373235",
    cug_code: "994eaa5g67aa549f935564959h5c3a6a8a7g5cba69938hba66aa96948399559667763a26362-6262aaaa9a6453939393939367ah5c3a6bbc5c6669963fag6d6a625c939aa9569h939393a926h64",
    VISIT_CODE: "7i7e4667737faa4b66",
    patient_age: "65 Y,8 M,20 D",
    gender: "male",
    date_of_test: new Date("2025-03-02"),
    lab_name: "Thyrocare",
    location: "Mumbai",
    status: "completed",
    test_types: ["HbA1c", "Fasting Blood Sugar", "Post Prandial Blood Sugar"],
    priority: "urgent",
    billing: {
      amount: 2500,
      currency: "INR",
      payment_status: "paid",
      payment_method: "online"
    }
  },
  {
    order_id: "333565373236",
    cug_code: "aa5fbbb6h78bb65ag466775a6ah6d4b7b9b8h6dcb7aa49icb77bbba7594aa66778874b37473-7373bbbb9b7564aa4a4a449a478bih6d4bccd6d777aaa74gbh7e7b736d4a4abb67ah4a4a4bba37i75",
    VISIT_CODE: "8j8f5778848gbb5c77",
    patient_age: "52 Y,11 M,25 D",
    gender: "female",
    date_of_test: new Date("2025-03-01"),
    lab_name: "Metropolis Healthcare",
    location: "Pune",
    status: "pending",
    test_types: ["Complete Urine Examination", "Urine Culture"],
    priority: "normal",
    notes: "Patient has history of UTI"
  },
  {
    order_id: "333565373237",
    cug_code: "bb6gcccc7i89cc76bh577886b7bi7e5c8caci7edcc8bb5ajdc88cccb86a5bb77889985c48584-8484ccccac8675bb5b5b55ab589cji7e5cddee7e888bbb85hci8f8c847e5b5bcc78bi5b5b5ccb48j86",
    VISIT_CODE: "9k9g6889959hcc6d88",
    patient_age: "42 Y,6 M,12 D",
    gender: "male",
    date_of_test: new Date("2025-02-28"),
    lab_name: "SRL Diagnostics",
    location: "Bangalore",
    status: "in_progress",
    test_types: ["COVID-19 RT-PCR", "Influenza Panel"],
    priority: "stat",
    sample_type: "Nasopharyngeal swab",
    sample_collected_at: new Date("2025-02-28T10:30:00")
  },
  {
    order_id: "333565373238",
    cug_code: "cc7hdddde8j9add87ci688997c8cj8f6d9dbdj8feed9cc6bked99dddc97b6cc889aa96d59695-9595ddddbd9786cc6c6c66bc69adkj8f6deeff8f999ccc96idj9g9d958f6c6cdd89cj6c6c6ddc59ka97",
    VISIT_CODE: "alagc799a6ajidd7e99",
    patient_age: "33 Y,3 M,8 D",
    gender: "female",
    date_of_test: new Date("2025-02-27"),
    lab_name: "Agilus Diagnostics",
    location: "Noida",
    status: "completed",
    test_types: ["Pregnancy Test", "Beta HCG"],
    priority: "urgent",
    billing: {
      amount: 1200,
      currency: "INR",
      payment_status: "paid",
      payment_method: "cash"
    }
  },
  {
    order_id: "333565373239",
    cug_code: "dd8ieeeeef9kabee98dj799aa8d9dka7g6aeecka8gffead7clfeaaeeeda8c7dd99abba7e6a7a6-a6a6eeeece9897dd7d7d77cd7abeka7g7effgag7eaaaddd97jeka9h9ae969g7d7dee9adk7d7d7eed6alb98",
    VISIT_CODE: "bmbi8daab7bkjee8faa",
    patient_age: "19 Y,1 M,3 D",
    gender: "male",
    date_of_test: new Date("2025-02-26"),
    lab_name: "PathKind Labs",
    location: "Jaipur",
    status: "pending",
    test_types: ["Dengue NS1", "Malaria Antigen", "Complete Blood Count"],
    priority: "urgent",
    referring_doctor: {
      name: "Dr. Sharma",
      registration_number: "MCI-12345",
      contact: "+91-9876543210"
    }
  },
  {
    order_id: "333565373240",
    cug_code: "ee9jffffggalcbff9aeka8abb9ealb8h7bffdlb9ihggfb8dmgffbfffeb9d8ee9abccb8f7b8b7-b7b7ffffdfa9a98ee8e8e88de8bcflb8h8fgghh8h8hfbbbeea8kflb9ai9bf969h8e8eff9bel8e8e8ffe7bmc9a",
    VISIT_CODE: "cncj9ebbc8clkff9gbb",
    patient_age: "71 Y,9 M,28 D",
    gender: "female",
    date_of_test: new Date("2025-02-25"),
    lab_name: "Agilus Diagnostics",
    location: "Kolkata",
    status: "completed",
    test_types: ["Cardiac Markers", "Troponin I", "ECG"],
    priority: "stat",
    notes: "Emergency case - chest pain",
    billing: {
      amount: 5000,
      currency: "INR",
      payment_status: "paid",
      payment_method: "insurance"
    }
  },
  {
    order_id: "333565373241",
    cug_code: "ffakhhhhhhmcddgga9bflb9bcc9afmc9i8cggemca8jihhgc9enhhgcghhhfc9ae9ffabddc9g8c9c8-c8c8hhhhega9bbaff9f9f99ef9cdgmc9i9ghhii9i9igcccffb9lgmcabi9cga7ai9f9fggacfm9f9f9hggf8cnd9b",
    VISIT_CODE: "dod0afccd9dmihhaihcc",
    patient_age: "24 Y,5 M,17 D",
    gender: "other",
    date_of_test: new Date("2025-02-24"),
    lab_name: "Quest Diagnostics",
    location: "Chennai",
    status: "in_progress",
    test_types: ["Hormone Panel", "Testosterone", "Estradiol"],
    priority: "normal",
    sample_type: "Blood",
    barcode: "QD2025022412345"
  }
];

async function seedOrders() {
  try {
    console.log('[SEED] ========== STARTING ORDER SEEDING ==========');
    console.log('[SEED] Connecting to MongoDB...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log('[SEED] Connected to MongoDB successfully');

    // Clear existing orders (optional - comment out if you want to keep existing data)
    const clearExisting = false; // Set to true to clear existing orders
    if (clearExisting) {
      console.log('[SEED] Clearing existing orders...');
      await Order.deleteMany({});
      console.log('[SEED] Existing orders cleared');
    }

    // Insert sample orders
    console.log(`[SEED] Inserting ${sampleOrders.length} sample orders...`);

    let successCount = 0;
    let failCount = 0;

    for (const orderData of sampleOrders) {
      try {
        // Check if order already exists
        const existingOrder = await Order.findOne({ order_id: orderData.order_id });

        if (existingOrder) {
          console.log(`[SEED] Order ${orderData.order_id} already exists, skipping...`);
          failCount++;
          continue;
        }

        const order = new Order(orderData);
        await order.save();
        console.log(`[SEED] ✓ Created order: ${order.order_id} - ${order.lab_name}, ${order.location}`);
        successCount++;
      } catch (error) {
        console.error(`[SEED] ✗ Failed to create order ${orderData.order_id}:`, error.message);
        failCount++;
      }
    }

    console.log('[SEED] ========== SEEDING COMPLETE ==========');
    console.log(`[SEED] Successfully created: ${successCount} orders`);
    console.log(`[SEED] Failed/Skipped: ${failCount} orders`);

    // Get statistics
    const totalOrders = await Order.countDocuments();
    const ordersByStatus = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    console.log('[SEED] ========== DATABASE STATISTICS ==========');
    console.log(`[SEED] Total orders in database: ${totalOrders}`);
    console.log('[SEED] Orders by status:');
    ordersByStatus.forEach(status => {
      console.log(`[SEED]   - ${status._id}: ${status.count}`);
    });

  } catch (error) {
    console.error('[SEED] ✗✗✗ ERROR during seeding:', error);
    console.error('[SEED] Stack trace:', error.stack);
  } finally {
    // Close database connection
    console.log('[SEED] Closing database connection...');
    await mongoose.connection.close();
    console.log('[SEED] Database connection closed');
    console.log('[SEED] ========================================');
    process.exit(0);
  }
}

// Run the seeding function
seedOrders();