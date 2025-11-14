require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:5001';
const API_URL = `${BASE_URL}/api`;

// Test user credentials
const testCredentials = {
  email: 'admin@labdigital.com',
  password: 'Admin@123'
};

let authToken = '';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function loginAndGetToken() {
  try {
    log('\n========== AUTHENTICATION ==========', 'cyan');
    log('Logging in as admin...', 'yellow');

    const response = await axios.post(`${API_URL}/auth/login`, testCredentials);

    // Handle different response structures
    if (response.data.data && response.data.data.token) {
      authToken = response.data.data.token;
      const user = response.data.data.user;
      log(`✓ Login successful`, 'green');
      log(`  User: ${user.email}`, 'blue');
      log(`  Role: ${user.role}`, 'blue');
    } else if (response.data.token) {
      authToken = response.data.token;
      log(`✓ Login successful`, 'green');
      if (response.data.user) {
        log(`  User: ${response.data.user.email}`, 'blue');
        log(`  Role: ${response.data.user.role}`, 'blue');
      }
    } else {
      throw new Error('No token in response');
    }

    return authToken;
  } catch (error) {
    log(`✗ Login failed: ${error.response?.data?.message || error.message}`, 'red');
    throw error;
  }
}

async function testGetAllOrders() {
  try {
    log('\n========== GET ALL ORDERS ==========', 'cyan');
    log('Fetching all orders...', 'yellow');

    const response = await axios.get(`${API_URL}/orders`, {
      headers: { Authorization: `Bearer ${authToken}` },
      params: { limit: 5, page: 1 }
    });

    log(`✓ Successfully fetched orders`, 'green');
    log(`  Total orders: ${response.data.pagination.total}`, 'blue');
    log(`  Page: ${response.data.pagination.page}/${response.data.pagination.pages}`, 'blue');
    log(`  Orders returned: ${response.data.data.length}`, 'blue');

    // Display first order as sample
    if (response.data.data.length > 0) {
      const firstOrder = response.data.data[0];
      log('\n  Sample Order:', 'yellow');
      log(`    Order ID: ${firstOrder.order_id}`, 'blue');
      log(`    Patient Age: ${firstOrder.patient_age}`, 'blue');
      log(`    Gender: ${firstOrder.gender}`, 'blue');
      log(`    Lab: ${firstOrder.lab_name}, ${firstOrder.location}`, 'blue');
      log(`    Status: ${firstOrder.status}`, 'blue');
    }

    return response.data;
  } catch (error) {
    log(`✗ Failed to fetch orders: ${error.response?.data?.message || error.message}`, 'red');
    throw error;
  }
}

