const mongoose = require('mongoose');
const Report = require('../src/models/Report');
const Order = require('../src/models/Order');

// Connect to the correct database
mongoose.connect('mongodb://localhost:27017/lab_digitization', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function addDummyPatientNames() {
  try {
    console.log('Connected to MongoDB (lab_digitization)');

    // First, let's migrate orders from the wrong database to the correct one
    console.log('\n1. Migrating orders to correct database...');

    // Connect to old database and get orders
    const oldDb = mongoose.connection.useDb('lab_digitization');
    const OldOrder = oldDb.model('Order', Order.schema);
    const oldOrders = await OldOrder.find({});

    if (oldOrders.length > 0) {
      console.log(`Found ${oldOrders.length} orders in old database`);

      // Insert into correct database
      for (const order of oldOrders) {
        const orderData = order.toObject();
        delete orderData._id;

        const existingOrder = await Order.findOne({ order_id: orderData.order_id });
        if (!existingOrder) {
          await Order.create(orderData);
          console.log(`Migrated order: ${orderData.order_id}`);
        }
      }

      // Delete from old database after successful migration
      await OldOrder.deleteMany({});
      console.log('Cleared orders from old database');
    } else {
      console.log('No orders found in old database to migrate');
    }

    // 2. Add dummy patient names to existing reports for testing
    console.log('\n2. Adding dummy patient names to reports...');

    const reports = await Report.find({ status: { $in: ['ready', 'pending_review'] } })
      .select('orderId extractedData status');

    console.log(`Found ${reports.length} reports to update`);

    const dummyNames = [
      'John Smith',
      'Jane Doe',
      'Robert Johnson',
      'Mary Williams',
      'Michael Brown',
      'Patricia Jones',
      'David Garcia',
      'Jennifer Martinez',
      'James Rodriguez',
      'Linda Davis'
    ];

    const dummyAges = ['35 Y', '42 Y,3 M', '28 Y,6 M,15 D', '55 Y', '67 Y,2 M'];
    const genders = ['male', 'female'];

    for (let i = 0; i < reports.length; i++) {
      const report = reports[i];

      // Add dummy patient demographics if not present
      if (!report.extractedData) {
        report.extractedData = {};
      }

      if (!report.extractedData.patientName) {
        report.extractedData.patientName = dummyNames[i % dummyNames.length];
        report.extractedData.patientAge = dummyAges[i % dummyAges.length];
        report.extractedData.patientGender = genders[i % 2];
        report.extractedData.dateOfTest = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Random date in last 30 days

        await report.save();
        console.log(`Updated report ${report.orderId} with patient: ${report.extractedData.patientName}`);
      }
    }

    // 3. Create/update corresponding orders with matching and mismatching names
    console.log('\n3. Creating test orders with patient names...');

    for (let i = 0; i < Math.min(reports.length, 20); i++) {
      const report = reports[i];

      if (report.orderId) {
        let order = await Order.findOne({ order_id: report.orderId });

        if (!order) {
          // Create new order
          const patientName = i < 10
            ? report.extractedData.patientName  // First 10 orders match exactly
            : i < 15
            ? report.extractedData.patientName.split(' ')[0]  // Next 5 have partial match (first name only)
            : dummyNames[(i + 5) % dummyNames.length];  // Last 5 have completely different names

          order = new Order({
            order_id: report.orderId,
            cug_code: `CUG${String(i).padStart(3, '0')}`,
            VISIT_CODE: `VISIT${String(i).padStart(5, '0')}`,
            patient_name: patientName,
            patient_age: report.extractedData.patientAge || '35 Y',
            gender: report.extractedData.patientGender || 'male',
            date_of_test: report.extractedData.dateOfTest || new Date(),
            lab_name: 'Test Lab ' + (i % 3 + 1),
            location: ['Mumbai', 'Delhi', 'Bangalore'][i % 3],
            status: 'pending'
          });

          await order.save();
          console.log(`Created order ${order.order_id} with patient: ${order.patient_name} (Report has: ${report.extractedData.patientName})`);
        } else {
          // Update existing order with patient name
          if (!order.patient_name) {
            order.patient_name = i < 10
              ? report.extractedData.patientName
              : i < 15
              ? report.extractedData.patientName.split(' ')[0]
              : dummyNames[(i + 5) % dummyNames.length];

            await order.save();
            console.log(`Updated order ${order.order_id} with patient: ${order.patient_name}`);
          }
        }
      }
    }

    // 4. Summary
    console.log('\n=== Summary ===');
    const updatedReports = await Report.countDocuments({
      'extractedData.patientName': { $exists: true, $ne: null }
    });
    const totalOrders = await Order.countDocuments({});

    console.log(`Total reports with patient names: ${updatedReports}`);
    console.log(`Total orders in database: ${totalOrders}`);
    console.log('\nTest scenarios created:');
    console.log('- First 10 orders: Names match exactly with reports');
    console.log('- Next 5 orders: Partial name match (first name only)');
    console.log('- Last 5 orders: Complete mismatch in names');
    console.log('\nYou can now test the approval workflow with validation!');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addDummyPatientNames();