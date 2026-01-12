// User types
export interface User {
  id: string;
  _id?: string; // MongoDB _id for populated documents
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'nurse';
  createdAt?: string;
  lastActive?: string;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: User;
  };
}

// Report types
export type ReportStatus = 'uploaded' | 'processing' | 'ready' | 'approved' | 'rejected' | 'error' | 'published';

export interface ValidationFlag {
  resultIndex: number;
  parameterId?: string | null;
  parameterName: string;
  field: 'parameterName' | 'unit' | 'value';
  flagType: 'PARAMETER_NOT_FOUND' | 'UNIT_MISMATCH' | 'VALUE_TYPE_MISMATCH' | 'PARAMETER_EXCLUDED' | 'UNIT_EXCLUDED';
  expected: any;
  actual: any;
  severity: 'info' | 'warning' | 'error';
  message: string;
  isExcluded?: boolean;
  exclusionReason?: string;
}

export interface ProcessingIssues {
  hasIncompleteProcessing: boolean;
  totalPages: number | null;
  processedPages: number | null;
  failedPages: number[];
  message: string | null;
}

export interface Report {
  _id: string;
  orderId: string;
  status: ReportStatus;
  uploadedBy: User;
  pdfPath: string;
  originalFileName: string;
  fileSize: number;
  uploadDate: string;
  processingTime?: number; // Processing time in seconds
  createdAt: string;
  updatedAt: string;
  extractedData?: ExtractedData;
  flags?: ReportFlags;
  uiIndicators?: UIIndicators;
  validationFlags?: ValidationFlag[]; // Validation flags from Parameter Master
  approvedBy?: User;
  approvedAt?: string;
  rejectedBy?: User;
  rejectedAt?: string;
  rejectionReason?: string;
  editHistory?: EditHistory[];
  processingMetadata?: ProcessingMetadata;
  finalData?: FinalData;
  auditSummary?: AuditSummary;
  processingIssues?: ProcessingIssues;
}

export interface AuditSummary {
  totalParameters: number;
  editedParameters: number;
  accuracyPercentage: number;
  calculatedAt: string;
  reviewDuration?: number;
  secondsPerParameter?: number;
}

export interface FinalData {
  meta: {
    USER_CODE: string;
    cug_code?: string;
    VISIT_CODE?: string;
    patient_age: string;
    gender: string;
    date_of_test: string;
    lab_name: string;
    location: string;
  };
  results: Array<{
    type: string;
    serviceItemName: string;
    value: string;
    method: string;
    unit: string;
    referenceRange: {
      high: number | null;
      low: number | null;
      referenceRange: string;
    };
  }>;
}

export interface ProcessingMetadata {
  method?: string;
  textExtractionTime?: number;
  imageConversionTime?: number;
  gptProcessingTime?: number;
  totalProcessingTime?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  pdfPages?: number;
  imagesGenerated?: number;
}

export interface PageWiseData {
  pageNumber: number;
  results: TestResult[];
}

export interface ExtractedData {
  labName: string;
  labAddress?: string;
  patientName?: string;
  patientGender?: string;
  dateOfTest?: string;
  results: TestResult[];
  pageWiseData?: PageWiseData[];
  columnOrder?: string[];
  extractedAt: string;
}

export interface TestResult {
  _id?: string;
  name?: string;
  type: string;
  serviceItemName: string;
  value: string;
  unit: string;
  method?: string;
  referenceRange: {
    high: number | null;
    low: number | null;
    referenceRange: string;
  };
  normalRange?: {
    min: number;
    max: number;
  };
  abnormalityCheck?: {
    isAbnormal: boolean;
    severity: 'normal' | 'mild' | 'moderate' | 'critical';
    percentDeviation: number;
    deviationFrom?: string;
    message: string;
  };
}

export interface TestParameter {
  _id?: string;
  name?: string;
  serviceItemName?: string;
  value: string;
  unit: string;
  referenceRange?: {
    high: number | null;
    low: number | null;
    referenceRange: string;
  };
  normalRange?: {
    min: number;
    max: number;
  };
}

