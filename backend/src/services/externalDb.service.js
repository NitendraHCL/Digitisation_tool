const { MongoClient } = require('mongodb');

/**
 * External Database Service
 * Connects to external MongoDB databases:
 * 1. READ: dev_kxhims.observation - for Order ID validation
 * 2. WRITE: dev_kxhims.observation_non_digitized - for publishing results
 */
class ExternalDbService {
  constructor() {
    // Read connection (for observation queries)
    this.client = null;
    this.db = null;
    this.uri = process.env.EXTERNAL_MONGODB_URI;
    this.dbName = process.env.EXTERNAL_MONGODB_DB || 'prod_kxhims';

    // Write connection (for publishing to observation_non_digitized)
    this.writeClient = null;
    this.writeDb = null;
    this.writeUri = process.env.EXTERNAL_WRITE_MONGODB_URI;
    this.writeDbName = process.env.EXTERNAL_WRITE_MONGODB_DB || 'prod_kxhims';

    // Validate required environment variables
    if (!this.uri) {
      console.warn('[EXTERNAL DB] WARNING: EXTERNAL_MONGODB_URI not set - external DB read operations will fail');
    }
    if (!this.writeUri) {
      console.warn('[EXTERNAL DB] WARNING: EXTERNAL_WRITE_MONGODB_URI not set - external DB write operations will fail');
    }
  }

  /**
   * Connect to external MongoDB
   * @returns {Promise<Db>} MongoDB database instance
   * @throws {Error} If connection fails
   */
  async connect() {
    if (!this.client) {
      console.log('[EXTERNAL DB] Connecting to', this.dbName, '...');
      try {
        this.client = new MongoClient(this.uri, {
          serverSelectionTimeoutMS: 30000, // 30 second timeout for server selection
          connectTimeoutMS: 30000,         // 30 second timeout for connection
          socketTimeoutMS: 600000,         // 10 min timeout for long aggregation pipelines
          maxIdleTimeMS: 300000,           // 5 min idle before closing
        });
        await this.client.connect();
        this.db = this.client.db(this.dbName);
        // Auto-reset on connection loss so next call reconnects
        this.client.on('close', () => {
          console.warn('[EXTERNAL DB] Connection closed, will reconnect on next call');
          this.client = null;
          this.db = null;
        });
        console.log('[EXTERNAL DB] Connected to', this.dbName);
      } catch (error) {
        console.error('[EXTERNAL DB] Connection failed:', error.message);
        this.client = null;
        this.db = null;
        throw new Error('DB connection failed');
      }
    }
    return this.db;
  }

  /**
   * Get observation by Order ID
   * Logic:
   * 1. If all documents have the same status → Pick the oldest (earliest g_creation_time)
   * 2. If multiple different statuses exist → Filter to status="Final", then pick oldest
   * @param {string} orderId - The order ID to search for
   * @returns {Promise<Object|null>} Observation document or null if not found
   */
  async getObservationByOrderId(orderId) {
    const db = await this.connect();
    console.log('[EXTERNAL DB] Querying observation for orderId:', orderId);

    // Get all documents for this orderId, sorted by g_creation_time ascending (oldest first)
    const allDocs = await db.collection('observation')
      .find({ orderId: orderId })
      .sort({ g_creation_time: 1 })
      .toArray();

    if (allDocs.length === 0) {
      console.log('[EXTERNAL DB] Query result: Not found');
      return null;
    }

    console.log('[EXTERNAL DB] Found', allDocs.length, 'documents for orderId:', orderId);

    // If only one document, return it
    if (allDocs.length === 1) {
      console.log('[EXTERNAL DB] Single document found, returning it');
      return allDocs[0];
    }

    // Check if all documents have the same status
    const statuses = [...new Set(allDocs.map(doc => doc.status))];
    console.log('[EXTERNAL DB] Unique statuses found:', statuses);

    if (statuses.length === 1) {
      // All documents have the same status - return the oldest
      console.log('[EXTERNAL DB] All documents have same status, returning oldest');
      return allDocs[0]; // Already sorted by g_creation_time ascending
    }

    // Multiple statuses exist - filter to "Final" status only
    const finalDocs = allDocs.filter(doc => doc.status === 'Final');
    console.log('[EXTERNAL DB] Multiple statuses found, filtering to "Final":', finalDocs.length, 'documents');

    if (finalDocs.length > 0) {
      // Return the oldest document with status "Final"
      console.log('[EXTERNAL DB] Returning oldest document with status "Final"');
      return finalDocs[0]; // Already sorted by g_creation_time ascending
    }

    // No "Final" status documents found - fall back to oldest overall
    console.log('[EXTERNAL DB] No "Final" status documents found, returning oldest overall');
    return allDocs[0];
  }

