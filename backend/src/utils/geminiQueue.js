/**
 * Priority-Based Gemini Queue System
 *
 * Purpose:
 * - Single global queue with concurrency 8
 * - Page-1 calls get HIGH priority (jump ahead of bulk calls)
 * - Bulk page calls get NORMAL priority
 * - All 8 slots are shared - no idle capacity
 *
 * Why priority instead of dual queues?
 * - Dual queues left 2 slots idle after Page-1 completed
 * - Priority queue gives Page-1 preferential treatment while utilizing all slots
 * - When no Page-1 work is pending, bulk calls use all 8 slots
 *
 * CRITICAL RULE:
 * NO Gemini call is allowed outside this queue.
 * - Page 1 calls → geminiQueue.add(() => ..., { priority: PRIORITY.HIGH })
 * - Pages 2+ calls → geminiQueue.add(() => ..., { priority: PRIORITY.NORMAL })
 */

const PQueue = require('p-queue').default;

// Priority levels (higher number = higher priority in p-queue)
const PRIORITY = {
  HIGH: 10,    // Page-1 header and parameter extraction
  NORMAL: 0    // Pages 2+ extraction
};

// Load concurrency from environment (default 8)
const GEMINI_GLOBAL_CONCURRENCY = Number(process.env.GEMINI_CONCURRENCY) || 8;

// Create single global queue with priority support
const geminiQueue = new PQueue({
  concurrency: GEMINI_GLOBAL_CONCURRENCY,
  timeout: 120000, // 2 minute timeout per task
  throwOnTimeout: true
});

console.log(`[GEMINI QUEUE] Priority-based queue initialized:`);
console.log(`[GEMINI QUEUE]   Concurrency: ${GEMINI_GLOBAL_CONCURRENCY}`);
console.log(`[GEMINI QUEUE]   Page-1 priority: ${PRIORITY.HIGH} (HIGH)`);
console.log(`[GEMINI QUEUE]   Bulk priority: ${PRIORITY.NORMAL} (NORMAL)`);

// Track queue statistics
let highPriorityTasksProcessed = 0;
let highPriorityTasksFailed = 0;
let normalPriorityTasksProcessed = 0;
let normalPriorityTasksFailed = 0;

// Event listeners
geminiQueue.on('active', () => {
  const pending = geminiQueue.pending;
  const waiting = geminiQueue.size;
  if (pending > 0 || waiting > 0) {
    console.log(`[GEMINI QUEUE] Active: ${pending}/${GEMINI_GLOBAL_CONCURRENCY}, Waiting: ${waiting}`);
  }
});

geminiQueue.on('idle', () => {
  console.log(`[GEMINI QUEUE] Queue idle. High-priority: ${highPriorityTasksProcessed}, Normal: ${normalPriorityTasksProcessed}`);
});

geminiQueue.on('error', (error) => {
  console.error(`[GEMINI QUEUE] Task error:`, error.message);
});

/**
 * Add a task to the queue with specified priority
 * @param {Function} fn - The async function to execute
 * @param {Object} options - Options including priority
 * @returns {Promise} - Result of the function
 */
async function addToQueue(fn, options = {}) {
  const priority = options.priority !== undefined ? options.priority : PRIORITY.NORMAL;
  const isHighPriority = priority >= PRIORITY.HIGH;

  try {
    const result = await geminiQueue.add(fn, { priority });
    if (isHighPriority) {
      highPriorityTasksProcessed++;
    } else {
      normalPriorityTasksProcessed++;
    }
    return result;
  } catch (error) {
    if (isHighPriority) {
      highPriorityTasksFailed++;
    } else {
      normalPriorityTasksFailed++;
    }
    throw error;
  }
}

/**
 * Get current queue statistics
 * @returns {Object} Queue statistics
 */
function getQueueStats() {
  return {
    concurrency: GEMINI_GLOBAL_CONCURRENCY,
    pending: geminiQueue.pending,
    waiting: geminiQueue.size,
    highPriority: {
      processed: highPriorityTasksProcessed,
      failed: highPriorityTasksFailed
    },
    normalPriority: {
      processed: normalPriorityTasksProcessed,
      failed: normalPriorityTasksFailed
    },
    isPaused: geminiQueue.isPaused
  };
}

/**
 * Log current queue statistics
 */
function logQueueStats() {
  const stats = getQueueStats();
  console.log('[GEMINI QUEUE] === Queue Statistics ===');
  console.log(`[GEMINI QUEUE] Concurrency: ${stats.concurrency}, Running: ${stats.pending}, Waiting: ${stats.waiting}`);
  console.log(`[GEMINI QUEUE] High-priority processed: ${stats.highPriority.processed}, failed: ${stats.highPriority.failed}`);
  console.log(`[GEMINI QUEUE] Normal-priority processed: ${stats.normalPriority.processed}, failed: ${stats.normalPriority.failed}`);
}

module.exports = {
  geminiQueue,
  addToQueue,
  PRIORITY,
  GEMINI_GLOBAL_CONCURRENCY,
  getQueueStats,
  logQueueStats
};
