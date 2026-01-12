/**
 * Gemini API Key Manager
 *
 * Purpose:
 * - Manages multiple Gemini API keys for resilience
 * - Round-robin rotation per request
 * - Rate-limit aware: skips keys on cooldown for 60 seconds
 * - Retry uses next AVAILABLE key in rotation
 *
 * Configuration:
 * - Supports 1-N keys (flexible configuration)
 * - Keys loaded from GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc.
 * - Falls back to GEMINI_API_KEY if no numbered keys found
 *
 * Note: Multiple keys provide resilience. Rate-limited keys are
 * automatically put on cooldown and skipped until cooldown expires.
 */

class GeminiKeyManager {
  constructor() {
    this.keys = [];
    this.currentIndex = 0;
    this.cooldownDuration = 60000; // 60 seconds cooldown for rate-limited keys
    this.initializeKeys();
  }

  /**
   * Initialize keys from environment variables
   * Supports flexible number of keys (1-N)
   */
  initializeKeys() {
    // Load all available numbered keys
    const keyEnvVars = [
      'GEMINI_API_KEY_1',
      'GEMINI_API_KEY_2',
      'GEMINI_API_KEY_3',
      'GEMINI_API_KEY_4'
    ];

    for (const envVar of keyEnvVars) {
      const key = process.env[envVar];
      if (key && key.trim()) {
        this.keys.push({
          key: key.trim(),
          envVar: envVar,
          usageCount: 0,
          lastUsed: null,
          errorCount: 0,
          cooldownUntil: null  // Track when key can be used again after rate limit
        });
      }
    }

    // Fallback to original GEMINI_API_KEY if no numbered keys
    if (this.keys.length === 0 && process.env.GEMINI_API_KEY) {
      this.keys.push({
        key: process.env.GEMINI_API_KEY.trim(),
        envVar: 'GEMINI_API_KEY',
        usageCount: 0,
        lastUsed: null,
        errorCount: 0,
        cooldownUntil: null
      });
    }

    if (this.keys.length === 0) {
      throw new Error('[GEMINI KEY MANAGER] No Gemini API keys configured. Set GEMINI_API_KEY_1 or GEMINI_API_KEY in .env');
    }

    console.log(`[GEMINI KEY MANAGER] Initialized with ${this.keys.length} API key(s)`);
    this.keys.forEach((keyInfo, idx) => {
      console.log(`[GEMINI KEY MANAGER]   Key ${idx + 1}: ${keyInfo.envVar} (${keyInfo.key.substring(0, 8)}...)`);
    });
  }

  /**
   * Get the next API key in rotation
   * @returns {string} The API key
   */
  getNextKey() {
    const result = this.getNextKeyWithInfo();
    return result.key;
  }

  /**
   * Get the next API key in rotation with metadata
   * @returns {Object} { key, keyIndex, keyName, totalKeys }
   */
  getNextKeyWithInfo() {
    const keyInfo = this.keys[this.currentIndex];
    keyInfo.usageCount++;
    keyInfo.lastUsed = new Date();

    const keyIndex = this.currentIndex + 1;
    const totalKeys = this.keys.length;
    const keyName = keyInfo.envVar;

    this.currentIndex = (this.currentIndex + 1) % this.keys.length;

    console.log(`[GEMINI KEY MANAGER] Using key ${keyIndex}/${totalKeys} (${keyName})`);

    return {
      key: keyInfo.key,
      keyIndex,
      keyName,
      totalKeys
    };
  }

  /**
   * Report an error for the current key (for tracking purposes)
   * @param {string} key - The key that encountered an error
   * @param {string} errorMessage - The error message
   */
  reportError(key, errorMessage) {
    const keyInfo = this.keys.find(k => k.key === key);
    if (keyInfo) {
      keyInfo.errorCount++;
      console.warn(`[GEMINI KEY MANAGER] Key ${keyInfo.envVar} error count: ${keyInfo.errorCount}`);
    }
  }

