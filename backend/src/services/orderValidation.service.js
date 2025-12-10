const Order = require('../models/Order');
const Report = require('../models/Report');

class OrderValidationService {
  /**
   * Fetch order details from database by order ID
   * @param {string} orderId - The order ID to fetch
   * @returns {Promise<Object|null>} Order document or null if not found
   */
  async fetchOrderDetails(orderId) {
    try {
      console.log('[ORDER VALIDATION] Fetching order details for:', orderId);

      const order = await Order.findOne({
        order_id: orderId,
        is_deleted: false
      });

      if (!order) {
        console.log('[ORDER VALIDATION] Order not found:', orderId);
        return null;
      }

      console.log('[ORDER VALIDATION] Order found:', {
        order_id: order.order_id,
        patient_name: order.patient_name,
        patient_age: order.patient_age,
        gender: order.gender,
        date_of_test: order.date_of_test
      });

      return order;
    } catch (error) {
      console.error('[ORDER VALIDATION] Error fetching order:', error);
      throw error;
    }
  }

  /**
   * Validate patient name between order and report
   * @param {string} orderName - Name from order
   * @param {string} reportName - Name from report
   * @returns {Object} Validation result
   */
  validatePatientName(orderName, reportName) {
    console.log('[ORDER VALIDATION] Validating patient name');
    console.log('[ORDER VALIDATION]   Order name:', orderName);
    console.log('[ORDER VALIDATION]   Report name:', reportName);

    // Handle missing names
    if (!orderName && !reportName) {
      return {
        isValid: true,
        warning: 'BOTH_MISSING',
        message: 'Patient name missing in both Order and Report'
      };
    }

    if (!orderName) {
      return {
        isValid: false,
        warning: 'ORDER_MISSING',
        message: 'Patient name missing in Order',
        reportValue: reportName
      };
    }

    if (!reportName) {
      return {
        isValid: false,
        warning: 'REPORT_MISSING',
        message: 'Patient name missing in Report',
        orderValue: orderName
      };
    }

    // Normalize names for comparison
    const normalizedOrderName = this.normalizeName(orderName);
    const normalizedReportName = this.normalizeName(reportName);

    if (normalizedOrderName === normalizedReportName) {
      return {
        isValid: true,
        message: 'Patient names match'
      };
    }

    // Check for partial matches (e.g., "John Doe" vs "John")
    const partialMatch = this.checkPartialMatch(normalizedOrderName, normalizedReportName);

    return {
      isValid: false,
      warning: 'NAME_MISMATCH',
      message: `Patient name mismatch: Order has "${orderName}", Report has "${reportName}"`,
      orderValue: orderName,
      reportValue: reportName,
      partialMatch: partialMatch
    };
  }

  /**
   * Normalize name for comparison
   * @param {string} name - Name to normalize
   * @returns {string} Normalized name
   */
  normalizeName(name) {
    if (!name) return '';

    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }

  /**
   * Check for partial name match
   * @param {string} name1 - First name
   * @param {string} name2 - Second name
   * @returns {boolean} True if partial match found
   */
  checkPartialMatch(name1, name2) {
    const parts1 = name1.split(' ');
    const parts2 = name2.split(' ');

    // Check if any part of name1 is in name2 or vice versa
    for (const part of parts1) {
      if (part.length > 2 && parts2.includes(part)) {
        return true;
      }
    }

    for (const part of parts2) {
      if (part.length > 2 && parts1.includes(part)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate all demographics between order and report
   * @param {Object} order - Order document
   * @param {Object} reportData - Extracted report data
   * @returns {Object} Validation results
   */
  validateDemographics(order, reportData) {
    const validations = [];

    // Validate patient name
    const nameValidation = this.validatePatientName(
      order.patient_name,
      reportData.patientName
    );
    if (!nameValidation.isValid) {
      validations.push({
        type: 'NAME_MISMATCH',
        field: 'patientName',
        ...nameValidation
      });
    }

    // Validate gender
    if (reportData.patientGender && order.gender) {
      const genderMatch = order.gender.toLowerCase() === reportData.patientGender.toLowerCase();
      if (!genderMatch) {
        validations.push({
          type: 'GENDER_MISMATCH',
          field: 'patientGender',
          orderValue: order.gender,
          reportValue: reportData.patientGender,
          message: `Gender mismatch: Order has "${order.gender}", Report has "${reportData.patientGender}"`
        });
      }
    }

    return {
      hasWarnings: validations.length > 0,
      warnings: validations,
      summary: validations.length === 0
        ? 'All demographics match'
        : `Found ${validations.length} mismatch(es)`
    };
  }

  /**
   * Compare ages allowing for minor variations
   * @param {string} age1 - First age
   * @param {string} age2 - Second age
   * @returns {boolean} True if ages are similar
   */
  compareAge(age1, age2) {
    // Extract years from age strings (e.g., "35 Y,2 M,5 D" -> 35)
    const extractYears = (age) => {
      const match = age.match(/(\d+)\s*Y/i);
      return match ? parseInt(match[1]) : null;
    };

    const years1 = extractYears(age1);
    const years2 = extractYears(age2);

    if (years1 === null || years2 === null) {
      // If can't extract years, do string comparison
      return age1 === age2;
    }

    // Allow 1 year difference (due to potential calculation differences)
    return Math.abs(years1 - years2) <= 1;
  }

  /**
   * Compare dates allowing for timezone differences
   * @param {Date|string} date1 - First date
   * @param {Date|string} date2 - Second date
   * @returns {boolean} True if dates are the same day
   */
  compareDates(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);

    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  /**
   * Populate meta fields from order data
   * @param {Object} order - Order document
   * @returns {Object} Meta data for final JSON
   */
  populateMetaFromOrder(order) {
    return {
      USER_CODE: order.order_id,
      cug_code: order.cug_code || '',
      VISIT_CODE: order.VISIT_CODE || '',
      patient_age: order.patient_age || '',
      gender: order.gender || '',
      date_of_test: order.date_of_test ?
        new Date(order.date_of_test).toISOString().split('T')[0] : '',
      lab_name: order.lab_name || '',
      location: order.location || ''
    };
  }

  /**
   * Create audit entry for mismatch acknowledgment
   * @param {Object} details - Mismatch details
   * @returns {Object} Audit entry
   */
  createMismatchAuditEntry(details) {
    return {
      action: 'APPROVAL_WITH_MISMATCH',
      timestamp: new Date(),
      reportId: details.reportId,
      orderId: details.orderId,
      mismatches: details.mismatches,
      acknowledgedBy: details.userId,
      overrideReason: details.reason,
      metadata: {
        userAgent: details.userAgent,
        ipAddress: details.ipAddress
      }
    };
  }

  /**
   * Check if patient name exists in order
   * @param {Object} order - Order document
   * @returns {Object} Check result
   */
  checkPatientNameRequired(order) {
    if (!order) {
      return {
        required: true,
        message: 'Order not found. Cannot validate without order data.'
      };
    }

    if (!order.patient_name) {
      return {
        required: true,
        message: 'Patient name is missing in the Order. Please update the Order with patient name before approval.',
        orderMissing: true
      };
    }

    return {
      required: false,
      hasName: true
    };
  }
}

module.exports = new OrderValidationService();