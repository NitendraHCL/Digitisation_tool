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
          socketTimeoutMS: 45000           // 45 second timeout for socket operations
        });
        await this.client.connect();
        this.db = this.client.db(this.dbName);
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
