const mongoose = require('mongoose');
const Report = require('../models/Report');
const thresholdChecker = require('../services/thresholdChecker.service');
const LabConfig = require('../models/LabConfig');
const Order = require('../models/Order');
const AuditLog = require('../models/AuditLog');
const orderValidationService = require('../services/orderValidation.service');

// Helper function to calculate audit summary
const calculateAuditSummary = (report) => {
  const totalParameters = report.extractedData?.results?.length || 0;

  // Count unique parameters that were edited
  const editedParameterNames = new Set();
  (report.editHistory || []).forEach(edit => {
    // Extract parameter name from field (format: "ParameterName.field")
    const paramName = edit.field.split('.')[0];
    editedParameterNames.add(paramName);
  });

  const editedParameters = editedParameterNames.size;
  const accuracyPercentage = totalParameters > 0
    ? ((totalParameters - editedParameters) / totalParameters) * 100
    : 100;

  // Calculate review duration (from uploadDate to now)
  const reviewDuration = report.uploadDate
    ? Math.floor((Date.now() - new Date(report.uploadDate).getTime()) / 1000)
    : null;

  return {
    totalParameters,
    editedParameters,
    accuracyPercentage: Math.round(accuracyPercentage * 100) / 100, // Round to 2 decimals
    calculatedAt: new Date(),
    reviewDuration
  };
};

