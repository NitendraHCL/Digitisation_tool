export interface HealthCheckRecord {
  _id: string;
  orderId: string;
  uhid: string;
  labProvider: string | null;
  orderDate: string | null;
  serviceDate: string | null;
  status: string | null;
  reportStatus: string | null;
  vendorType: 'Integrated' | 'Non-Integrated';
  syncStatus: boolean;
  timeDiffMs: number | null;
  cugName: string | null;
  cugCode: string | null;
  relativeCugCode: string | null;
  packageName: string | null;
  billingStatus: string | null;
  stage: string | null;
  relationship: string | null;
  smartReportDate: string | null;
  smartReportStatus: string | null;
  digitizationStatus: 'Uploaded' | 'Not Uploaded';
  digitizationReportStatus: string | null;
  lastSyncedAt: string | null;
}

export interface FunnelData {
  totalBooked: number;
  synced: number;
  notSynced: number;
  smartReportFromSynced: number;
  digitizedFromNotSynced: number;
  smartReportFromNotSynced: number;
  totalSmartReports: number;
  smartReportErrors: number;
}

export interface CugBreakdownItem {
  cugCode: string;
  totalOrders: number;
  synced: number;
  smartReports: number;
  digitized: number;
  smartReportErrors: number;
}

export interface HealthCheckStats {
  totalOrders: number;
  integratedCount: number;
  nonIntegratedCount: number;
  syncedCount: number;
  digitizedCount: number;
  statusBreakdown: { name: string; count: number }[];
  vendorDistribution: { name: string; count: number }[];
  cugDistribution: { name: string; count: number }[];
  relationshipBreakdown: { name: string; count: number }[];
  smartReportStats: { withSmartReport: number; withoutSmartReport: number };
  dailyTrend: { date: string; count: number }[];
  funnel: FunnelData;
  cugBreakdown: CugBreakdownItem[];
  smartReportErrorsByProvider: { provider: string; count: number }[];
  labProviderCompliance: { labProvider: string; totalOrders: number; synced: number; smartReports: number }[];
}

export interface HealthCheckFilters {
  search: string;
  cugCode: string;
  relativeCugCode: string;
  vendorType: string;
  syncStatus: string;
  labProvider: string;
  status: string;
  reportStatus: string;
  smartReportStatus: string;
  relationship: string;
  digitizationStatus: string;
  packageName: string;
  dateFrom: string;
  dateTo: string;
  timeDiffMin: string;
  timeDiffMax: string;
}

export interface HealthCheckFilterOptions {
  cugCodes: string[];
  relativeCugCodes: string[];
  labProviders: string[];
  statuses: string[];
  reportStatuses: string[];
  smartReportStatuses: string[];
  relationships: string[];
  vendorTypes: string[];
  digitizationStatuses: string[];
  packageNames: string[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}
