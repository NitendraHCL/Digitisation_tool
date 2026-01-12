import React from 'react';
import { useDropzone } from 'react-dropzone';
import { theme } from '../../styles/theme';

interface DropZoneProps {
  onDrop: (files: File[]) => void;
  accept?: Record<string, string[]>;
  multiple?: boolean;
  maxSize?: number;
  maxFiles?: number;
  disabled?: boolean;
}

const DropZone: React.FC<DropZoneProps> = ({
  onDrop,
  accept = { 'application/pdf': ['.pdf'] },
  multiple = true,
  maxSize = 30 * 1024 * 1024, // 30MB default
  maxFiles,
  disabled = false,
}) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple,
    maxSize,
    disabled,
  });

  return (
    <div
      {...getRootProps()}
      style={{
        border: `2px dashed ${
          isDragActive ? theme.colors.accent : theme.colors.border
        }`,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.xl,
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: isDragActive
          ? theme.colors.accentLight
          : disabled
          ? theme.colors.background
          : theme.colors.surface,
        transition: theme.transitions.fast,
        fontFamily: theme.typography.fontFamily,
        opacity: disabled ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isDragActive) {
          e.currentTarget.style.borderColor = theme.colors.accent;
          e.currentTarget.style.backgroundColor = theme.colors.accentLight;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !isDragActive) {
          e.currentTarget.style.borderColor = theme.colors.border;
          e.currentTarget.style.backgroundColor = theme.colors.surface;
        }
      }}
    >
      <input {...getInputProps()} />

      {/* Upload Icon */}
      <div
        style={{
          fontSize: '48px',
          marginBottom: theme.spacing.sm,
        }}
      >
        📤
      </div>

      {/* Main Text */}
      <div
        style={{
          fontSize: theme.typography.sizes.subheading,
          fontWeight: theme.typography.weights.semibold,
          color: theme.colors.textPrimary,
          marginBottom: theme.spacing.xs,
        }}
      >
        {isDragActive
          ? 'Drop the files here...'
          : 'Drag & drop PDF files here, or click to select'}
      </div>

      {/* Helper Text */}
      <div
        style={{
          fontSize: theme.typography.sizes.small,
          color: theme.colors.textSecondary,
          lineHeight: theme.typography.lineHeights.normal,
        }}
      >
        Maximum file size: {Math.round(maxSize / (1024 * 1024))}MB per file •{' '}
        {multiple
          ? maxFiles
            ? `Up to ${maxFiles} files allowed`
            : 'Multiple files allowed'
          : 'Single file only'}
      </div>
    </div>
  );
};

export default DropZone;
