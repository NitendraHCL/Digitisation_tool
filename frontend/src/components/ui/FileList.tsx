import React from 'react';
import { theme } from '../../styles/theme';
import Badge from './Badge';

interface FileItem {
  name: string;
  size: number;
  status?: 'uploaded' | 'processing' | 'completed' | 'error';
  error?: string;
  processingTime?: number;
}

interface FileListProps {
  files: FileItem[];
  onRemove?: (index: number) => void;
  showStatus?: boolean;
}

const FileList: React.FC<FileListProps> = ({ files, onRemove, showStatus = false }) => {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusBadgeVariant = (status?: string): 'success' | 'warning' | 'error' | 'default' | 'info' => {
    const statusMap: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
      uploaded: 'default',
      processing: 'info',
      completed: 'success',
      error: 'error',
    };
    return statusMap[status || ''] || 'default';
  };

  const getStatusIcon = (status?: string): string => {
    const iconMap: Record<string, string> = {
      uploaded: '⏸️',
      processing: '⏳',
      completed: '✓',
      error: '✕',
    };
    return iconMap[status || ''] || '';
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing.sm,
        fontFamily: theme.typography.fontFamily,
      }}
    >
      {files.map((file, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: theme.spacing.sm,
            backgroundColor:
              file.status === 'processing'
                ? theme.colors.accentLight
                : theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            transition: theme.transitions.fast,
          }}
        >
          {/* File Info */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.sm,
              flex: 1,
              minWidth: 0,
            }}
          >
            {/* File Icon */}
            <div
              style={{
                fontSize: '24px',
                flexShrink: 0,
              }}
            >
              📄
            </div>

            {/* File Details */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontSize: theme.typography.sizes.small,
                  fontWeight: theme.typography.weights.medium,
                  color: theme.colors.textPrimary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginBottom: '2px',
                }}
              >
                {file.name}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs }}>
                <span
                  style={{
                    fontSize: theme.typography.sizes.tiny,
                    color: theme.colors.textSecondary,
                  }}
                >
                  {formatBytes(file.size)}
                </span>

                {showStatus && file.status && (
                  <>
                    <span style={{ color: theme.colors.border }}>•</span>
                    {file.status === 'completed' && file.processingTime && (
                      <span
                        style={{
                          fontSize: theme.typography.sizes.tiny,
                          color: theme.colors.success,
                        }}
                      >
                        Completed in {file.processingTime.toFixed(2)}s
                      </span>
                    )}
                    {file.status === 'error' && file.error && (
                      <span
                        style={{
                          fontSize: theme.typography.sizes.tiny,
                          color: theme.colors.error,
                        }}
                      >
                        {file.error}
                      </span>
                    )}
                    {file.status === 'processing' && (
                      <span
                        style={{
                          fontSize: theme.typography.sizes.tiny,
                          color: theme.colors.accent,
                        }}
                      >
                        Processing...
                      </span>
                    )}
                    {file.status === 'uploaded' && (
                      <span
                        style={{
                          fontSize: theme.typography.sizes.tiny,
                          color: theme.colors.textSecondary,
                        }}
                      >
                        Waiting...
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Status Badge or Remove Button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.xs,
              flexShrink: 0,
            }}
          >
            {showStatus && file.status && (
              <Badge
                label={file.status.toUpperCase()}
                variant={getStatusBadgeVariant(file.status)}
                size="small"
              />
            )}

            {onRemove && !showStatus && (
              <button
                onClick={() => onRemove(index)}
                style={{
                  padding: '6px 10px',
                  fontSize: theme.typography.sizes.tiny,
                  fontWeight: theme.typography.weights.medium,
                  fontFamily: theme.typography.fontFamily,
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.error,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.sm,
                  cursor: 'pointer',
                  transition: theme.transitions.fast,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = theme.colors.error;
                  e.currentTarget.style.backgroundColor = '#FEE2E2';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = theme.colors.border;
                  e.currentTarget.style.backgroundColor = theme.colors.surface;
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default FileList;
