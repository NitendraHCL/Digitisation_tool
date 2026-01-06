const ParameterMaster = require('../models/ParameterMaster');
const ParameterExclusion = require('../models/ParameterExclusion');
const audit = require('../utils/auditLogger');

/**
 * Parameter Validation Service
 * Validates extracted lab report data against Parameter Master table
 * Checks exclusion list before flagging mismatches
 * Returns validation flags for UI highlighting (non-blocking)
 */
class ParameterValidatorService {
  /**
   * Validate all parameters in extracted data against Parameter Master
   * @param {Object} extractedData - Extracted report data with results array
   * @param {string} requestId - Request ID for audit logging
   * @returns {Object} - { validationFlags: [...], summary: {...} }
   */
  async validateAgainstMaster(extractedData, requestId = null) {
    const startTime = Date.now();

    if (!extractedData || !extractedData.results || extractedData.results.length === 0) {
      if (requestId) {
        audit.logWarning(requestId, 'No parameters to validate');
      }
      return {
        validationFlags: [],
        summary: {
          total: 0,
          parameterNotFound: 0,
          unitMismatch: 0,
          valueTypeMismatch: 0,
          excluded: 0
        }
      };
    }

    const reqId = requestId || 'N/A';
    console.log(`[${reqId}] [VALIDATOR] Starting validation against Parameter Master...`);
    console.log(`[${reqId}] [VALIDATOR] Parameters to validate:`, extractedData.results.length);

    const validationFlags = [];
    const summary = {
      total: extractedData.results.length,
      parameterNotFound: 0,
      unitMismatch: 0,
      valueTypeMismatch: 0,
      excluded: 0
    };

    // Validate each parameter
    for (let i = 0; i < extractedData.results.length; i++) {
      const result = extractedData.results[i];
      const parameterName = result.serviceItemName || result.parameterName;

      if (!parameterName) {
        console.warn('[VALIDATOR] Skipping result with no parameter name at index', i);
        continue;
      }

      // Find parameter in master (by name or alias)
      const masterParam = await ParameterMaster.findByNameOrAlias(parameterName);

      if (!masterParam) {
        // Check if parameter is excluded before flagging
        const exclusionCheck = await ParameterExclusion.isExcluded(
          parameterName,
          result.unit,
          extractedData.labName || null
        );

        if (exclusionCheck.isExcluded) {
          // Parameter is intentionally excluded - log but don't flag as error
          console.log('[VALIDATOR] Parameter is excluded:', parameterName, '- Reason:', exclusionCheck.reason);

          validationFlags.push({
            resultIndex: i,
            parameterId: null,
            parameterName: parameterName,
            field: 'parameterName',
            flagType: 'PARAMETER_EXCLUDED',
            expected: 'N/A - Parameter is excluded',
            actual: parameterName,
            severity: 'info',
            message: `Parameter "${parameterName}" is excluded from validation. Reason: ${exclusionCheck.reason}`,
            isExcluded: true,
            exclusionReason: exclusionCheck.reason
          });

          summary.excluded++;
          continue; // Skip further validation for excluded parameters
        }

        // Flag: Parameter not found in master and not excluded
        console.log('[VALIDATOR] Parameter not found in master:', parameterName);

        validationFlags.push({
          resultIndex: i,
          parameterId: null,
          parameterName: parameterName,
          field: 'parameterName',
          flagType: 'PARAMETER_NOT_FOUND',
          expected: 'Parameter should exist in Parameter Master',
          actual: parameterName,
          severity: 'warning',
          message: `Parameter "${parameterName}" not found in Parameter Master. May be misspelled or new parameter.`
        });

        summary.parameterNotFound++;
        continue; // Can't validate further without master entry
      }

      console.log('[VALIDATOR] Validating:', parameterName, '→ Master:', masterParam.parameterName);

      // Validate unit
      if (result.unit !== undefined && result.unit !== null) {
        const unitValid = masterParam.validateUnit(result.unit);

        if (!unitValid) {
          // Check if this specific unit is excluded
          const unitExclusionCheck = await ParameterExclusion.isExcluded(
            parameterName,
            result.unit,
            extractedData.labName || null
          );

          if (unitExclusionCheck.isExcluded) {
            console.log('[VALIDATOR] Unit excluded for parameter:', parameterName, '- Unit:', result.unit, '- Reason:', unitExclusionCheck.reason);

            validationFlags.push({
              resultIndex: i,
              parameterId: masterParam.parameterId,
              parameterName: parameterName,
              field: 'unit',
              flagType: 'UNIT_EXCLUDED',
              expected: masterParam.possibleUnits,
              actual: result.unit,
              severity: 'info',
              message: `Unit "${result.unit}" is excluded for ${masterParam.parameterName}. Reason: ${unitExclusionCheck.reason}`,
              isExcluded: true,
              exclusionReason: unitExclusionCheck.reason
            });
          } else {
            console.log('[VALIDATOR] Unit mismatch:', parameterName, '- Expected:', masterParam.possibleUnits, '- Found:', result.unit);

            validationFlags.push({
              resultIndex: i,
              parameterId: masterParam.parameterId,
              parameterName: parameterName,
              field: 'unit',
              flagType: 'UNIT_MISMATCH',
              expected: masterParam.possibleUnits,
              actual: result.unit,
              severity: 'error',
              message: `Unit "${result.unit}" not in expected units for ${masterParam.parameterName}. Expected: ${masterParam.possibleUnits.join(', ')}`
            });

            summary.unitMismatch++;
          }
        }
      }

      // Validate value type
      if (result.value !== undefined && result.value !== null) {
        const valueValid = masterParam.validateValue(result.value);

        if (!valueValid) {
          console.log('[VALIDATOR] Value type mismatch:', parameterName, '- Expected:', masterParam.valueType, '- Found:', result.value);

          validationFlags.push({
            resultIndex: i,
            parameterId: masterParam.parameterId,
            parameterName: parameterName,
            field: 'value',
            flagType: 'VALUE_TYPE_MISMATCH',
            expected: masterParam.valueType,
            actual: typeof result.value === 'string' ? result.value : String(result.value),
            severity: 'warning',
            message: `Value "${result.value}" does not match expected type "${masterParam.valueType}" for ${masterParam.parameterName}`
          });

          summary.valueTypeMismatch++;
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(3);

    console.log(`[${reqId}] [VALIDATOR] ════════════════════════════════════════`);
    console.log(`[${reqId}] [VALIDATOR] ✅ Validation Complete in ${duration}s`);
    console.log(`[${reqId}] [VALIDATOR] ════════════════════════════════════════`);
    console.log(`[${reqId}] [VALIDATOR] 📊 Summary:`);
    console.log(`[${reqId}] [VALIDATOR]    - Total parameters: ${summary.total}`);
    console.log(`[${reqId}] [VALIDATOR]    - Not found: ${summary.parameterNotFound}`);
    console.log(`[${reqId}] [VALIDATOR]    - Unit mismatches: ${summary.unitMismatch}`);
    console.log(`[${reqId}] [VALIDATOR]    - Value type mismatches: ${summary.valueTypeMismatch}`);
    console.log(`[${reqId}] [VALIDATOR]    - Excluded: ${summary.excluded}`);
    console.log(`[${reqId}] [VALIDATOR]    - Total flags: ${validationFlags.length}`);
    console.log(`[${reqId}] [VALIDATOR] ════════════════════════════════════════`);

    if (requestId) {
      audit.logStep(requestId, 'VALIDATOR_SUMMARY', {
        status: 'success',
        duration: parseFloat(duration),
        count: validationFlags.length,
        message: `Total: ${summary.total} | NotFound: ${summary.parameterNotFound} | UnitMismatch: ${summary.unitMismatch} | Excluded: ${summary.excluded}`
      });
    }

    return {
      validationFlags,
      summary
    };
  }

  /**
   * Validate a single parameter
   * @param {Object} parameter - Single parameter object
   * @returns {Array} - Array of validation flags (if any)
   */
  async validateSingleParameter(parameter) {
    const { validationFlags } = await this.validateAgainstMaster({ results: [parameter] });
    return validationFlags;
  }

  /**
   * Get suggestions for misspelled parameter names
   * @param {String} parameterName - Parameter name to search
   * @returns {Array} - Array of suggested parameters
   */
  async getSuggestions(parameterName) {
    const suggestions = await ParameterMaster.fuzzySearch(parameterName);
    return suggestions.map(p => ({
      parameterId: p.parameterId,
      parameterName: p.parameterName,
      aliases: p.aliases
    }));
  }
}

module.exports = new ParameterValidatorService();
