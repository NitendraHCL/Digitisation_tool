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
    this.dbName = process.env.EXTERNAL_MONGODB_DB || 'dev_kxhims';

    // Write connection (for publishing to observation_non_digitized)
    this.writeClient = null;
    this.writeDb = null;
    this.writeUri = process.env.EXTERNAL_WRITE_MONGODB_URI;
    this.writeDbName = process.env.EXTERNAL_WRITE_MONGODB_DB || 'dev_kxhims';

    // Validate required environment variables
    if (!this.uri) {
      console.warn('[EXTERNAL DB] WARNING: EXTERNAL_MONGODB_URI not configured');
    }
    if (!this.writeUri) {
      console.warn('[EXTERNAL DB] WARNING: EXTERNAL_WRITE_MONGODB_URI not configured');
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
          serverSelectionTimeoutMS: 5000, // 5 second timeout
          connectTimeoutMS: 5000
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
   * @param {string} orderId - The order ID to search for
   * @returns {Promise<Object|null>} Observation document or null if not found
   */
  async getObservationByOrderId(orderId) {
    const db = await this.connect();
    console.log('[EXTERNAL DB] Querying observation for orderId:', orderId);
    const obs = await db.collection('observation').findOne(
      { orderId: orderId },
      { sort: { g_creation_time: 1 } }
    );
    console.log('[EXTERNAL DB] Query result:', obs ? 'Found' : 'Not found');
    return obs;
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
          serverSelectionTimeoutMS: 30000,  // Increased to 30 seconds
          connectTimeoutMS: 30000           // Increased to 30 seconds
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