  /**
   * Get the next AVAILABLE key, skipping keys on cooldown
   * This is the rate-limit aware version of getNextKeyWithInfo
   * @returns {Object} { key, keyIndex, keyName, totalKeys }
   */
  getNextAvailableKeyWithInfo() {
    const now = Date.now();
    const totalKeys = this.keys.length;

    // Try to find a non-cooldown key, starting from current index
    for (let i = 0; i < totalKeys; i++) {
      const idx = (this.currentIndex + i) % totalKeys;
      const keyInfo = this.keys[idx];

      // Skip keys on cooldown
      if (keyInfo.cooldownUntil && keyInfo.cooldownUntil > now) {
        const remainingCooldown = Math.ceil((keyInfo.cooldownUntil - now) / 1000);
        console.log(`[GEMINI KEY MANAGER] Key ${idx + 1} (${keyInfo.envVar}) on cooldown for ${remainingCooldown}s, skipping...`);
        continue;
      }

      // Found available key
      keyInfo.usageCount++;
      keyInfo.lastUsed = new Date();
      this.currentIndex = (idx + 1) % totalKeys;

      console.log(`[GEMINI KEY MANAGER] Using available key ${idx + 1}/${totalKeys} (${keyInfo.envVar})`);

      return {
        key: keyInfo.key,
        keyIndex: idx + 1,
        keyName: keyInfo.envVar,
        totalKeys
      };
    }

    // All keys on cooldown - return the one with shortest remaining cooldown
    console.warn('[GEMINI KEY MANAGER] ⚠️ All keys on cooldown! Using key with shortest wait...');
    let shortestWait = Infinity;
    let bestKeyIdx = 0;

    for (let i = 0; i < totalKeys; i++) {
      const keyInfo = this.keys[i];
      const wait = (keyInfo.cooldownUntil || 0) - now;
      if (wait < shortestWait) {
        shortestWait = wait;
        bestKeyIdx = i;
      }
    }

    const keyInfo = this.keys[bestKeyIdx];
    keyInfo.usageCount++;
    keyInfo.lastUsed = new Date();
    this.currentIndex = (bestKeyIdx + 1) % totalKeys;

    console.log(`[GEMINI KEY MANAGER] Using least-cooldown key ${bestKeyIdx + 1}/${totalKeys} (${keyInfo.envVar}), wait: ${Math.ceil(shortestWait/1000)}s`);

    return {
      key: keyInfo.key,
      keyIndex: bestKeyIdx + 1,
      keyName: keyInfo.envVar,
      totalKeys
    };
  }

  /**
   * Mark a key as rate-limited (put on cooldown)
   * The key will be skipped for cooldownDuration (default 60s)
   * @param {string} key - The key that hit rate limit
   * @param {number} cooldownMs - Optional custom cooldown duration in ms
   */
  markRateLimited(key, cooldownMs = null) {
    const keyInfo = this.keys.find(k => k.key === key);
    if (keyInfo) {
      const duration = cooldownMs || this.cooldownDuration;
      keyInfo.cooldownUntil = Date.now() + duration;
      keyInfo.errorCount++;
      console.warn(`[GEMINI KEY MANAGER] 🚫 Key ${keyInfo.envVar} marked RATE-LIMITED, cooldown for ${duration/1000}s`);
    }
  }

  /**
   * Clear cooldown for a specific key (for testing or manual recovery)
   * @param {string} envVar - The environment variable name (e.g., 'GEMINI_API_KEY_1')
   */
  clearCooldown(envVar) {
    const keyInfo = this.keys.find(k => k.envVar === envVar);
    if (keyInfo) {
      keyInfo.cooldownUntil = null;
      console.log(`[GEMINI KEY MANAGER] Cooldown cleared for ${keyInfo.envVar}`);
    }
  }

  /**
   * Clear all cooldowns (for testing or reset)
   */
  clearAllCooldowns() {
    this.keys.forEach(keyInfo => {
      keyInfo.cooldownUntil = null;
    });
    console.log('[GEMINI KEY MANAGER] All cooldowns cleared');
  }

  /**
   * Get the number of configured keys
   * @returns {number} Number of keys
   */
  getKeyCount() {
    return this.keys.length;
  }

  /**
   * Get usage statistics for all keys
   * @returns {Array} Array of key stats (without actual key values)
   */
  getStats() {
    return this.keys.map((keyInfo, idx) => ({
      keyIndex: idx + 1,
      envVar: keyInfo.envVar,
      usageCount: keyInfo.usageCount,
      errorCount: keyInfo.errorCount,
      lastUsed: keyInfo.lastUsed
    }));
  }

  /**
   * Log current key statistics
   */
  logStats() {
    console.log('[GEMINI KEY MANAGER] === Key Statistics ===');
    this.keys.forEach((keyInfo, idx) => {
      console.log(`[GEMINI KEY MANAGER]   Key ${idx + 1} (${keyInfo.envVar}): ${keyInfo.usageCount} uses, ${keyInfo.errorCount} errors`);
    });
  }
}

// Export singleton instance
module.exports = new GeminiKeyManager();
