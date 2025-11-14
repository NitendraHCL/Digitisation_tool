const LabConfig = require('../models/LabConfig');

class ThresholdCheckerService {
  /**
   * Check if a value is abnormal based on reference range and configured threshold
   * @param {number} value - The test value
   * @param {number} low - Reference range low
   * @param {number} high - Reference range high
   * @param {number} thresholdPercent - Percentage threshold (e.g., 200 for 200%)
   * @returns {object} - { isAbnormal, severity, percentDeviation }
   */
  checkValueAbnormality(value, low, high, thresholdPercent = 200) {
    // Skip if no reference range
    if (low === null || high === null || low === undefined || high === undefined) {
      return {
        isAbnormal: false,
        severity: 'normal',
        percentDeviation: 0,
        message: 'No reference range available'
      };
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return {
        isAbnormal: false,
        severity: 'normal',
        percentDeviation: 0,
        message: 'Non-numeric value'
      };
    }

    // Check if within normal range
    if (numValue >= low && numValue <= high) {
      return {
        isAbnormal: false,
        severity: 'normal',
        percentDeviation: 0,
        message: 'Within normal range'
      };
    }

    // Calculate deviation
    let percentDeviation = 0;
    let deviationFrom = '';

    if (numValue < low) {
      // Below normal
      percentDeviation = ((low - numValue) / low) * 100;
      deviationFrom = 'low';
    } else if (numValue > high) {
      // Above normal
      percentDeviation = ((numValue - high) / high) * 100;
      deviationFrom = 'high';
    }

    // Determine severity based on deviation
    let severity = 'mild'; // Default for any out-of-range value
    let isAbnormal = true;

    if (percentDeviation >= thresholdPercent) {
      severity = 'critical';
    } else if (percentDeviation >= thresholdPercent / 2) {
      severity = 'moderate';
    }

    return {
      isAbnormal,
      severity,
      percentDeviation: Math.round(percentDeviation * 10) / 10,
      deviationFrom,
      message: `${Math.round(percentDeviation)}% ${deviationFrom === 'high' ? 'above' : 'below'} normal range`
    };
  }

  /**
   * Process all test results and calculate flags
   * @param {array} results - Array of test results
   * @param {object} config - Lab configuration with thresholds
   * @returns {object} - Comprehensive flag information
   */
  async calculateFlags(results, config = null) {
    const startTime = Date.now();
    console.log('[THRESHOLD] 1. ========== STARTING THRESHOLD ANALYSIS ==========');
    console.log('[THRESHOLD] 2. Number of parameters to analyze:', results.length);

    // Get configuration if not provided
    if (!config) {
      console.log('[THRESHOLD] 3. Fetching lab configuration...');
      config = await LabConfig.getConfig();
    }

    const thresholdPercent = config.thresholdPercentage || 200;
    const flagThreshold = config.flagThreshold || 50;

    console.log('[THRESHOLD] 4. ========== CONFIGURATION ==========');
    console.log('[THRESHOLD] 5. Critical threshold:', thresholdPercent + '%', 'deviation');
    console.log('[THRESHOLD] 6. Flag threshold:', flagThreshold + '%', 'abnormal parameters');

    const flags = {
      hasAbnormalValues: false,
      abnormalCount: 0,
      criticalCount: 0,
      abnormalParameters: [],
      criticalParameters: [],
      percentAbnormal: 0,
      requiresAttention: false,
      requiresUrgentAttention: false,
      summary: ''
    };

    console.log('[THRESHOLD] 7. ========== ANALYZING PARAMETERS ==========');

    // Check each result
    let normalCount = 0;
    for (let i = 0; i < results.length; i++) {
      const result = results[i];

      // Parse reference range
      const ref = result.referenceRange || {};
      const low = ref.low;
      const high = ref.high;

      // DEBUG: Check for NaN in reference range values
      if (Number.isNaN(low)) {
        console.warn(`[THRESHOLD] DEBUG - NaN detected for low value in parameter: "${result.serviceItemName}"`);
        console.warn(`[THRESHOLD] DEBUG - Result object:`, JSON.stringify(result, null, 2));
      }
      if (Number.isNaN(high)) {
        console.warn(`[THRESHOLD] DEBUG - NaN detected for high value in parameter: "${result.serviceItemName}"`);
        console.warn(`[THRESHOLD] DEBUG - Result object:`, JSON.stringify(result, null, 2));
      }

      // Check abnormality
      const check = this.checkValueAbnormality(
        result.value,
        low,
        high,
        thresholdPercent
      );

      // Add abnormality info to result (for display)
      result.abnormalityCheck = check;

      // Log each parameter check
      const statusSymbol = check.isAbnormal ? (check.severity === 'critical' ? '🔴' : '🟡') : '🟢';
      console.log(`[THRESHOLD] 8.${i + 1}. ${statusSymbol} ${result.serviceItemName}: ${result.value} ${result.unit || ''} | Range: ${ref.referenceRange || 'N/A'} | ${check.message}`);

      if (check.isAbnormal) {
        flags.hasAbnormalValues = true;
        flags.abnormalCount++;

        const flagInfo = {
          parameter: result.serviceItemName,
          value: result.value,
          unit: result.unit,
          referenceRange: ref.referenceRange,
          severity: check.severity,
          deviation: check.percentDeviation,
          message: check.message
        };

        flags.abnormalParameters.push(flagInfo);

        if (check.severity === 'critical') {
          flags.criticalCount++;
          flags.criticalParameters.push(flagInfo);
          flags.requiresUrgentAttention = true;
          console.log(`[THRESHOLD] ⚠️  CRITICAL VALUE DETECTED: ${result.serviceItemName} = ${result.value} (${check.percentDeviation}% deviation)`);
        }
      } else {
        normalCount++;
      }
    }

    console.log('[THRESHOLD] 9. ========== ANALYSIS SUMMARY ==========');
    console.log('[THRESHOLD] 10. Normal parameters:', normalCount);
    console.log('[THRESHOLD] 11. Abnormal parameters:', flags.abnormalCount);
    console.log('[THRESHOLD] 12. Critical parameters:', flags.criticalCount);

    // Calculate percentage of abnormal parameters
    if (results.length > 0) {
      flags.percentAbnormal = Math.round((flags.abnormalCount / results.length) * 100);
    }

    console.log('[THRESHOLD] 13. Percent abnormal:', flags.percentAbnormal + '%');

    // Check if report needs flagging based on percentage threshold
    if (flags.percentAbnormal >= flagThreshold) {
      flags.requiresAttention = true;
      console.log('[THRESHOLD] 14. ⚠️  Report REQUIRES ATTENTION (exceeds', flagThreshold + '%', 'threshold)');
    } else {
      console.log('[THRESHOLD] 14. ✓ Report within acceptable limits');
    }

    // List critical parameters if any
    if (flags.criticalCount > 0) {
      console.log('[THRESHOLD] 15. ========== CRITICAL PARAMETERS ==========');
      flags.criticalParameters.forEach((param, idx) => {
        console.log(`[THRESHOLD] 16.${idx + 1}. ${param.parameter}: ${param.value} ${param.unit} (${param.deviation}% deviation)`);
      });
    }

    // Generate summary
    if (flags.criticalCount > 0) {
      flags.summary = `CRITICAL: ${flags.criticalCount} critical value(s) detected. Immediate attention required.`;
    } else if (flags.requiresAttention) {
      flags.summary = `ATTENTION: ${flags.abnormalCount} abnormal values (${flags.percentAbnormal}% of parameters). Review required.`;
    } else if (flags.hasAbnormalValues) {
      flags.summary = `${flags.abnormalCount} parameter(s) outside normal range but within acceptable limits.`;
    } else {
      flags.summary = 'All parameters within normal range.';
    }

    console.log('[THRESHOLD] 17. Summary:', flags.summary);
    console.log('[THRESHOLD] 18. Requires urgent attention:', flags.requiresUrgentAttention);
    console.log('[THRESHOLD] 19. Requires attention:', flags.requiresAttention);

    const duration = Date.now() - startTime;
    console.log('[THRESHOLD] 20. ========== ANALYSIS COMPLETE ==========');
    console.log('[THRESHOLD] 21. Analysis completed in', duration, 'ms');

    return flags;
  }

