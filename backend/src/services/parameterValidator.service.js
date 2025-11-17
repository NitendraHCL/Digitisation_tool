const ParameterMaster = require('../models/ParameterMaster');

/**
 * Parameter Validation Service
 * Validates extracted lab report data against Parameter Master table
 * Returns validation flags for UI highlighting (non-blocking)
 */
class ParameterValidatorService {
  /**
   * Validate all parameters in extracted data against Parameter Master
   * @param {Object} extractedData - Extracted report data with results array
   * @returns {Object} - { validationFlags: [...], summary: {...} }
   */
  async validateAgainstMaster(extractedData) {
    if (!extractedData || !extractedData.results || extractedData.results.length === 0) {
      return {
        validationFlags: [],
        summary: {
          total: 0,
          parameterNotFound: 0,
          unitMismatch: 0,
          valueTypeMismatch: 0
        }
      };
    }

    console.log('[VALIDATOR] Starting validation against Parameter Master...');
    console.log('[VALIDATOR] Parameters to validate:', extractedData.results.length);

    const validationFlags = [];
    const summary = {
      total: extractedData.results.length,
      parameterNotFound: 0,
      unitMismatch: 0,
      valueTypeMismatch: 0
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
        // Flag: Parameter not found in master
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

    console.log('[VALIDATOR] Validation complete:');
    console.log('[VALIDATOR] - Total parameters:', summary.total);
    console.log('[VALIDATOR] - Not found in master:', summary.parameterNotFound);
    console.log('[VALIDATOR] - Unit mismatches:', summary.unitMismatch);
    console.log('[VALIDATOR] - Value type mismatches:', summary.valueTypeMismatch);
    console.log('[VALIDATOR] - Total flags:', validationFlags.length);

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