  /**
   * Connect to external MongoDB for write operations (observation_non_digitized)
   * @returns {Promise<Db>} MongoDB database instance for write operations
   * @throws {Error} If connection fails
   */
  async connectForWrite() {
    if (!this.writeClient) {
      console.log('[EXTERNAL DB] Connecting to write DB:', this.writeDbName, '...');
      try {
        this.writeClient = new MongoClient(this.writeUri, {
          serverSelectionTimeoutMS: 30000,  // 30 second timeout for server selection
          connectTimeoutMS: 30000,          // 30 second timeout for connection
          socketTimeoutMS: 45000            // 45 second timeout for socket operations
        });
        await this.writeClient.connect();
        this.writeDb = this.writeClient.db(this.writeDbName);
        console.log('[EXTERNAL DB] Connected to write DB:', this.writeDbName);
      } catch (error) {
        console.error('[EXTERNAL DB] Write connection failed:', error.message);
        this.writeClient = null;
        this.writeDb = null;
        throw new Error('DB connection failed');
      }
    }
    return this.writeDb;
  }

  /**
   * Insert documents to observation_non_digitized collection
   * @param {Array} documents - Array of documents to insert
   * @returns {Promise<Object>} Insert result with insertedCount
   */
  async insertToNonDigitized(documents) {
    const db = await this.connectForWrite();
    console.log('[EXTERNAL DB] Inserting', documents.length, 'documents to observation_non_digitized');
    const result = await db.collection('observation_non_digitized').insertMany(documents);
    console.log('[EXTERNAL DB] Inserted', result.insertedCount, 'documents');
    return result;
  }

