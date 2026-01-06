/**
 * Retry Helper Utility
 * Provides exponential backoff retry logic for async operations
 */

// Default retry configuration
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,      // 1 second
  maxDelayMs: 10000,      // 10 seconds max
  retryableErrors: [
    'RATE_LIMIT', 'TIMEOUT', 'NETWORK', 'ECONNRESET', 'ETIMEDOUT',
    'ECONNREFUSED', 'ENOTFOUND', '429', '503', '502', '504'
  ]
};

/**
 * Sleep for a given number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate backoff delay with exponential increase
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {number} baseDelayMs - Base delay in milliseconds
 * @param {number} maxDelayMs - Maximum delay cap
 * @returns {number} - Delay in milliseconds
 */
const calculateBackoff = (attempt, baseDelayMs = 1000, maxDelayMs = 10000) => {
  // Exponential backoff: baseDelay * 2^attempt with jitter
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  const delay = Math.min(exponentialDelay + jitter, maxDelayMs);
  return Math.round(delay);
};

/**
 * Check if an error is retryable based on error type/message
 * @param {Error} error - The error to check
 * @param {string[]} retryableErrors - List of retryable error patterns
 * @returns {boolean} - True if error is retryable
 */
const isRetryableError = (error, retryableErrors = DEFAULT_RETRY_CONFIG.retryableErrors) => {
  if (!error) return false;

  const errorString = String(error.message || error).toUpperCase();
  const errorCode = error.code ? String(error.code).toUpperCase() : '';
  const statusCode = error.status || error.statusCode || error.response?.status;

  // Check status codes
  if (statusCode) {
    const retryableStatusCodes = [429, 502, 503, 504];
    if (retryableStatusCodes.includes(Number(statusCode))) {
      return true;
    }
  }

  // Check error patterns
  for (const pattern of retryableErrors) {
    if (errorString.includes(pattern) || errorCode.includes(pattern)) {
      return true;
    }
  }

  // Check for specific API error types
  if (error.name === 'APIConnectionError' || error.name === 'APIConnectionTimeoutError') {
    return true;
  }

  // Check for rate limit in response
  if (error.response?.data?.error?.type === 'rate_limit_error') {
    return true;
  }

  // Gemini specific rate limit check
  if (errorString.includes('RESOURCE_EXHAUSTED') || errorString.includes('QUOTA')) {
    return true;
  }

  return false;
};

/**
 * Execute an async function with retry logic
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.baseDelayMs - Base delay between retries (default: 1000ms)
 * @param {number} options.maxDelayMs - Maximum delay cap (default: 10000ms)
 * @param {string[]} options.retryableErrors - List of retryable error patterns
 * @param {string} options.operationName - Name for logging purposes
 * @param {Function} options.onRetry - Callback called on each retry (attempt, error, delay)
 * @returns {Promise<any>} - Result of the function
 */
const withRetry = async (fn, options = {}) => {
  const config = {
    ...DEFAULT_RETRY_CONFIG,
    ...options
  };

  const { maxRetries, baseDelayMs, maxDelayMs, retryableErrors, operationName, onRetry } = config;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt >= maxRetries || !isRetryableError(error, retryableErrors)) {
        throw error;
      }

      // Calculate delay
      const delay = calculateBackoff(attempt, baseDelayMs, maxDelayMs);

      // Log retry attempt
      const opName = operationName || 'Operation';
      console.log(`[RETRY] ${opName} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
      console.log(`[RETRY] Error: ${error.message || error}`);

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, error, delay);
      }

      // Wait before retry
      await sleep(delay);
    }
  }

  // Should never reach here, but just in case
  throw lastError;
};

/**
 * Retry failed items from a batch operation
 * @param {Array} failedItems - Array of failed items with { item, error } structure
 * @param {Function} processFn - Async function to process each item
 * @param {Object} options - Retry options
 * @param {number} options.maxRetryRounds - Maximum retry rounds (default: 2)
 * @param {number} options.delayBetweenRounds - Delay between retry rounds in ms (default: 2000)
 * @param {number} options.concurrency - Max concurrent operations during retry (default: 5)
 * @returns {Promise<{successful: Array, failed: Array, retryStats: Object}>}
 */
const retryFailedItems = async (failedItems, processFn, options = {}) => {
  const {
    maxRetryRounds = 2,
    delayBetweenRounds = 2000,
    concurrency = 5,
    operationName = 'Batch retry'
  } = options;

  let currentFailed = [...failedItems];
  const allSuccessful = [];
  const retryStats = {
    totalRetries: 0,
    itemsRetried: [],
    rounds: []
  };

  for (let round = 1; round <= maxRetryRounds && currentFailed.length > 0; round++) {
    console.log(`[RETRY] ${operationName} - Round ${round}/${maxRetryRounds}: Retrying ${currentFailed.length} failed items...`);

    // Wait before retry round
    if (round > 1) {
      await sleep(delayBetweenRounds);
    }

    const roundResults = {
      round,
      attempted: currentFailed.length,
      succeeded: 0,
      failed: 0
    };

    // Process with limited concurrency using simple batching
    const newFailed = [];
    const batchSize = concurrency;

    for (let i = 0; i < currentFailed.length; i += batchSize) {
      const batch = currentFailed.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (failedItem) => {
          try {
            const result = await processFn(failedItem.item);
            retryStats.totalRetries++;
            retryStats.itemsRetried.push(failedItem.item);
            roundResults.succeeded++;
            return { success: true, item: failedItem.item, result };
          } catch (error) {
            roundResults.failed++;
            return { success: false, item: failedItem.item, error };
          }
        })
      );

      // Separate successful and failed
      batchResults.forEach(result => {
        if (result.success) {
          allSuccessful.push(result);
        } else {
          newFailed.push({ item: result.item, error: result.error });
        }
      });
    }

    retryStats.rounds.push(roundResults);
    currentFailed = newFailed;

    console.log(`[RETRY] ${operationName} - Round ${round} complete: ${roundResults.succeeded} succeeded, ${roundResults.failed} failed`);
  }

  return {
    successful: allSuccessful,
    failed: currentFailed,
    retryStats
  };
};

module.exports = {
  withRetry,
  retryFailedItems,
  isRetryableError,
  calculateBackoff,
  sleep,
  DEFAULT_RETRY_CONFIG
};