  /**
   * Check for specific critical values that always need attention
   * @param {string} parameterName - Name of the parameter
   * @param {number} value - Test value
   * @returns {boolean} - True if critical
   */
  checkCriticalValue(parameterName, value) {
    // Define critical value rules for specific parameters
    const criticalRules = {
      'glucose': { low: 40, high: 500 },
      'hemoglobin': { low: 7, high: 20 },
      'platelet count': { low: 20000, high: 1000000 },
      'potassium': { low: 2.5, high: 6.5 },
      'sodium': { low: 120, high: 160 },
      'creatinine': { low: 0, high: 10 }
    };

    const paramLower = parameterName.toLowerCase();

    for (const [param, limits] of Object.entries(criticalRules)) {
      if (paramLower.includes(param)) {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          if (numValue <= limits.low || numValue >= limits.high) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Generate visual indicators for UI display
   * @param {object} flags - Calculated flags
   * @returns {object} - UI display indicators
   */
  generateUIIndicators(flags) {
    const startTime = Date.now();
    console.log('[THRESHOLD-UI] 1. Generating UI indicators...');

    const indicators = {
      color: 'green',
      icon: '✓',
      badge: 'Normal',
      priority: 'low'
    };

    if (flags.requiresUrgentAttention) {
      indicators.color = 'red';
      indicators.icon = '⚠️';
      indicators.badge = 'Critical';
      indicators.priority = 'urgent';
    } else if (flags.requiresAttention) {
      indicators.color = 'orange';
      indicators.icon = '⚡';
      indicators.badge = 'Review Required';
      indicators.priority = 'high';
    } else if (flags.hasAbnormalValues) {
      indicators.color = 'yellow';
      indicators.icon = '!';
      indicators.badge = 'Minor Abnormalities';
      indicators.priority = 'medium';
    }

    const duration = Date.now() - startTime;
    console.log('[THRESHOLD-UI] 2. ✓ UI indicators generated:', indicators.badge, '(' + indicators.color + ')');
    console.log('[THRESHOLD-UI] 3. Generation time:', duration, 'ms');

    return indicators;
  }
}

module.exports = new ThresholdCheckerService();