  /**
   * Run the health check data fetch using application-level joins.
   * Uses separate queries instead of $lookup to avoid Atlas timeouts.
   * @returns {Promise<Array>} Joined records
   */
  async runHealthCheckAggregation(lastSyncAt = null) {
    const db = await this.connect();
    const { HEALTH_CHECK_PACKAGES } = require('../constants/healthCheckPackages');
    const { HEALTH_CHECK_CUG_CODES, SELF_ONLY_CUG_CODES } = require('../constants/healthCheckCugCodes');
    const { INTEGRATED_VENDORS_LOWERCASE } = require('../constants/integratedVendors');
    const healthCheckPkgSet = new Set(HEALTH_CHECK_PACKAGES);

    console.log('[EXTERNAL DB] Running health check data fetch...',
      lastSyncAt ? `incremental since ${lastSyncAt.toISOString()}` : 'full sync');

    const START_EPOCH = new Date('2026-03-01T00:00:00Z').getTime();
    const BATCH_SIZE = 500;

    // OPTIMIZED: Patient-first approach - get cug_code from patient collection
    // Step 1a: Fetch patients for TKNK001, RET001+relative TKNK001, and HCLHC001
    console.log('[EXTERNAL DB] Step 1a: Fetching patients for TKNK001/RET001/HCLHC001...');
    const cugPatients = await db.collection('patient').find(
      {
        $or: [
          { cug_code: 'TKNK001', uhId: { $ne: 'HH-184968' } },
          { cug_code: 'RET001', relative_cug_code: 'TKNK001' },
          { cug_code: 'HCLHC001' },
          { cug_code: 'HCLT001' },
        ]
      },
      { projection: { uhId: 1, cug_code: 1, relative_cug_code: 1 } }
    ).maxTimeMS(120000).toArray();
    const patientCugMap = new Map(); // uhId -> { cug_code, relative_cug_code }
    const cugUhIds = [];
    for (const p of cugPatients) {
      if (p.uhId) {
        patientCugMap.set(p.uhId, { cug_code: p.cug_code, relative_cug_code: p.relative_cug_code || null });
        cugUhIds.push(p.uhId);
      }
    }
    // Per-CUG date filters (order_date_time >= epoch). No entry = no date filter.
    const CUG_DATE_FILTERS = {
      'HCLHC001': new Date('2025-10-01T00:00:00Z').getTime(),
      'HCLT001': new Date('2026-03-01T00:00:00Z').getTime(),
    };
    const dateFilteredCugs = new Set(Object.keys(CUG_DATE_FILTERS));

    const cugCounts = {};
    for (const p of cugPatients) { cugCounts[p.cug_code] = (cugCounts[p.cug_code] || 0) + 1; }
    console.log('[EXTERNAL DB] Step 1a: Found', cugUhIds.length, 'patients', JSON.stringify(cugCounts));

    // Step 1b: Fetch billing items - split by date-filtered vs non-date-filtered CUGs
    const dateFilteredUhIds = new Map(); // uhId -> cug_code (for CUGs with date filter)
    const noDateFilterUhIds = [];
    for (const p of cugPatients) {
      if (p.uhId && dateFilteredCugs.has(p.cug_code)) {
        dateFilteredUhIds.set(p.uhId, p.cug_code);
      } else if (p.uhId) {
        noDateFilterUhIds.push(p.uhId);
      }
    }

    console.log('[EXTERNAL DB] Step 1b: Fetching billing items for', noDateFilterUhIds.length, 'no-date-filter uhIds +', dateFilteredUhIds.size, 'date-filtered uhIds...');
    let allBillingItems = [];

    // Fetch billing items without date filter (TKNK001/RET001)
    for (let i = 0; i < noDateFilterUhIds.length; i += BATCH_SIZE) {
      const batch = noDateFilterUhIds.slice(i, i + BATCH_SIZE);
      const batchBilling = await db.collection('billing_item').find(
        {
          uhId: { $in: batch },
          serviceType_code: 'phc',
          department: 'Health Checkup',
          status: { $not: /^cancell?ed$/i },
        },
        { projection: { orderId: 1, uhId: 1, serviceName: 1, status: 1, stage: 1 } }
      ).maxTimeMS(120000).toArray();
      allBillingItems.push(...batchBilling);
    }
    const noDateCount = allBillingItems.length;

    // Fetch billing items with date filter, grouped by cutoff date
    const uhIdsByCutoff = new Map(); // cutoffEpoch -> [uhIds]
    for (const [uhId, cugCode] of dateFilteredUhIds) {
      const cutoff = CUG_DATE_FILTERS[cugCode];
      if (!uhIdsByCutoff.has(cutoff)) uhIdsByCutoff.set(cutoff, []);
      uhIdsByCutoff.get(cutoff).push(uhId);
    }

    for (const [cutoffEpoch, uhIds] of uhIdsByCutoff) {
      for (let i = 0; i < uhIds.length; i += BATCH_SIZE) {
        const batch = uhIds.slice(i, i + BATCH_SIZE);
        const batchBilling = await db.collection('billing_item').find(
          {
            uhId: { $in: batch },
            serviceType_code: 'phc',
            department: 'Health Checkup',
            status: { $not: /^cancell?ed$/i },
            order_date_time: { $gte: cutoffEpoch },
          },
          { projection: { orderId: 1, uhId: 1, serviceName: 1, status: 1, stage: 1 } }
        ).maxTimeMS(120000).toArray();
        allBillingItems.push(...batchBilling);
      }
    }
    console.log('[EXTERNAL DB] Step 1b done:', allBillingItems.length, 'billing items (no-date:', noDateCount, '| date-filtered:', allBillingItems.length - noDateCount, ')');

    // Filter by health check package names
    const billingMap = new Map();
    for (const b of allBillingItems) {
      if (healthCheckPkgSet.has(b.serviceName)) {
        billingMap.set(b.orderId, b);
      }
    }
    const billingOrderIds = [...billingMap.keys()];
    console.log('[EXTERNAL DB] Step 1 total:', allBillingItems.length, 'billing items,', billingMap.size, 'matched HC packages');

    // Step 2: Fetch observations ONLY for matched orderIds (much smaller set)
    console.log('[EXTERNAL DB] Step 2: Fetching observations for', billingOrderIds.length, 'orderIds...');
    const observations = [];
    for (let i = 0; i < billingOrderIds.length; i += BATCH_SIZE) {
      const batch = billingOrderIds.slice(i, i + BATCH_SIZE);
      const obsFilter = {
        orderId: { $in: batch },
        part_of_package: true,
        serviceType_code: 'pathology',
        status: { $not: /^cancell?ed$/i },
      };
      // TODO: Re-enable incremental sync later
      // if (lastSyncAt) {
      //   obsFilter.g_modified_time = { $gte: lastSyncAt };
      // }
      const batchObs = await db.collection('observation').find(obsFilter, {
        projection: {
          orderId: 1, orderDateTime: 1, outSourceCentre: 1, status: 1,
          reportStatus: 1, g_modified_by_name: 1, g_modified_by_role: 1, g_modified_time: 1, g_creation_time: 1,
          g_creation_time: 1
        }
      }).maxTimeMS(120000).toArray();
      observations.push(...batchObs);
    }
    console.log('[EXTERNAL DB] Step 2 done:', observations.length, 'observations');

    // Step 3: Build sync status per orderId (ANY obs with Integrator + Final = synced)
    // Also deduplicate by orderId (prefer Final status, then latest modification)
    const INTEGRATOR_ROLES = ['Integrator Admin', 'Integrator Facility Admin'];
    const syncStatusMap = new Map(); // orderId -> { isSynced, g_modified_by_name }
    for (const obs of observations) {
      if (obs.status === 'Final' &&
          (INTEGRATOR_ROLES.includes(obs.g_modified_by_name) || INTEGRATOR_ROLES.includes(obs.g_modified_by_role))) {
        syncStatusMap.set(obs.orderId, {
          isSynced: true,
          g_modified_by_name: obs.g_modified_by_name || obs.g_modified_by_role,
        });
      }
    }

    // Dedup: Final status → earliest g_creation_time; Non-final → latest g_creation_time
    const dedupMap = new Map();
    for (const obs of observations) {
      const existing = dedupMap.get(obs.orderId);
      if (!existing) {
        dedupMap.set(obs.orderId, obs);
        continue;
      }
      const newIsFinal = obs.status === 'Final';
      const existIsFinal = existing.status === 'Final';
      // Final always wins over non-final
      if (newIsFinal && !existIsFinal) {
        dedupMap.set(obs.orderId, obs);
      } else if (newIsFinal && existIsFinal) {
        // Both Final → pick earliest created
        if ((obs.g_creation_time || Infinity) < (existing.g_creation_time || Infinity)) {
          dedupMap.set(obs.orderId, obs);
        }
      } else if (!newIsFinal && !existIsFinal) {
        // Both non-final → pick latest created
        if ((obs.g_creation_time || 0) > (existing.g_creation_time || 0)) {
          dedupMap.set(obs.orderId, obs);
        }
      }
      // else: existing is Final, new is not → keep existing
    }
    const uniqueObs = [...dedupMap.values()];
    const orderIds = uniqueObs.map(o => o.orderId);
    console.log('[EXTERNAL DB] Step 3: Deduped to', uniqueObs.length, 'unique orderIds');

    // Step 4: Fetch patient data for matched UHIDs
    const uhids = [...new Set([...billingMap.values()].map(b => b.uhId).filter(Boolean))];
    console.log('[EXTERNAL DB] Step 4: Fetching patient data for', uhids.length, 'UHIDs...');
    const patientMap = new Map();
    for (let i = 0; i < uhids.length; i += BATCH_SIZE) {
      const batch = uhids.slice(i, i + BATCH_SIZE);
      const patients = await db.collection('patient').find(
        { uhId: { $in: batch } },
        { projection: { uhId: 1, cug_code: 1, 'employerDetails.relationship_name': 1 } }
      ).toArray();
      for (const p of patients) {
        patientMap.set(p.uhId, p);
      }
    }
    console.log('[EXTERNAL DB] Step 4 done:', patientMap.size, 'patients');

    // Step 5: Join and filter in application code
    console.log('[EXTERNAL DB] Step 5: Joining data...');
    const selfOnlySet = new Set(SELF_ONLY_CUG_CODES);
    const integratedKeywords = INTEGRATED_VENDORS_LOWERCASE;
    const isIntegrated = (name) => {
      if (!name) return false;
      const lower = name.toLowerCase();
      return integratedKeywords.some(kw => lower.includes(kw));
    };
    const results = [];

    for (const obs of uniqueObs) {
      const billing = billingMap.get(obs.orderId);
      if (!billing) continue; // No matching billing = not a health check order

      const patient = patientMap.get(billing.uhId);
      const relationship = patient?.employerDetails?.relationship_name || null;

      // Get cug_code and relative_cug_code from patient collection (source of truth)
      const patientCug = patientCugMap.get(billing.uhId) || {};
      const cugCode = patientCug.cug_code || patient?.cug_code || null;
      const relativeCugCode = patientCug.relative_cug_code || null;

      // Relationship filter: HCLT001/HCLHC001 must be Self
      // Skip filter if patient not found (dev DB may have mismatched uhIds)
      if (selfOnlySet.has(cugCode) && patient) {
        if (relationship && relationship.toLowerCase() !== 'self') continue;
      }

      const labProvider = obs.outSourceCentre || null;
      const syncInfo = syncStatusMap.get(obs.orderId);
      const isSynced = !!syncInfo?.isSynced;

      // DEBUG: Log sync status evaluation for first 10 records
      if (results.length < 10) {
        console.log(`[HC SYNC DEBUG] orderId=${obs.orderId} | status="${obs.status}" | g_modified_by_name="${obs.g_modified_by_name}" | g_modified_by_role="${obs.g_modified_by_role}" | isSynced=${isSynced}`);
      }

      results.push({
        orderId: obs.orderId,
        uhid: billing.uhId,
        LabProvider: labProvider,
        VendorType: isIntegrated(labProvider) ? 'Integrated' : 'Non-Integrated',
        OrderDate: obs.orderDateTime ? new Date(obs.orderDateTime) : null,
        service_date: obs.orderDateTime ? new Date(obs.orderDateTime) : null,
        status: obs.status,
        reportStatus: obs.reportStatus || null,
        SyncStatus: isSynced,
        BillingStatus: billing.status,
        stage: billing.stage,
        serviceName: billing.serviceName,
        cug_code: cugCode,
        relative_cug_code: relativeCugCode,
        relationship,
        g_modified_time: obs.g_modified_time,
        g_modified_by_name: syncInfo?.g_modified_by_name || obs.g_modified_by_name || null,
      });
    }

    console.log('[EXTERNAL DB] Health check fetch returned', results.length, 'records');
    return results;
  }