// Get report for review with all details
const getReportForReview = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[REVIEW CONTROLLER] Fetching report for review:', id);

    const report = await Report.findById(id)
      .populate('uploadedBy', 'name email')
      .populate('editHistory.editedBy', 'name email');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check if report is ready for review
    if (report.status !== 'ready' && report.status !== 'approved' && report.status !== 'rejected') {
      return res.status(400).json({
        success: false,
        message: `Report is not ready for review. Current status: ${report.status}`,
        currentStatus: report.status
      });
    }

    console.log('[REVIEW CONTROLLER] Report fetched successfully');

    res.json({
      success: true,
      message: 'Report fetched for review',
      data: {
        reportId: report._id,
        orderId: report.orderId,
        status: report.status,
        pdfPath: report.pdfPath,
        uploadedBy: report.uploadedBy,
        extractedData: report.extractedData,
        flags: report.flags,
        uiIndicators: report.uiIndicators,
        editHistory: report.editHistory,
        approvedBy: report.approvedBy,
        approvedAt: report.approvedAt,
        rejectionReason: report.rejectionReason,
        auditSummary: report.auditSummary
      }
    });

  } catch (error) {
    console.error('[REVIEW CONTROLLER] Get report for review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch report for review',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Edit a specific parameter value
const editParameter = async (req, res) => {
  console.log('========== BACKEND EDIT PARAMETER DEBUG START ==========');
  try {
    const { id } = req.params;
    const { parameterName, field, newValue, reason } = req.body;

    console.log('[EDIT PARAM] Request params:', {
      reportId: id,
      parameterName,
      field,
      newValue,
      newValueType: typeof newValue,
      reason
    });
    console.log('[EDIT PARAM] Full request body:', JSON.stringify(req.body, null, 2));
    console.log('[EDIT PARAM] User:', req.user ? { id: req.user.id, name: req.user.name, email: req.user.email } : 'No user');

    // Validate input
    if (!parameterName || !field || newValue === undefined) {
      console.log('[EDIT PARAM] ✗ Validation failed:', {
        hasParameterName: !!parameterName,
        hasField: !!field,
        hasNewValue: newValue !== undefined
      });
      return res.status(400).json({
        success: false,
        message: 'Parameter name, field, and new value are required'
      });
    }

    console.log('[EDIT PARAM] ✓ Input validation passed');
    console.log('[EDIT PARAM] Fetching report from database...');

    const report = await Report.findById(id);

    if (!report) {
      console.log('[EDIT PARAM] ✗ Report not found with ID:', id);
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    console.log('[EDIT PARAM] ✓ Report found:', {
      reportId: report._id,
      orderId: report.orderId,
      status: report.status,
      hasExtractedData: !!report.extractedData,
      resultsCount: report.extractedData?.results?.length || 0
    });

    // Check if report can be edited (allow 'ready' and 'approved' for repeat reviews)
    if (report.status !== 'ready' && report.status !== 'approved') {
      console.log('[EDIT PARAM] ✗ Report status does not allow editing:', report.status);
      return res.status(400).json({
        success: false,
        message: `Report cannot be edited in ${report.status} status`
      });
    }

    console.log('[EDIT PARAM] ✓ Report status allows editing:', report.status);

    // Log all available parameters in the report
    console.log('[EDIT PARAM] Available parameters in report:');
    if (report.extractedData?.results) {
      report.extractedData.results.forEach((param, index) => {
        console.log(`  [${index}] ${param.serviceItemName} (ID: ${param._id})`);
      });
    } else {
      console.log('  No results in extractedData');
    }

    // Find the parameter in extracted data
    console.log('[EDIT PARAM] Searching for parameter with serviceItemName:', parameterName);
    const paramIndex = report.extractedData.results.findIndex(
      result => result.serviceItemName === parameterName
    );

    if (paramIndex === -1) {
      console.log('[EDIT PARAM] ✗ Parameter not found in extractedData.results');
      console.log('[EDIT PARAM] Searched for:', parameterName);
      console.log('[EDIT PARAM] Available names:', report.extractedData.results.map(r => r.serviceItemName));
      return res.status(404).json({
        success: false,
        message: 'Parameter not found in report'
      });
    }

    console.log('[EDIT PARAM] ✓ Parameter found at index:', paramIndex);
    const parameter = report.extractedData.results[paramIndex];
    console.log('[EDIT PARAM] Current parameter data:', JSON.stringify(parameter, null, 2));

    // Store original value for audit trail
    const originalValue = report.extractedData.results[paramIndex][field];
    console.log('[EDIT PARAM] Original value:', originalValue, '(type:', typeof originalValue, ')');
    console.log('[EDIT PARAM] New value:', newValue, '(type:', typeof newValue, ')');

    // Create edit history entry
    const editEntry = {
      field: `${parameterName}.${field}`,
      originalValue,
      newValue,
      editedBy: req.user.userId,
      editedAt: new Date(),
      reason: reason || 'Manual correction by nurse'
    };
    console.log('[EDIT PARAM] Edit history entry:', JSON.stringify(editEntry, null, 2));

    // Update the value
    console.log('[EDIT PARAM] Updating extractedData.results[' + paramIndex + '][' + field + ']...');
    report.extractedData.results[paramIndex][field] = newValue;
    console.log('[EDIT PARAM] ✓ Updated in extractedData');

    // Also update in finalData if it exists
    if (report.finalData && report.finalData.results) {
      console.log('[EDIT PARAM] Final data exists, searching for parameter...');
      const finalParamIndex = report.finalData.results.findIndex(
        result => result.serviceItemName === parameterName
      );
      if (finalParamIndex !== -1) {
        console.log('[EDIT PARAM] Found in finalData at index:', finalParamIndex);
        report.finalData.results[finalParamIndex][field] = newValue;
        console.log('[EDIT PARAM] ✓ Updated in finalData');
      } else {
        console.log('[EDIT PARAM] Parameter not found in finalData');
      }
    } else {
      console.log('[EDIT PARAM] No finalData in report');
    }

    // CRITICAL: Also update in pageWiseData if it exists
    if (report.extractedData.pageWiseData && Array.isArray(report.extractedData.pageWiseData)) {
      console.log('[EDIT PARAM] PageWiseData exists, updating across all pages...');
      console.log('[EDIT PARAM] Total pages:', report.extractedData.pageWiseData.length);

      let pageWiseUpdated = 0;
      report.extractedData.pageWiseData.forEach((page, pageIndex) => {
        if (page.results && Array.isArray(page.results)) {
          const pageParamIndex = page.results.findIndex(
            result => result.serviceItemName === parameterName
          );
          if (pageParamIndex !== -1) {
            console.log(`[EDIT PARAM] Found parameter on page ${pageIndex + 1} at index ${pageParamIndex}`);
            page.results[pageParamIndex][field] = newValue;
            pageWiseUpdated++;
            console.log(`[EDIT PARAM] ✓ Updated on page ${pageIndex + 1}`);
          }
        }
      });

      if (pageWiseUpdated > 0) {
        console.log(`[EDIT PARAM] ✓ Updated in ${pageWiseUpdated} page(s) in pageWiseData`);
      } else {
        console.log('[EDIT PARAM] Parameter not found in any page of pageWiseData');
      }
    } else {
      console.log('[EDIT PARAM] No pageWiseData in report');
    }

    // Add to edit history
    report.editHistory.push(editEntry);
    console.log('[EDIT PARAM] ✓ Added to edit history (total entries:', report.editHistory.length, ')');

    // Recalculate flags if value was edited
    if (field === 'value') {
      console.log('[EDIT PARAM] Value field changed, recalculating flags...');
      const config = await LabConfig.getConfig();
      const newFlags = await thresholdChecker.calculateFlags(report.extractedData.results, config);
      const newIndicators = thresholdChecker.generateUIIndicators(newFlags);

      report.flags = newFlags;
      report.uiIndicators = newIndicators;
      console.log('[EDIT PARAM] ✓ Flags recalculated');
    } else {
      console.log('[EDIT PARAM] Field is not "value", skipping flag recalculation');
    }

    console.log('[EDIT PARAM] Saving report to database...');
    const saveResult = await report.save();
    console.log('[EDIT PARAM] ✓ Report saved successfully');
    console.log('[EDIT PARAM] Save result ID:', saveResult._id);

    console.log('[EDIT PARAM] Parameter edited successfully');

    const responseData = {
      success: true,
      message: 'Parameter updated successfully',
      data: {
        parameterName,
        field,
        originalValue,
        newValue,
        editedBy: req.user.name,
        flags: report.flags,
        uiIndicators: report.uiIndicators
      }
    };

    console.log('[EDIT PARAM] Sending success response:', JSON.stringify(responseData, null, 2));
    res.json(responseData);

    console.log('========== BACKEND EDIT PARAMETER DEBUG END (SUCCESS) ==========');

  } catch (error) {
    console.error('========== BACKEND EDIT PARAMETER ERROR ==========');
    console.error('[EDIT PARAM] ✗ Error type:', error.constructor.name);
    console.error('[EDIT PARAM] ✗ Error message:', error.message);
    console.error('[EDIT PARAM] ✗ Error stack:', error.stack);
    console.error('[EDIT PARAM] ✗ Full error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to edit parameter',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });

    console.error('========== BACKEND EDIT PARAMETER DEBUG END (ERROR) ==========');
  }
};

// Bulk edit multiple parameters
const bulkEditParameters = async (req, res) => {
  try {
    const { id } = req.params;
    const { edits } = req.body;

    console.log('[REVIEW CONTROLLER] Bulk editing parameters:', {
      reportId: id,
      editCount: edits?.length
    });

    if (!Array.isArray(edits) || edits.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Edits array is required'
      });
    }

    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check if report can be edited (allow 'ready' and 'approved' for repeat reviews)
    if (report.status !== 'ready' && report.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: `Report cannot be edited in ${report.status} status`
      });
    }

    const editHistory = [];
    let valueChanged = false;

    // Process each edit
    for (const edit of edits) {
      const { parameterName, field, newValue, reason } = edit;

      if (!parameterName || !field || newValue === undefined) {
        continue; // Skip invalid edits
      }

      const paramIndex = report.extractedData.results.findIndex(
        result => result.serviceItemName === parameterName
      );

      if (paramIndex === -1) continue;

      const originalValue = report.extractedData.results[paramIndex][field];

      // Only create history if value actually changed
      if (originalValue !== newValue) {
        // Update the value
        report.extractedData.results[paramIndex][field] = newValue;

        // Update in finalData
        if (report.finalData && report.finalData.results) {
          const finalParamIndex = report.finalData.results.findIndex(
            result => result.serviceItemName === parameterName
          );
          if (finalParamIndex !== -1) {
            report.finalData.results[finalParamIndex][field] = newValue;
          }
        }

        // Add to edit history
        editHistory.push({
          field: `${parameterName}.${field}`,
          originalValue,
          newValue,
          editedBy: req.user.userId,
          editedAt: new Date(),
          reason: reason || 'Bulk edit by nurse'
        });

        if (field === 'value') {
          valueChanged = true;
        }
      }
    }

    // Add all edits to history
    report.editHistory.push(...editHistory);

    // Recalculate flags if any values were edited
    if (valueChanged) {
      const config = await LabConfig.getConfig();
      const newFlags = await thresholdChecker.calculateFlags(report.extractedData.results, config);
      const newIndicators = thresholdChecker.generateUIIndicators(newFlags);

      report.flags = newFlags;
      report.uiIndicators = newIndicators;
    }

    await report.save();

    console.log('[REVIEW CONTROLLER] Bulk edit completed:', editHistory.length, 'changes');

    res.json({
      success: true,
      message: `${editHistory.length} parameters updated successfully`,
      data: {
        editsApplied: editHistory.length,
        flags: report.flags,
        uiIndicators: report.uiIndicators
      }
    });

  } catch (error) {
    console.error('[REVIEW CONTROLLER] Bulk edit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform bulk edit',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update Order ID for a report
const updateOrderId = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderId } = req.body;

    console.log('[REVIEW CONTROLLER] Updating Order ID for report:', id);
    console.log('[REVIEW CONTROLLER] New Order ID:', orderId);

    // Validate input
    if (!orderId || !orderId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check if orderId already exists (excluding current report)
    const existingReport = await Report.findOne({
      orderId: orderId.trim(),
      _id: { $ne: id }
    });

    if (existingReport) {
      return res.status(400).json({
        success: false,
        message: 'This Order ID is already assigned to another report'
      });
    }

    // Update order ID
    report.orderId = orderId.trim();
    await report.save();

    console.log('[REVIEW CONTROLLER] Order ID updated successfully');

    res.json({
      success: true,
      message: 'Order ID updated successfully',
      data: {
        reportId: report._id,
        orderId: report.orderId
      }
    });

  } catch (error) {
    console.error('[REVIEW CONTROLLER] Update Order ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update Order ID',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Approve report
const approveReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments, confirmMismatch, mismatchReason } = req.body;

    console.log('[REVIEW CONTROLLER] Approving report:', id);

    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check if report can be approved (allow both 'ready' and 'approved' for re-approval)
    if (report.status !== 'ready' && report.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: `Report cannot be approved. Current status: ${report.status}`,
        currentStatus: report.status
      });
    }

    // Check if Order ID is provided
    if (!report.orderId || !report.orderId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required before approval. Please add an Order ID first.',
        requiresOrderId: true
      });
    }

    // Fetch and validate order
    console.log('[REVIEW CONTROLLER] Fetching order for validation:', report.orderId);
    const order = await orderValidationService.fetchOrderDetails(report.orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found with ID: ${report.orderId}. Please verify the Order ID.`,
        requiresValidOrder: true
      });
    }

    // Check if patient name exists in order
    const nameCheck = orderValidationService.checkPatientNameRequired(order);
    if (nameCheck.required) {
      return res.status(400).json({
        success: false,
        message: nameCheck.message,
        requiresPatientName: true,
        orderMissing: nameCheck.orderMissing
      });
    }

    // Validate demographics between order and report
    const validationResult = orderValidationService.validateDemographics(order, report.extractedData);

    // If there are warnings and user hasn't confirmed
    if (validationResult.hasWarnings && !confirmMismatch) {
      console.log('[REVIEW CONTROLLER] Validation warnings found, requiring confirmation');

      return res.status(400).json({
        success: false,
        message: 'Data mismatches found between Order and Report. Please review and confirm.',
        requiresConfirmation: true,
        validationWarnings: validationResult.warnings,
        orderData: {
          patient_name: order.patient_name,
          patient_age: order.patient_age,
          gender: order.gender,
          date_of_test: order.date_of_test
        },
        reportData: {
          patientName: report.extractedData?.patientName,
          patientAge: report.extractedData?.patientAge,
          patientGender: report.extractedData?.patientGender,
          dateOfTest: report.extractedData?.dateOfTest
        }
      });
    }

    // If user confirmed mismatches, record them
    if (validationResult.hasWarnings && confirmMismatch) {
      console.log('[REVIEW CONTROLLER] User confirmed approval despite mismatches');
      console.log('[REVIEW CONTROLLER] DEBUG - req.user:', JSON.stringify(req.user, null, 2));
      console.log('[REVIEW CONTROLLER] DEBUG - req.user.id:', req.user.id);
      console.log('[REVIEW CONTROLLER] DEBUG - req.user._id:', req.user._id);
      console.log('[REVIEW CONTROLLER] DEBUG - validationResult.warnings:', JSON.stringify(validationResult.warnings, null, 2));

      // Save validation warnings to report
      report.validationWarnings = validationResult.warnings.map(warning => ({
        type: warning.type,
        field: warning.field,
        orderValue: warning.orderValue,
        reportValue: warning.reportValue,
        acknowledgedBy: req.user.userId,
        acknowledgedAt: new Date(),
        overrideReason: mismatchReason || 'User confirmed despite mismatch'
      }));

      console.log('[REVIEW CONTROLLER] DEBUG - Creating audit entry with userId:', req.user.userId);

      const mismatchesToSave = validationResult.warnings.map(w => ({
        field: w.field,
        expectedValue: String(w.orderValue || ''),
        actualValue: String(w.reportValue || ''),
        type: w.type
      }));

      console.log('[REVIEW CONTROLLER] ========== EXTENSIVE DEBUG LOGGING ==========');
      console.log('[REVIEW CONTROLLER] DEBUG - validationResult.warnings (raw):');
      console.log(JSON.stringify(validationResult.warnings, null, 2));

      console.log('[REVIEW CONTROLLER] DEBUG - Mismatches to save (before transformation):');
      console.log('Array.isArray(validationResult.warnings):', Array.isArray(validationResult.warnings));
      console.log('validationResult.warnings.length:', validationResult.warnings.length);

      console.log('[REVIEW CONTROLLER] DEBUG - Mismatches to save (after transformation):');
      console.log('Array.isArray(mismatchesToSave):', Array.isArray(mismatchesToSave));
      console.log('mismatchesToSave.length:', mismatchesToSave.length);
      console.log('typeof mismatchesToSave:', typeof mismatchesToSave);

      mismatchesToSave.forEach((m, i) => {
        console.log(`[REVIEW CONTROLLER] DEBUG - Mismatch [${i}]:`, {
          field: m.field,
          fieldType: typeof m.field,
          expectedValue: m.expectedValue,
          expectedValueType: typeof m.expectedValue,
          actualValue: m.actualValue,
          actualValueType: typeof m.actualValue,
          type: m.type,
          typeType: typeof m.type
        });
      });

      console.log('[REVIEW CONTROLLER] DEBUG - Creating ObjectId from userId:', req.user.userId);
      const userObjectId = new mongoose.Types.ObjectId(req.user.userId);
      console.log('[REVIEW CONTROLLER] DEBUG - UserObjectId created:', userObjectId);
      console.log('[REVIEW CONTROLLER] DEBUG - UserObjectId type:', typeof userObjectId);
      console.log('[REVIEW CONTROLLER] DEBUG - UserObjectId instanceof ObjectId:', userObjectId instanceof mongoose.Types.ObjectId);

      // Create audit log entry
      const auditEntryData = {
        action: 'APPROVAL_WITH_MISMATCH',
        reportId: report._id,
        orderId: report.orderId,
        userId: userObjectId,
        mismatchType: validationResult.warnings.length === 1
          ? validationResult.warnings[0].type.replace('_MISMATCH', '')
          : 'MULTIPLE',
        mismatches: mismatchesToSave,
        overrideReason: mismatchReason,
        wasOverridden: true,
        metadata: {
          userAgent: req.get('user-agent'),
          ipAddress: req.ip
        }
      };

      console.log('[REVIEW CONTROLLER] DEBUG - Audit entry DATA before creating model:');
      console.log('action:', auditEntryData.action);
      console.log('reportId:', auditEntryData.reportId);
      console.log('orderId:', auditEntryData.orderId);
      console.log('userId:', auditEntryData.userId);
      console.log('mismatchType:', auditEntryData.mismatchType);
      console.log('mismatches (type):', typeof auditEntryData.mismatches);
      console.log('mismatches (isArray):', Array.isArray(auditEntryData.mismatches));
      console.log('mismatches (length):', auditEntryData.mismatches.length);
      console.log('mismatches[0]:', auditEntryData.mismatches[0]);
      console.log('overrideReason:', auditEntryData.overrideReason);
      console.log('wasOverridden:', auditEntryData.wasOverridden);

      const auditEntry = new AuditLog(auditEntryData);

      console.log('[REVIEW CONTROLLER] DEBUG - Audit entry MODEL created');
      console.log('[REVIEW CONTROLLER] DEBUG - auditEntry.mismatches type:', typeof auditEntry.mismatches);
      console.log('[REVIEW CONTROLLER] DEBUG - auditEntry.mismatches isArray:', Array.isArray(auditEntry.mismatches));
      console.log('[REVIEW CONTROLLER] DEBUG - auditEntry.mismatches length:', auditEntry.mismatches ? auditEntry.mismatches.length : 'undefined');
      console.log('[REVIEW CONTROLLER] DEBUG - auditEntry.userId:', auditEntry.userId);

      console.log('[REVIEW CONTROLLER] DEBUG - Attempting to save audit entry...');

      try {
        await auditEntry.save();
        console.log('[REVIEW CONTROLLER] ✓✓✓ Audit log saved successfully! ✓✓✓');
      } catch (saveError) {
        console.error('[REVIEW CONTROLLER] ✗✗✗ AUDIT LOG SAVE FAILED ✗✗✗');
        console.error('[REVIEW CONTROLLER] Error name:', saveError.name);
        console.error('[REVIEW CONTROLLER] Error message:', saveError.message);
        console.error('[REVIEW CONTROLLER] Error stack:', saveError.stack);
        if (saveError.errors) {
          console.error('[REVIEW CONTROLLER] Validation errors:', JSON.stringify(saveError.errors, null, 2));
          Object.keys(saveError.errors).forEach(key => {
            const err = saveError.errors[key];
            console.error(`[REVIEW CONTROLLER] Error on field "${key}":`);
            console.error('  - kind:', err.kind);
            console.error('  - path:', err.path);
            console.error('  - value:', err.value);
            console.error('  - valueType:', typeof err.value);
            console.error('  - message:', err.message);
          });
        }
        console.error('[REVIEW CONTROLLER] ⚠️  Continuing without audit log - approval will still proceed');
        // Don't throw - let approval continue even if audit log fails
      }

      console.log('[REVIEW CONTROLLER] ========== END EXTENSIVE DEBUG LOGGING ==========');
    }

    // Generate finalData using Order data (validated against Report data)
    const metaData = orderValidationService.populateMetaFromOrder(order);

    // Override with report data if available and no mismatches
    if (!validationResult.hasWarnings || confirmMismatch) {
      // Use report's lab name if available
      if (report.extractedData?.labName) {
        metaData.lab_name = report.extractedData.labName;
      }
    }

    const finalData = {
      meta: metaData,
      results: (report.extractedData?.results || []).map(result => ({
        type: 'path',
        serviceItemName: result.serviceItemName || '',
        value: result.value || '',
        method: result.method || '',
        unit: result.unit || '',
        referenceRange: {
          high: result.referenceRange?.high || null,
          low: result.referenceRange?.low || null,
          referenceRange: result.referenceRange?.referenceRange || ''
        }
      }))
    };

    // Save finalData to report
    report.finalData = finalData;

    // Calculate and save audit summary
    report.auditSummary = calculateAuditSummary(report);

    // Update report status
    report.status = 'approved';
    report.approvedBy = req.user.userId;
    report.approvedAt = new Date();
    report.approvalComments = comments || '';
    report.rejectionReason = null;

    await report.save();

    // Save JSON file to disk
    const fs = require('fs');
    const path = require('path');
    const outputDir = path.join(__dirname, '../../uploads/output');

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const jsonFilePath = path.join(outputDir, `${report.orderId}.json`);
    fs.writeFileSync(jsonFilePath, JSON.stringify(finalData, null, 2));

    console.log('[REVIEW CONTROLLER] Report approved successfully, JSON saved to:', jsonFilePath);

    res.json({
      success: true,
      message: 'Report approved successfully',
      data: {
        reportId: report._id,
        orderId: report.orderId,
        status: report.status,
        approvedBy: req.user.name,
        approvedAt: report.approvedAt,
        finalData: finalData,
        jsonFilePath: jsonFilePath
      }
    });

  } catch (error) {
    console.error('[REVIEW CONTROLLER] Approve report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Reject report
const rejectReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    console.log('[REVIEW CONTROLLER] Rejecting report:', id);

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check if report can be rejected
    if (report.status !== 'ready' && report.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: `Report cannot be rejected. Current status: ${report.status}`,
        currentStatus: report.status
      });
    }

    // Check if Order ID is provided
    if (!report.orderId || !report.orderId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required before rejection. Please add an Order ID first.',
        requiresOrderId: true
      });
    }

    // Calculate and save audit summary
    report.auditSummary = calculateAuditSummary(report);

    // Update report status
    report.status = 'rejected';
    report.rejectionReason = reason;
    report.rejectedBy = req.user.id;
    report.rejectedAt = new Date();

    await report.save();

    console.log('[REVIEW CONTROLLER] Report rejected successfully');

    res.json({
      success: true,
      message: 'Report rejected',
      data: {
        reportId: report._id,
        orderId: report.orderId,
        status: report.status,
        rejectionReason: reason,
        rejectedBy: req.user.name
      }
    });

  } catch (error) {
    console.error('[REVIEW CONTROLLER] Reject report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get edit history
const getEditHistory = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[REVIEW CONTROLLER] Fetching edit history for:', id);

    const report = await Report.findById(id)
      .populate('editHistory.editedBy', 'name email')
      .select('orderId editHistory');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    console.log('[REVIEW CONTROLLER] Edit history fetched:', report.editHistory.length, 'entries');

    res.json({
      success: true,
      message: 'Edit history fetched successfully',
      data: {
        reportId: report._id,
        orderId: report.orderId,
        editHistory: report.editHistory
      }
    });

  } catch (error) {
    console.error('[REVIEW CONTROLLER] Get edit history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch edit history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get validation data for approval dialog
const getValidationData = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[REVIEW CONTROLLER] Fetching validation data for report:', id);

    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check if Order ID is provided
    if (!report.orderId || !report.orderId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required. Please add an Order ID first.',
        requiresOrderId: true
      });
    }

    // Import validation service
    const orderValidationService = require('../services/orderValidation.service');

    // Fetch and validate order
    console.log('[REVIEW CONTROLLER] Fetching order for validation:', report.orderId);
    const order = await orderValidationService.fetchOrderDetails(report.orderId);

    if (!order) {
      // Return as a warning in the dialog instead of blocking with 404
      console.log('[REVIEW CONTROLLER] Order not found, returning as critical warning');
      return res.status(200).json({
        success: true,
        hasWarnings: true,
        validationWarnings: [{
          type: 'ORDER_NOT_FOUND',
          field: 'orderId',
          message: `Order ID "${report.orderId}" not found in database. Please verify the Order ID.`,
          severity: 'critical',
          allowOverride: false
        }],
        orderData: null,
        reportData: {
          patientName: report.extractedData?.patientName,
          patientAge: report.extractedData?.patientAge,
          patientGender: report.extractedData?.patientGender,
          dateOfTest: report.extractedData?.dateOfTest
        }
      });
    }

    // Check if patient name exists in order
    const nameCheck = orderValidationService.checkPatientNameRequired(order);
    if (nameCheck.required) {
      return res.status(400).json({
        success: false,
        message: nameCheck.message,
        requiresPatientName: true,
        orderMissing: nameCheck.orderMissing
      });
    }

    // Validate demographics between order and report
    const validationResult = orderValidationService.validateDemographics(order, report.extractedData);

    // Return validation data
    return res.status(200).json({
      success: true,
      hasWarnings: validationResult.hasWarnings,
      validationWarnings: validationResult.warnings,
      orderData: {
        patient_name: order.patient_name,
        patient_age: order.patient_age,
        gender: order.gender,
        date_of_test: order.date_of_test
      },
      reportData: {
        patientName: report.extractedData?.patientName,
        patientAge: report.extractedData?.patientAge,
        patientGender: report.extractedData?.patientGender,
        dateOfTest: report.extractedData?.dateOfTest
      },
      summary: validationResult.summary
    });
  } catch (error) {
    console.error('[REVIEW CONTROLLER] Get validation data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch validation data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getReportForReview,
  editParameter,
  bulkEditParameters,
  updateOrderId,
  approveReport,
  rejectReport,
  getEditHistory,
  getValidationData
};