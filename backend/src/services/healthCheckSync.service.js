const externalDbService = require('./externalDb.service');
const HealthCheckTracking = require('../models/HealthCheckTracking');


class HealthCheckSyncService {
  constructor() {
    this.isSyncing = false;
    this.lastSyncAt = null;
    this.lastSyncCount = 0;
  }

  /**
   * Get lastSyncAt from DB (persisted, survives server restarts)
   */
  async getLastSyncTime() {
    if (this.lastSyncAt) return this.lastSyncAt;
    // Fall back to max lastSyncedAt from the collection
    const latest = await HealthCheckTracking.findOne({}, { lastSyncedAt: 1 })
      .sort({ lastSyncedAt: -1 }).lean();
    return latest?.lastSyncedAt || null;
  }

  async sync() {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      // Determine if incremental or full sync
      const lastSyncAt = await this.getLastSyncTime();
      console.log('[HC SYNC] Starting sync...', lastSyncAt ? `incremental since ${lastSyncAt.toISOString()}` : 'full sync');

      // Stage A: Main aggregation (incremental if lastSyncAt exists)
      console.log('[HC SYNC] Stage A: Running main aggregation pipeline...');
      const records = await externalDbService.runHealthCheckAggregation(lastSyncAt);
      console.log('[HC SYNC] Stage A complete:', records.length, 'records');

      if (records.length === 0) {
        console.log('[HC SYNC] No new/modified records to sync');
        const now = new Date();
        this.lastSyncAt = now;
        this.lastSyncCount = 0;
        this.isSyncing = false;
        return { synced: 0, skipped: 0, duration: Date.now() - startTime };
      }

      // Stage B: Smart report lookup (separate DB)
      console.log('[HC SYNC] Stage B: Fetching smart report data...');
      const uhids = [...new Set(records.map(r => r.uhid).filter(Boolean))];
      const smartReportMap = await externalDbService.getSmartReportsByUhids(uhids);
      console.log('[HC SYNC] Stage B complete: smart reports for', smartReportMap.size, 'UHIDs');

      // Stage C: Digitization status from prod DB (lab-digitization)
      console.log('[HC SYNC] Stage C: Fetching digitization status from prod DB...');
      const orderIds = records.map(r => r.orderId).filter(Boolean);
      const digitizationMap = await externalDbService.getDigitizationStatusByOrderIds(orderIds);
      console.log('[HC SYNC] Stage C complete:', digitizationMap.size, 'digitized orders');

      // Stage D: Smart upsert — skip if g_modified_time hasn't changed
      console.log('[HC SYNC] Stage D: Comparing and upserting...');

      // Fetch existing records for these orderIds to compare g_modified_time
      const existingRecords = await HealthCheckTracking.find(
        { orderId: { $in: orderIds } },
        { orderId: 1, gModifiedTime: 1 }
      ).lean();
      const existingMap = new Map();
      for (const e of existingRecords) {
        existingMap.set(e.orderId, e.gModifiedTime);
      }

      // Pre-compute smart report per record: latest SR where SR date >= order date
      for (const rec of records) {
        const srList = smartReportMap.get(rec.uhid) || [];
        const orderEpoch = rec.OrderDate ? new Date(rec.OrderDate).getTime() : 0;
        // srList is sorted newest first; find the latest SR generated >= order date
        const matchingSR = srList.find(sr => {
          const srEpoch = typeof sr.date === 'number' ? sr.date : new Date(sr.date).getTime();
          return srEpoch >= orderEpoch;
        });
        rec._smartReport = matchingSR || null;
      }

      const srMatched = records.filter(r => r._smartReport).length;
      console.log('[HC SYNC] Smart report matching: ', srMatched, 'records matched (SR date >= order date)');

      const now = new Date();
      const bulkOps = [];
      let skipped = 0;

      for (const rec of records) {
        const incomingModTime = rec.g_modified_time ? new Date(rec.g_modified_time) : null;
        const existingModTime = existingMap.get(rec.orderId);

        // If record exists and g_modified_time is the same, skip update
        if (existingModTime && incomingModTime &&
            existingModTime.getTime() === incomingModTime.getTime()) {
          skipped++;
          continue;
        }

        const serviceDate = rec.service_date ? new Date(rec.service_date) : null;
        const digStatus = digitizationMap.has(rec.orderId) ? 'Uploaded' : 'Not Uploaded';
        const digReportStatus = digitizationMap.get(rec.orderId) || null;

        bulkOps.push({
          updateOne: {
            filter: { orderId: rec.orderId },
            update: {
              $set: {
                orderId: rec.orderId,
                uhid: rec.uhid,
                labProvider: rec.LabProvider || null,
                orderDate: rec.OrderDate ? new Date(rec.OrderDate) : null,
                serviceDate,
                status: rec.status || null,
                reportStatus: rec.reportStatus || null,
                vendorType: rec.VendorType,
                syncStatus: rec.SyncStatus,
                timeDiffMs: serviceDate ? (Date.now() - serviceDate.getTime()) : null,
                cugCode: rec.cug_code,
                relativeCugCode: rec.relative_cug_code || null,
                packageName: rec.serviceName,
                billingStatus: rec.BillingStatus,
                stage: rec.stage,
                relationship: rec.relationship || null,
                smartReportDate: rec._smartReport?.date || null,
                smartReportStatus: rec._smartReport?.status || null,
                digitizationStatus: digStatus,
                digitizationReportStatus: digReportStatus,
                gModifiedByName: rec.g_modified_by_name || null,
                gModifiedTime: incomingModTime,
                lastSyncedAt: now,
              }
            },
            upsert: true
          }
        });
      }

      let totalModified = 0;
      let totalUpserted = 0;

      if (bulkOps.length > 0) {
        const BATCH = 1000;
        for (let i = 0; i < bulkOps.length; i += BATCH) {
          const batch = bulkOps.slice(i, i + BATCH);
          const result = await HealthCheckTracking.bulkWrite(batch, { ordered: false });
          totalModified += result.modifiedCount || 0;
          totalUpserted += result.upsertedCount || 0;
        }
      }

      const duration = Date.now() - startTime;
      this.lastSyncAt = now;
      this.lastSyncCount = records.length;

      console.log(`[HC SYNC] Complete: ${totalModified} modified, ${totalUpserted} new, ${skipped} skipped (unchanged) in ${duration}ms`);
      return {
        synced: bulkOps.length,
        modified: totalModified,
        upserted: totalUpserted,
        skipped,
        fetched: records.length,
        duration
      };
    } catch (error) {
      console.error('[HC SYNC] Sync failed:', error.message);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncAt: this.lastSyncAt,
      lastSyncCount: this.lastSyncCount,
    };
  }
}

module.exports = new HealthCheckSyncService();