async function testGetOrderById(orderId) {
  try {
    log(`\n========== GET ORDER BY ID ==========`, 'cyan');
    log(`Fetching order: ${orderId}...`, 'yellow');

    const response = await axios.get(`${API_URL}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    log(`✓ Successfully fetched order`, 'green');
    const order = response.data.data;
    log(`  Order ID: ${order.order_id}`, 'blue');
    log(`  Visit Code: ${order.VISIT_CODE}`, 'blue');
    log(`  Patient: ${order.patient_age}, ${order.gender}`, 'blue');
    log(`  Test Date: ${new Date(order.date_of_test).toLocaleDateString()}`, 'blue');
    log(`  Lab: ${order.lab_name}, ${order.location}`, 'blue');
    log(`  Status: ${order.status}`, 'blue');
    log(`  Priority: ${order.priority}`, 'blue');

    if (order.test_types && order.test_types.length > 0) {
      log(`  Test Types: ${order.test_types.join(', ')}`, 'blue');
    }

    return response.data;
  } catch (error) {
    log(`✗ Failed to fetch order: ${error.response?.data?.message || error.message}`, 'red');
    throw error;
  }
}

async function testSearchOrders() {
  try {
    log(`\n========== SEARCH ORDERS ==========`, 'cyan');
    log('Searching for female patients...', 'yellow');

    const response = await axios.get(`${API_URL}/orders/search`, {
      headers: { Authorization: `Bearer ${authToken}` },
      params: { gender: 'female' }
    });

    log(`✓ Search completed`, 'green');
    log(`  Orders found: ${response.data.count}`, 'blue');

    if (response.data.data.length > 0) {
      log('\n  Sample Results:', 'yellow');
      response.data.data.slice(0, 3).forEach(order => {
        log(`    - ${order.order_id}: ${order.patient_age}, ${order.lab_name}`, 'blue');
      });
    }

    return response.data;
  } catch (error) {
    log(`✗ Search failed: ${error.response?.data?.message || error.message}`, 'red');
    throw error;
  }
}

async function testGetOrderStats() {
  try {
    log(`\n========== ORDER STATISTICS ==========`, 'cyan');
    log('Fetching order statistics...', 'yellow');

    const response = await axios.get(`${API_URL}/orders/stats`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    log(`✓ Statistics fetched successfully`, 'green');

    const stats = response.data.data.summary;
    log('\n  Order Status Summary:', 'yellow');
    log(`    Total: ${stats.total}`, 'blue');
    log(`    Pending: ${stats.pending}`, 'blue');
    log(`    In Progress: ${stats.in_progress}`, 'blue');
    log(`    Completed: ${stats.completed}`, 'blue');
    log(`    Cancelled: ${stats.cancelled}`, 'blue');

    if (response.data.data.labDistribution.length > 0) {
      log('\n  Top Labs:', 'yellow');
      response.data.data.labDistribution.slice(0, 3).forEach(lab => {
        log(`    - ${lab._id.lab}, ${lab._id.location}: ${lab.count} orders`, 'blue');
      });
    }

    if (response.data.data.genderDistribution.length > 0) {
      log('\n  Gender Distribution:', 'yellow');
      response.data.data.genderDistribution.forEach(gender => {
        log(`    - ${gender._id}: ${gender.count} orders`, 'blue');
      });
    }

    return response.data;
  } catch (error) {
    log(`✗ Failed to fetch statistics: ${error.response?.data?.message || error.message}`, 'red');
    throw error;
  }
}

async function testCreateOrder() {
  try {
    log(`\n========== CREATE NEW ORDER ==========`, 'cyan');
    log('Creating a new test order...', 'yellow');

    const newOrder = {
      order_id: `TEST-${Date.now()}`,
      cug_code: "test-cug-code-" + Math.random().toString(36).substring(7),
      VISIT_CODE: "TEST" + Math.random().toString(36).substring(2, 10).toUpperCase(),
      patient_age: "30 Y,0 M,0 D",
      gender: "male",
      date_of_test: new Date().toISOString(),
      lab_name: "Test Lab",
      location: "Test City",
      status: "pending",
      test_types: ["Test Type 1", "Test Type 2"],
      priority: "normal",
      notes: "This is a test order created via API"
    };

    const response = await axios.post(`${API_URL}/orders`, newOrder, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    log(`✓ Order created successfully`, 'green');
    const createdOrder = response.data.data;
    log(`  Order ID: ${createdOrder.order_id}`, 'blue');
    log(`  Visit Code: ${createdOrder.VISIT_CODE}`, 'blue');
    log(`  Status: ${createdOrder.status}`, 'blue');

    return createdOrder;
  } catch (error) {
    log(`✗ Failed to create order: ${error.response?.data?.message || error.message}`, 'red');
    throw error;
  }
}

async function testUpdateOrder(orderId) {
  try {
    log(`\n========== UPDATE ORDER ==========`, 'cyan');
    log(`Updating order: ${orderId}...`, 'yellow');

    const updateData = {
      status: 'in_progress',
      notes: 'Order updated via API test',
      priority: 'urgent'
    };

    const response = await axios.put(`${API_URL}/orders/${orderId}`, updateData, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    log(`✓ Order updated successfully`, 'green');
    const updatedOrder = response.data.data;
    log(`  New Status: ${updatedOrder.status}`, 'blue');
    log(`  New Priority: ${updatedOrder.priority}`, 'blue');
    log(`  Notes: ${updatedOrder.notes}`, 'blue');

    return response.data;
  } catch (error) {
    log(`✗ Failed to update order: ${error.response?.data?.message || error.message}`, 'red');
    throw error;
  }
}

async function testDeleteOrder(orderId) {
  try {
    log(`\n========== DELETE ORDER (SOFT) ==========`, 'cyan');
    log(`Deleting order: ${orderId}...`, 'yellow');

    const response = await axios.delete(`${API_URL}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    log(`✓ Order deleted successfully (soft delete)`, 'green');
    log(`  Message: ${response.data.message}`, 'blue');

    return response.data;
  } catch (error) {
    log(`✗ Failed to delete order: ${error.response?.data?.message || error.message}`, 'red');
    throw error;
  }
}

async function runAllTests() {
  try {
    log('\n' + '='.repeat(50), 'cyan');
    log('ORDER API TEST SUITE', 'cyan');
    log('='.repeat(50), 'cyan');

    // 1. Login
    await loginAndGetToken();

    // 2. Get all orders
    await testGetAllOrders();

    // 3. Get specific order
    await testGetOrderById('333565373232');

    // 4. Search orders
    await testSearchOrders();

    // 5. Get statistics
    await testGetOrderStats();

    // 6. Create new order
    const newOrder = await testCreateOrder();

    // 7. Update the created order
    if (newOrder && newOrder.order_id) {
      await testUpdateOrder(newOrder.order_id);

      // 8. Delete the created order
      await testDeleteOrder(newOrder.order_id);
    }

    log('\n' + '='.repeat(50), 'cyan');
    log('✓ ALL TESTS COMPLETED SUCCESSFULLY', 'green');
    log('='.repeat(50), 'cyan');

  } catch (error) {
    log('\n' + '='.repeat(50), 'red');
    log('✗ TEST SUITE FAILED', 'red');
    log('='.repeat(50), 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runAllTests();