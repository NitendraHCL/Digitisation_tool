/**
 * Test script for enhanced getObservationByOrderId logic
 */
require('dotenv').config();
const externalDb = require('./src/services/externalDb.service');

async function testObservationLogic() {
  console.log('='.repeat(60));
  console.log('Testing Enhanced getObservationByOrderId Logic');
  console.log('='.repeat(60));

  // Test with a sample orderId - you can change this
  const testOrderId = process.argv[2] || 'TEST_ORDER_ID';

  console.log('\nTest Order ID:', testOrderId);
  console.log('-'.repeat(60));

  try {
    const result = await externalDb.getObservationByOrderId(testOrderId);

    if (result) {
      console.log('\n✅ Result Found:');
      console.log('   - orderId:', result.orderId);
      console.log('   - status:', result.status);
      console.log('   - serviceType_code:', result.serviceType_code);
      console.log('   - part_of_package:', result.part_of_package);
      console.log('   - g_creation_time:', result.g_creation_time);
      console.log('   - patient_name:', result.patient_name);
    } else {
      console.log('\n❌ No observation found for this orderId');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  process.exit(0);
}

testObservationLogic();
