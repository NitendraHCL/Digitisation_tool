// CUG codes to filter in billing lookup
const HEALTH_CHECK_CUG_CODES = Object.freeze([
  'HCLT001', 'HCLHC001', 'TKNK001', 'RET001'
]);

// CUG codes where relationship must be Self (case-insensitive)
const SELF_ONLY_CUG_CODES = Object.freeze([
  'HCLT001', 'HCLHC001'
]);

module.exports = { HEALTH_CHECK_CUG_CODES, SELF_ONLY_CUG_CODES };
