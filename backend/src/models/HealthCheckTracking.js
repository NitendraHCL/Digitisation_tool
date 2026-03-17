const mongoose = require('mongoose');

const healthCheckTrackingSchema = new mongoose.Schema({
  orderId: { type: String, unique: true, required: true },
  uhid: { type: String, index: true },
  labProvider: { type: String, index: true },
  orderDate: { type: Date, index: true },
  serviceDate: { type: Date },
  status: { type: String, index: true },
  reportStatus: { type: String },
  vendorType: { type: String, index: true },
  syncStatus: { type: Boolean, index: true },
  timeDiffMs: { type: Number },
  cugName: { type: String, index: true },
  cugCode: { type: String, index: true },
  relativeCugCode: { type: String },
  packageName: { type: String },
  billingStatus: { type: String, index: true },
  stage: { type: String },
  relationship: { type: String },
  smartReportDate: { type: Date },
  smartReportStatus: { type: String },
  digitizationStatus: { type: String, default: 'Not Uploaded' },
  digitizationReportStatus: { type: String },
  gModifiedByName: { type: String },
  gModifiedTime: { type: Date },
  lastSyncedAt: { type: Date },
}, {
  timestamps: true,
  collection: 'health_check_tracking',
});

healthCheckTrackingSchema.index({ orderDate: -1 });

module.exports = mongoose.model('HealthCheckTracking', healthCheckTrackingSchema);