export interface ReportFlags {
  hasAbnormalValues: boolean;
  abnormalCount: number;
  criticalCount: number;
  abnormalParameters: AbnormalParameter[];
  criticalParameters: AbnormalParameter[];
  percentAbnormal: number;
  requiresAttention: boolean;
  requiresUrgentAttention: boolean;
  summary: string;
}

export interface AbnormalParameter {
  parameter: string;
  value: string;
  unit: string;
  referenceRange: string;
  severity: string;
  deviation: number;
  message: string;
}

export interface UIIndicators {
  color: 'green' | 'yellow' | 'orange' | 'red';
  icon: string;
  badge: string;
  label?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface EditHistory {
  field: string;
  originalValue: any;
  newValue: any;
  editedBy: User;
  editedAt: string;
  reason?: string;
}

// Lab Configuration
export interface LabConfig {
  labNames: string[];
  thresholdPercentage: number;
  flagThreshold: number;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Dashboard types
export interface DashboardStats {
  overview: {
    totalReports: number;
    todayReports: number;
    weekReports: number;
    monthReports: number;
    approvalRate: number;
    flaggedRate: number;
  };
  status: {
    uploaded: number;
    processing: number;
    ready: number;
    approved: number;
    rejected: number;
    error: number;
  };
  flags: {
    flaggedReports: number;
    criticalReports: number;
    normalReports: number;
  };
  users: {
    total: number;
    admins: number;
    superAdmins: number;
    nurses: number;
  };
  processingTime: {
    avgTime: number;
    minTime: number;
    maxTime: number;
  };
  labDistribution: {
    name: string;
    count: number;
    percentage: number;
  }[];
}

export interface Activity {
  reportId: string;
  orderId: string;
  action: string;
  actor: {
    name: string;
    email: string;
  } | null;
  status: string;
  uiIndicators: UIIndicators;
  timestamp: string;
}

// API Response
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  error?: string;
}

// Audit Analytics types
export interface AuditOverallSummary {
  totalReports: number;
  avgAccuracy: number;
  totalEdits: number;
  reportsByAccuracy: Array<{
    range: string;
    count: number;
  }>;
}

export interface AuditReportEntry {
  reportId: string;
  orderId: string;
  labName: string;
  totalParameters: number;
  editedParameters: number;
  accuracyPercentage: number;
  reviewDuration?: number | null;
  secondsPerParameter?: number | null;
  reviewedBy: string;
  reviewedAt: string;
  status: string;
}

export interface AuditReportsResponse {
  reports: AuditReportEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AuditTrendEntry {
  date: string;
  avgAccuracy: number;
  reportCount: number;
}

export interface AuditParameterEntry {
  parameter: string;
  count: number;
}

// Suggestion Types
export type SuggestionStatus = 'pending' | 'approved' | 'rejected';

export interface ParameterSuggestion {
  _id: string;
  parameterName: string;
  suggestionType: 'new_parameter' | 'alias' | 'unit_conversion';
  suggestedValue?: string;
  suggestedUnit?: string;
  suggestedAlias?: string;
  reason?: string;
  suggestedBy: {
    _id: string;
    name: string;
    email: string;
  };
  status: SuggestionStatus;
  reviewNotes?: string;
  reviewedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExclusionSuggestion {
  _id: string;
  parameterName: string;
  exclusionType: 'parameter' | 'unit';
  unitName?: string;
  reason?: string;
  suggestedBy: {
    _id: string;
    name: string;
    email: string;
  };
  status: SuggestionStatus;
  reviewNotes?: string;
  reviewedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CombinedRequest {
  _id: string;
  type: 'parameter' | 'exclusion';
  parameterName: string;
  action: string;
  details: string;
  reason?: string;
  status: SuggestionStatus;
  reviewNotes?: string;
  reviewedBy?: {
    name: string;
  };
  reviewedAt?: string;
  createdAt: string;
}