  /**
   * Get latest smart report info by UHIDs from dev_smart_report DB
   * @param {string[]} uhids - Array of UHIDs to look up
   * @returns {Promise<Map<string, {date, status}>>} Map of uhid -> { date, status: 'Success'|'Error' }
   */
  /**
   * Fetch all smart reports for given UHIDs, sorted by creation time desc.
   * Returns Map<uhid, Array<{ date, status }>> so caller can filter by order date.
   */
  async getSmartReportsByUhids(uhids) {
    if (!uhids || uhids.length === 0) return new Map();

    const db = await this.connect();
    const smartReportDbName = process.env.SMART_REPORT_DB || 'prod_smart_report';
    const smartDb = this.client.db(smartReportDbName);

    console.log('[EXTERNAL DB] Fetching smart reports for', uhids.length, 'UHIDs from', smartReportDbName);

    const BATCH_SIZE = 500;
    const resultMap = new Map(); // uhid -> [{ date, status }, ...] sorted newest first

    for (let i = 0; i < uhids.length; i += BATCH_SIZE) {
      const batch = uhids.slice(i, i + BATCH_SIZE);
      const results = await smartDb.collection('smart_report_details').find(
        { uhid: { $in: batch } },
        { projection: { uhid: 1, g_creation_time: 1, data: 1 } }
      ).sort({ g_creation_time: -1 }).toArray();

      for (const r of results) {
        const hasValidData = r.data && typeof r.data === 'object'
          && r.data.empty !== true && Object.keys(r.data).length > 0;
        const entry = {
          date: r.g_creation_time,
          status: hasValidData ? 'Success' : 'Error',
        };
        if (!resultMap.has(r.uhid)) {
          resultMap.set(r.uhid, []);
        }
        resultMap.get(r.uhid).push(entry);
      }
    }

    console.log('[EXTERNAL DB] Found smart reports for', resultMap.size, 'UHIDs');
    return resultMap;
  }

