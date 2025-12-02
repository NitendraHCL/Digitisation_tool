import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { Warning as WarningIcon, Error as ErrorIcon, Info as InfoIcon } from '@mui/icons-material';

interface ValidationFlagProps {
  flag?: {
    field: string;
    flagType: string;
    expected: any;
    actual: any;
    severity: 'info' | 'warning' | 'error';
    message: string;
    isExcluded?: boolean;
    exclusionReason?: string;
  } | null;
  children: React.ReactNode;
  fieldName?: string;
}

const ValidationFlag: React.FC<ValidationFlagProps> = ({ flag, children, fieldName }) => {
  if (!flag) {
    // No flag - render children normally
    return <>{children}</>;
  }

  // Determine color based on severity
  const borderColor = flag.severity === 'error' ? '#f44336' : flag.severity === 'warning' ? '#ff9800' : '#3b82f6';
  const iconColor = flag.severity === 'error' ? 'error' : flag.severity === 'warning' ? 'warning' : 'info';
  const Icon = flag.severity === 'error' ? ErrorIcon : flag.severity === 'warning' ? WarningIcon : InfoIcon;

  // Build tooltip content
  const getTooltipContent = () => {
    let expected = flag.expected;
    if (Array.isArray(expected)) {
      expected = expected.join(', ');
    } else if (typeof expected === 'object') {
      expected = JSON.stringify(expected);
    }

    return (
      <Box sx={{ p: 0.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          {flag.flagType.replace(/_/g, ' ')}
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          {flag.message}
        </Typography>
        {/* Hide Expected/Found for PARAMETER_NOT_FOUND - message is self-explanatory */}
        {flag.flagType !== 'PARAMETER_NOT_FOUND' && (
          <>
            {flag.expected && (
              <Typography variant="caption" display="block">
                <strong>Expected:</strong> {expected}
              </Typography>
            )}
            <Typography variant="caption" display="block">
              <strong>Found:</strong> {flag.actual}
            </Typography>
          </>
        )}
      </Box>
    );
  };

  return (
    <Tooltip
      title={getTooltipContent()}
      arrow
      placement="top"
      componentsProps={{
        tooltip: {
          sx: {
            bgcolor: 'background.paper',
            color: 'text.primary',
            boxShadow: 3,
            border: '1px solid',
            borderColor: borderColor,
            maxWidth: 400,
          },
        },
        arrow: {
          sx: {
            color: 'background.paper',
            '&::before': {
              border: '1px solid',
              borderColor: borderColor,
            },
          },
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          border: '2px solid',
          borderColor: borderColor,
          borderRadius: 1,
          p: 0.5,
          bgcolor: flag.severity === 'error' ? 'rgba(244, 67, 54, 0.05)' :
                   flag.severity === 'warning' ? 'rgba(255, 152, 0, 0.05)' :
                   'rgba(59, 130, 246, 0.05)',
          '&:hover': {
            borderColor: flag.severity === 'error' ? '#d32f2f' :
                        flag.severity === 'warning' ? '#f57c00' :
                        '#2563eb',
          },
        }}
      >
        {/* Warning/Error Icon */}
        <Box
          sx={{
            position: 'absolute',
            top: -10,
            right: -10,
            bgcolor: 'background.paper',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          <Icon color={iconColor} sx={{ fontSize: 20 }} />
        </Box>

        {/* Children content */}
        {children}
      </Box>
    </Tooltip>
  );
};

export default ValidationFlag;
