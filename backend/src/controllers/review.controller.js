const mongoose = require('mongoose');
const crypto = require('crypto');
const Report = require('../models/Report');
const thresholdChecker = require('../services/thresholdChecker.service');
const LabConfig = require('../models/LabConfig');
// const Order = require('../models/Order');  // No longer needed - using observation collection
const AuditLog = require('../models/AuditLog');
const externalDb = require('../services/externalDb.service');
// const orderValidationService = require('../services/orderValidation.service');  // No longer needed - using observationData from Report

// Helper function to calculate audit summary
const calculateAuditSummary = (report, frontendReviewDuration = null) => {
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

  // Use frontend-provided review duration if available, otherwise calculate from uploadDate
  const reviewDuration = frontendReviewDuration !== null
    ? frontendReviewDuration
    : (report.uploadDate
        ? Math.floor((Date.now() - new Date(report.uploadDate).getTime()) / 1000)
        : null);

  // Calculate seconds per parameter
  const secondsPerParameter = (reviewDuration !== null && totalParameters > 0)
    ? Math.round((reviewDuration / totalParameters) * 100) / 100 // Round to 2 decimals
    : null;

  return {
    totalParameters,
    editedParameters,
    accuracyPercentage: Math.round(accuracyPercentage * 100) / 100, // Round to 2 decimals
    calculatedAt: new Date(),
    reviewDuration,
    secondsPerParameter
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

// Edit patient demographics (name, gender, date of test)
const editDemographics = async (req, res) => {
  try {
    const { id } = req.params;
    const { patientName, patientGender, dateOfTest, reason } = req.body;

    console.log('[REVIEW CONTROLLER] Editing demographics for report:', id);
    console.log('[REVIEW CONTROLLER] New demographics:', { patientName, patientGender, dateOfTest });

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

    const changes = [];

    // Track changes for patientName
    if (patientName !== undefined && patientName !== report.extractedData.patientName) {
      changes.push({
        field: 'patientName',
        originalValue: report.extractedData.patientName,
        newValue: patientName,
        editedBy: req.user.userId,
        editedAt: new Date(),
        reason: reason || 'Manual correction of patient name'
      });
      report.extractedData.patientName = patientName;
    }

    // Track changes for patientGender
    if (patientGender !== undefined && patientGender !== report.extractedData.patientGender) {
      changes.push({
        field: 'patientGender',
        originalValue: report.extractedData.patientGender,
        newValue: patientGender,
        editedBy: req.user.userId,
        editedAt: new Date(),
        reason: reason || 'Manual correction of patient gender'
      });
      report.extractedData.patientGender = patientGender;
    }

    // Track changes for dateOfTest
    if (dateOfTest !== undefined && dateOfTest !== report.extractedData.dateOfTest) {
      changes.push({
        field: 'dateOfTest',
        originalValue: report.extractedData.dateOfTest,
        newValue: dateOfTest,
        editedBy: req.user.userId,
        editedAt: new Date(),
        reason: reason || 'Manual correction of date of test'
      });
      report.extractedData.dateOfTest = dateOfTest;
    }

    // If no changes were made, return early
    if (changes.length === 0) {
      return res.json({
        success: true,
        message: 'No changes detected',
        data: {
          reportId: report._id,
          demographics: {
            patientName: report.extractedData.patientName,
            patientGender: report.extractedData.patientGender,
            dateOfTest: report.extractedData.dateOfTest
          }
        }
      });
    }

    // Add all changes to edit history
    report.editHistory.push(...changes);

    // Save the report
    await report.save();

    console.log('[REVIEW CONTROLLER] Demographics updated successfully:', changes.length, 'changes');

    res.json({
      success: true,
      message: 'Demographics updated successfully',
      data: {
        reportId: report._id,
        changesApplied: changes.length,
        demographics: {
          patientName: report.extractedData.patientName,
          patientGender: report.extractedData.patientGender,
          dateOfTest: report.extractedData.dateOfTest
        },
        editHistory: changes
      }
    });

  } catch (error) {
    console.error('[REVIEW CONTROLLER] Edit demographics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update demographics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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

    const trimmedOrderId = orderId.trim();
    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Step 1: Check if orderId already exists in another report
    const existingReport = await Report.findOne({
      orderId: trimmedOrderId,
      _id: { $ne: id }
    });

    if (existingReport) {
      return res.status(400).json({
        success: false,
        message: 'This Order ID is already assigned to another report'
      });
    }

    // Step 2: Query external MongoDB (dev_kxhims.observation) to validate OrderID exists
    console.log('[REVIEW CONTROLLER] Querying external observation collection for orderId:', trimmedOrderId);
    const obs = await externalDb.getObservationByOrderId(trimmedOrderId);

    if (!obs) {
      console.log('[REVIEW CONTROLLER] No Observation found for orderId:', trimmedOrderId);
      return res.status(404).json({
        success: false,
        message: 'No Observation found for this orderId'
      });
    }

    console.log('[REVIEW CONTROLLER] Observation found for orderId:', trimmedOrderId);

    // Step 3: Extract obsPart from observation record
    const obsPart = {
      account_time_zone: obs.account_time_zone || '',
      uhId: obs.uhId || '',
      patientId: obs.patientId || '',
      facility_id: obs.facility_id || '',
      account_id: obs.account_id || '',
      serviceType_code: obs.serviceType_code || '',
      orderId: obs.orderId || '',
      accessionIdentifier: obs.accessionIdentifier || '',
      category: obs.category || '',
      episode_id: obs.episode_id || '',
      patient_age: obs.patient_age || '',
      patient_dob: obs.patient_dob || '',
      patient_gender: obs.patient_gender || '',
      isOutsourced: obs.isOutsourced || '',
      patientType: obs.patientType || '',
      patient_name: obs.patient_name || '',
      referBy: obs.referBy || '',
      payer_id: obs.payer_id || '',
      payer_name: obs.payer_name || '',
      payer_type: obs.payer_type || '',
      orderDateTime: obs.orderDateTime || '',
      telecom: obs.telecom || '',
      center_type_name: obs.center_type_name || '',
      package_id: obs.package_id || '',
      part_of_package: obs.part_of_package || '',
      package_name: obs.package_name || '',
      email: obs.email || '',
      center_name: obs.center_name || '',
      orderBy: obs.orderBy || '',
      care_type: obs.care_type || '',
      care_type_name: obs.care_type_name || '',
      status: obs.status || '',
      acknowledgedDateTime: obs.acknowledgedDateTime || '',
      outSourceCentre: obs.outSourceCentre || '',
      orderReferenceId: obs.orderReferenceId || '',
      reportStatus: obs.reportStatus || '',
      uploadedDocumentId: obs.uploadedDocumentId || '',
      verificationDateTime: obs.verificationDateTime || '',
      outSourceCentre_id: obs.outSourceCentre_id || '',
      admittingDoctor: obs.admittingDoctor || '',
      cug_code: obs.cug_code || '',
      package_service_code: obs.outsource_service_code || '',
      fetchedAt: new Date()
    };

    // Step 4: Update report with orderId and observationData
    report.orderId = trimmedOrderId;
    report.observationData = obsPart;
    await report.save();

    console.log('[REVIEW CONTROLLER] Order ID and Observation data saved successfully');

    res.json({
      success: true,
      message: 'Order ID validated and saved successfully',
      data: {
        reportId: report._id,
        orderId: report.orderId,
        observationData: obsPart
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
    const { comments, confirmMismatch, mismatchReason, reviewDuration } = req.body;

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

    // Use observationData stored in report (populated when OrderID was saved)
    console.log('[REVIEW CONTROLLER] Using observation data for validation:', report.orderId);
    const obsData = report.observationData;

    if (!obsData || !obsData.orderId) {
      return res.status(404).json({
        success: false,
        message: `Observation data not found for Order ID: ${report.orderId}. Please re-save the Order ID.`,
        requiresValidOrder: true
      });
    }

    // Validate demographics between observation data and report (age and gender only)
    const validations = [];

    // Validate age
    const obsAge = obsData.patient_age || '';
    const reportAge = report.extractedData?.patientAge || '';

    if (obsAge && reportAge) {
      // Extract years from age strings for comparison (e.g., "35 Y,2 M,5 D" -> 35)
      const extractYears = (age) => {
        const match = String(age).match(/(\d+)\s*Y/i);
        return match ? parseInt(match[1]) : null;
      };

      const obsYears = extractYears(obsAge);
      const reportYears = extractYears(reportAge);

      // If can't extract years, do string comparison; otherwise allow 1 year difference
      const ageMatch = (obsYears !== null && reportYears !== null)
        ? Math.abs(obsYears - reportYears) <= 1
        : obsAge.trim() === reportAge.trim();

      if (!ageMatch) {
        validations.push({
          type: 'AGE_MISMATCH',
          field: 'patientAge',
          orderValue: obsAge,
          reportValue: reportAge,
          message: `Age mismatch: Observation has "${obsAge}", Report has "${reportAge}"`
        });
      }
    }

    // Validate gender
    const obsGender = obsData.patient_gender || '';
    const reportGender = report.extractedData?.patientGender || '';

    if (obsGender && reportGender) {
      if (obsGender.toLowerCase() !== reportGender.toLowerCase()) {
        validations.push({
          type: 'GENDER_MISMATCH',
          field: 'patientGender',
          orderValue: obsGender,
          reportValue: reportGender,
          message: `Gender mismatch: Observation has "${obsGender}", Report has "${reportGender}"`
        });
      }
    }

    const validationResult = {
      hasWarnings: validations.length > 0,
      warnings: validations,
      summary: validations.length === 0 ? 'All demographics match' : `Found ${validations.length} mismatch(es)`
    };

    // If there are warnings and user hasn't confirmed
    if (validationResult.hasWarnings && !confirmMismatch) {
      console.log('[REVIEW CONTROLLER] Validation warnings found, requiring confirmation');

      return res.status(400).json({
        success: false,
        message: 'Data mismatches found between Observation and Report. Please review and confirm.',
        requiresConfirmation: true,
        validationWarnings: validationResult.warnings,
        orderData: {
          patient_name: obsData.patient_name,
          patient_age: obsData.patient_age,
          gender: obsData.patient_gender,
          date_of_test: obsData.orderDateTime
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

    // Generate finalData using Observation data (validated against Report data)
    const metaData = {
      USER_CODE: obsData.orderId || report.orderId,
      cug_code: obsData.cug_code || '',
      VISIT_CODE: '', // Not available in observation data
      patient_age: obsData.patient_age || '',
      gender: obsData.patient_gender || '',
      date_of_test: obsData.orderDateTime || '',
      lab_name: report.extractedData?.labName || obsData.center_name || '',
      location: '' // Not available in observation data
    };

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

    // Calculate and save audit summary (pass frontend review duration if provided)
    report.auditSummary = calculateAuditSummary(report, reviewDuration);

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
    const { reason, reviewDuration } = req.body;

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

    // Calculate and save audit summary (pass frontend review duration if provided)
    report.auditSummary = calculateAuditSummary(report, reviewDuration);

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

    // Use observationData stored in report (populated when OrderID was saved)
    const obsData = report.observationData;

    if (!obsData || !obsData.orderId) {
      console.log('[REVIEW CONTROLLER] No observation data found in report');
      return res.status(200).json({
        success: true,
        hasWarnings: true,
        validationWarnings: [{
          type: 'OBSERVATION_NOT_FOUND',
          field: 'orderId',
          message: `Observation data not found for Order ID "${report.orderId}". Please re-save the Order ID.`,
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

    console.log('[REVIEW CONTROLLER] Using observation data for validation');
    console.log('[REVIEW CONTROLLER] ObservationData from DB:', JSON.stringify({
      patient_age: obsData.patient_age,
      patient_gender: obsData.patient_gender,
      orderId: obsData.orderId,
      fetchedAt: obsData.fetchedAt
    }, null, 2));

    // Validate demographics between observation data and report (age and gender only)
    const validations = [];

    // Validate age
    const obsAge = obsData.patient_age || '';
    const reportAge = report.extractedData?.patientAge || '';

    if (obsAge && reportAge) {
      // Extract years from age strings for comparison (e.g., "35 Y,2 M,5 D" -> 35)
      const extractYears = (age) => {
        const match = String(age).match(/(\d+)\s*Y/i);
        return match ? parseInt(match[1]) : null;
      };

      const obsYears = extractYears(obsAge);
      const reportYears = extractYears(reportAge);

      // If can't extract years, do string comparison; otherwise allow 1 year difference
      const ageMatch = (obsYears !== null && reportYears !== null)
        ? Math.abs(obsYears - reportYears) <= 1
        : obsAge.trim() === reportAge.trim();

      if (!ageMatch) {
        validations.push({
          type: 'AGE_MISMATCH',
          field: 'patientAge',
          orderValue: obsAge,
          reportValue: reportAge,
          message: `Age mismatch: Observation has "${obsAge}", Report has "${reportAge}"`
        });
      }
    }

    // Validate gender
    const obsGender = obsData.patient_gender || '';
    const reportGender = report.extractedData?.patientGender || '';

    if (obsGender && reportGender) {
      if (obsGender.toLowerCase() !== reportGender.toLowerCase()) {
        validations.push({
          type: 'GENDER_MISMATCH',
          field: 'patientGender',
          orderValue: obsGender,
          reportValue: reportGender,
          message: `Gender mismatch: Observation has "${obsGender}", Report has "${reportGender}"`
        });
      }
    }

    // Return validation data
    return res.status(200).json({
      success: true,
      hasWarnings: validations.length > 0,
      validationWarnings: validations,
      orderData: {
        patient_name: obsData.patient_name,
        patient_age: obsData.patient_age,
        gender: obsData.patient_gender,
        date_of_test: obsData.orderDateTime
      },
      reportData: {
        patientName: report.extractedData?.patientName,
        patientAge: report.extractedData?.patientAge,
        patientGender: report.extractedData?.patientGender,
        dateOfTest: report.extractedData?.dateOfTest
      },
      summary: validations.length === 0
        ? 'All demographics match'
        : `Found ${validations.length} mismatch(es)`
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

// Delete parameter from report
const deleteParameter = async (req, res) => {
  const { id, parameterId } = req.params;
  const userId = req.user.userId;

  console.log('[DELETE PARAMETER] Starting delete for report:', id, 'parameter:', parameterId);

  try {
    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check if report is in correct status (allow both pending_review and ready)
    if (report.status !== 'pending_review' && report.status !== 'ready') {
      return res.status(400).json({
        success: false,
        message: 'Report must be in pending_review or ready status to delete parameters'
      });
    }

    // Find and remove parameter from extractedData.results
    let parameterFound = false;
    let deletedParameter = null;

    if (report.extractedData?.results) {
      const paramIndex = report.extractedData.results.findIndex(
        param => param._id?.toString() === parameterId || param.id === parameterId
      );

      if (paramIndex !== -1) {
        deletedParameter = report.extractedData.results[paramIndex];
        report.extractedData.results.splice(paramIndex, 1);
        parameterFound = true;
        console.log('[DELETE PARAMETER] Removed from extractedData.results');
      }
    }

    // Also remove from pageWiseData if it exists
    if (report.extractedData?.pageWiseData) {
      report.extractedData.pageWiseData.forEach(page => {
        if (page.testResults) {
          const pageParamIndex = page.testResults.findIndex(
            param => param._id?.toString() === parameterId || param.id === parameterId
          );
          if (pageParamIndex !== -1) {
            page.testResults.splice(pageParamIndex, 1);
            console.log('[DELETE PARAMETER] Removed from pageWiseData');
          }
        }
      });
    }

    // Also remove from finalData.results if it exists
    if (report.finalData?.results) {
      const finalIndex = report.finalData.results.findIndex(
        param => param._id?.toString() === parameterId || param.id === parameterId
      );
      if (finalIndex !== -1) {
        report.finalData.results.splice(finalIndex, 1);
        console.log('[DELETE PARAMETER] Removed from finalData.results');
      }
    }

    if (!parameterFound) {
      return res.status(404).json({
        success: false,
        message: 'Parameter not found in report'
      });
    }

    // Add to edit history
    if (!report.editHistory) {
      report.editHistory = [];
    }

    report.editHistory.push({
      field: 'parameter_deleted',
      originalValue: deletedParameter ? JSON.stringify({
        name: deletedParameter.serviceItemName || deletedParameter.name,
        value: deletedParameter.value,
        unit: deletedParameter.unit
      }) : 'Unknown parameter',
      newValue: 'DELETED',
      editedBy: userId,
      editedAt: new Date(),
      reason: 'Parameter deleted by nurse'
    });

    // Re-run validation to update flags
    const parameterValidator = require('../services/parameterValidator.service');
    const validationResult = await parameterValidator.validateAgainstMaster(report.extractedData);
    report.validationFlags = validationResult.validationFlags;

    // Update counts
    report.extractedData.totalTestResultsCount = report.extractedData.results?.length || 0;

    // Mark the report as modified
    report.markModified('extractedData');
    report.markModified('finalData');
    report.markModified('editHistory');
    report.markModified('validationFlags');

    // Save the updated report
    const savedReport = await report.save();

    console.log('[DELETE PARAMETER] Parameter deleted successfully');

    res.status(200).json({
      success: true,
      message: 'Parameter deleted successfully',
      data: savedReport
    });

  } catch (error) {
    console.error('[DELETE PARAMETER] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete parameter',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Publish report to digitization_observation collection
const publishReport = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[REVIEW CONTROLLER] Publishing report:', id);

    // 1. Find the approved report with finalData
    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    if (report.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Only approved reports can be published' });
    }

    if (!report.finalData || !report.finalData.results || report.finalData.results.length === 0) {
      return res.status(400).json({ success: false, message: 'No test results to publish' });
    }

    const obs = report.observationData || {};
    const results = report.finalData.results;

    // Validation - check observation data conditions
    // Note: part_of_package may be stored as string "true" or boolean true
    if (
      obs.status !== "Final" ||
      String(obs.part_of_package) !== "true" ||
      obs.serviceType_code !== "pathology"
    ) {
      return res.status(400).json({
        ok: false,
        error: "Observation data does not meet required conditions (status, part_of_package, serviceType_code)"
      });
    }

    // 2. Unique ID generator
    let uniqueNumber = 0;
    const nextNumber = () => {
      if (uniqueNumber >= 99) uniqueNumber = 0;
      uniqueNumber++;
      return uniqueNumber;
    };
    const getUniqueId = () => `${crypto.randomUUID()}-${nextNumber()}`;

    // 3. Build rows for each result
    const allResults = [];

    for (const api of results) {
      // obsPart - from observationData (same for all rows)
      const obsPart = {
        account_time_zone: obs.account_time_zone || "",
        uhId: obs.uhId || "",
        patientId: obs.patientId || "",
        facility_id: obs.facility_id || "",
        account_id: obs.account_id || "",
        serviceType_code: obs.serviceType_code || "",
        orderId: obs.orderId || "",
        accessionIdentifier: obs.accessionIdentifier || "",
        category: obs.category || "",
        episode_id: obs.episode_id || "",
        patient_age: obs.patient_age || "",
        patient_dob: obs.patient_dob || "",
        patient_gender: obs.patient_gender || "",
        isOutsourced: obs.isOutsourced || "",
        patientType: obs.patientType || "",
        patient_name: obs.patient_name || "",
        referBy: obs.referBy || "",
        payer_id: obs.payer_id || "",
        payer_name: obs.payer_name || "",
        payer_type: obs.payer_type || "",
        orderDateTime: obs.orderDateTime || "",
        telecom: obs.telecom || "",
        center_type_name: obs.center_type_name || "",
        package_id: obs.package_id || "",
        part_of_package: obs.part_of_package || "",
        package_name: obs.package_name || "",
        email: obs.email || "",
        center_name: obs.center_name || "",
        orderBy: obs.orderBy || "",
        care_type: obs.care_type || "",
        care_type_name: obs.care_type_name || "",
        status: obs.status || "",
        acknowledgedDateTime: obs.acknowledgedDateTime || "",
        outSourceCentre: obs.outSourceCentre || "",
        orderReferenceId: obs.orderReferenceId || "",
        reportStatus: obs.reportStatus || "",
        uploadedDocumentId: obs.uploadedDocumentId || "",
        verificationDateTime: obs.verificationDateTime || "",
        outSourceCentre_id: obs.outSourceCentre_id || "",
        admittingDoctor: obs.admittingDoctor || "",
        cug_code: obs.cug_code || "",
        package_service_code: obs.package_service_code || ""
      };

      // fields - fixed + blank + null values (same for all rows)
      const fields = {
        // ------------ FIXED FIELDS ------------
        g_created_by_id: "Richa001",
        g_created_by_name: "Richa",
        g_created_by_loginId: "richajain",
        g_created_by_role: "Admin",
        g_created_by_role_type: "AdminRole",
        g_modified_by_id: "Richa001",
        g_modified_by_loginId: "richajain",
        g_modified_by_name: "Richa",
        g_modified_by_role: "Admin",
        g_modified_by_role_type: "AdminRole",
        g_soft_delete: "N",
        isResultCritical: false,
        isAmended: false,
        isProvisional: false,

        // ------------ BLANK FIELDS (empty string "") ------------
        serviceType: "",
        orderingDoctorId: "",
        orderingDoctorName: "",
        serviceItemCode: "",
        department: "",
        subDepartment: "",
        departmentId: "",
        subDepartmentId: "",
        sampleCollectionDateTime: "",
        specimen: "",
        encounter_id: "",
        note: "",
        remarks: "",
        interpretation: "",
        advice: "",
        resultType: "",
        time: "",
        specimenId: "",
        isUniqueBarCodeRequired: "",
        serviceDisplayName: "",
        employer_name: "",
        employee_id: "",
        relation: "",
        nurse_remark: "",
        orderedFrom: "",
        payer_group: "",
        payer_sub_group: "",
        op_no: "",
        package_type: "",
        package_sub_type: "",
        package_type_code: "",
        package_sub_type_code: "",
        bill_date_time: "",
        archival_ref_dt: "",
        address: {
          city: "",
          cityDisplayName: "",
          country: "",
          countryDisplayName: "",
          latitude: "",
          longitude: "",
          pincode: "",
          pincodeDisplayName: "",
          state: "",
          stateDisplayName: "",
          street1: "",
          street2: "",
          street3: ""
        },
        g_migration_status: "",
        g_migration_billing: "",
        bookingDate: "",
        hasMember: "",
        partOf: "",
        partOfName: "",
        abnormalValueInterpretation: "",
        referById: "",
        referType: "",
        referType_display: "",
        employee_department: "",
        employee_subDepartment: "",
        package_start_date: "",
        isBloodRequest: "",
        alert_notification: "",
        g_archival_date_time: "",
        s3: "",
        employee_department_id: "",
        employee_subDepartment_id: "",

        // Tag Data
        tag_data: [
          {
            key_name: "",
            key_value_code: "",
            key_value_display: "",
            visible: ""
          }
        ],

        // ------------ NULL FIELDS ------------
        archival_required: null,
        containsBasicInfo: null,
        service_sequence: null,
        isMultiStage: null,
        isConfidential: null,
        priority: null,
        priorityCode: null,
        isResultBoldOnPrint: null,
        isNABLCertified: null,
        serviceRequestId: null,
        service_code: null,
        tray_code: null,
        package_serviceRequestId: null,
        isInsourced: null,
        systemName: null
      };

      // apiPart - from individual result (unique per row)
      const apiPart = {
        serviceItemName: api.serviceItemName || "",
        value: api.value || "",
        method: api.method || "",
        impression: api.impression || "",
        labServiceType: api.labServiceType || "",
        outsource_service_code: api.serviceItemName || "",
        unit: api.unit || "",
        referenceRange: {
          high: api.referenceRange?.high || "",
          low: api.referenceRange?.low || "",
          referenceRange: api.referenceRange?.referenceRange || ""
        }
      };

      const rowId = getUniqueId();

      const finalRow = {
        ...obsPart,
        ...fields,
        ...apiPart,
        id: rowId,
        _id: rowId,
        g_creation_time: BigInt(Date.now()) * BigInt(1000000),
        g_modify_time: BigInt(Date.now()) * BigInt(1000000)
      };

      allResults.push(finalRow);
    }

    // 4. Insert into external observation_non_digitized collection
    console.log('[PUBLISH] Inserting', allResults.length, 'results to external observation_non_digitized');
    const insertResult = await externalDb.insertToNonDigitized(allResults);

    console.log(`[REVIEW CONTROLLER] Published ${insertResult.insertedCount} rows to external observation_non_digitized`);

    // 5. Update report status to 'published'
    report.status = 'published';
    report.publishedAt = new Date();
    await report.save();
    console.log(`[REVIEW CONTROLLER] Report status updated to 'published'`);

    return res.status(200).json({
      success: true,
      message: `Successfully published ${insertResult.insertedCount} test results`,
      insertedCount: insertResult.insertedCount,
      status: 'published'
    });
  } catch (error) {
    console.error('[REVIEW CONTROLLER] Publish error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to publish report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getReportForReview,
  editParameter,
  editDemographics,
  bulkEditParameters,
  updateOrderId,
  approveReport,
  rejectReport,
  getEditHistory,
  getValidationData,
  deleteParameter,
  publishReport
};