  /**
   * Get digitization status by order IDs from lab-digitization DB (prod).
   * @param {string[]} orderIds - Array of order IDs to look up
   * @returns {Promise<Map<string, string>>} Map of orderId -> status
   */
  async getDigitizationStatusByOrderIds(orderIds) {
    if (!orderIds || orderIds.length === 0) return new Map();

    const db = await this.connect();
    const digitizationDbName = process.env.DIGITIZATION_DB || 'lab-digitization';
    const digDb = this.client.db(digitizationDbName);

    console.log('[EXTERNAL DB] Fetching digitization status for', orderIds.length, 'orderIds from', digitizationDbName);

    const BATCH_SIZE = 500;
    const resultMap = new Map(); // orderId -> status

    for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
      const batch = orderIds.slice(i, i + BATCH_SIZE);
      const results = await digDb.collection('reports').find(
        { orderId: { $in: batch } },
        { projection: { orderId: 1, status: 1 } }
      ).toArray();

      for (const r of results) {
        resultMap.set(r.orderId, r.status);
      }
    }

    console.log('[EXTERNAL DB] Found digitization status for', resultMap.size, 'orderIds');
    return resultMap;
  }

  /**
   * Close the connection
   */
  async close() {
    if (this.client) {
      console.log('[EXTERNAL DB] Closing read connection...');
      await this.client.close();
      this.client = null;
      this.db = null;
    }
    if (this.writeClient) {
      console.log('[EXTERNAL DB] Closing write connection...');
      await this.writeClient.close();
      this.writeClient = null;
      this.writeDb = null;
    }
  }
}

module.exports = new ExternalDbService();
