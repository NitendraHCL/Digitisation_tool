import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  IconButton,
  Alert,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';

interface ValidationFlag {
  resultIndex: number;
  parameterId?: string | null;
  parameterName: string;
  field: 'parameterName' | 'unit' | 'value';
  flagType: 'PARAMETER_NOT_FOUND' | 'UNIT_MISMATCH' | 'VALUE_TYPE_MISMATCH';
  expected: any;
  actual: any;
  severity: 'warning' | 'error';
  message: string;
}

interface ValidationSummaryProps {
  validationFlags: ValidationFlag[];
  onFlagClick?: (flag: ValidationFlag) => void;
}

const ValidationSummary: React.FC<ValidationSummaryProps> = ({ validationFlags, onFlagClick }) => {
  const [expanded, setExpanded] = React.useState(true);

  if (!validationFlags || validationFlags.length === 0) {
    return (
      <Alert severity="success" icon={<CheckIcon />} sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          All parameters validated successfully
        </Typography>
        <Typography variant="caption">
          No issues found with parameter names, units, or value types.
        </Typography>
      </Alert>
    );
  }

  // Group flags by type
  const flagsByType = {
    PARAMETER_NOT_FOUND: validationFlags.filter((f) => f.flagType === 'PARAMETER_NOT_FOUND'),
    UNIT_MISMATCH: validationFlags.filter((f) => f.flagType === 'UNIT_MISMATCH'),
    VALUE_TYPE_MISMATCH: validationFlags.filter((f) => f.flagType === 'VALUE_TYPE_MISMATCH'),
  };

  const errorCount = validationFlags.filter((f) => f.severity === 'error').length;
  const warningCount = validationFlags.filter((f) => f.severity === 'warning').length;

  const getFlagIcon = (flagType: string) => {
    switch (flagType) {
      case 'PARAMETER_NOT_FOUND':
        return <WarningIcon color="warning" fontSize="small" />;
      case 'UNIT_MISMATCH':
        return <ErrorIcon color="error" fontSize="small" />;
      case 'VALUE_TYPE_MISMATCH':
        return <WarningIcon color="warning" fontSize="small" />;
      default:
        return <WarningIcon fontSize="small" />;
    }
  };

  const getFlagTypeLabel = (flagType: string) => {
    switch (flagType) {
      case 'PARAMETER_NOT_FOUND':
        return 'Parameter Not Found';
      case 'UNIT_MISMATCH':
        return 'Unit Mismatch';
      case 'VALUE_TYPE_MISMATCH':
        return 'Value Type Mismatch';
      default:
        return flagType;
    }
  };

  const formatExpected = (expected: any) => {
    if (Array.isArray(expected)) {
      return expected.join(', ');
    }
    if (typeof expected === 'object') {
      return JSON.stringify(expected);
    }
    return String(expected);
  };

  return (
    <Paper
      elevation={0}
      sx={{
        border: '2px solid',
        borderColor: errorCount > 0 ? 'error.main' : 'warning.main',
        borderRadius: 2,
        mb: 3,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
          bgcolor: errorCount > 0 ? 'error.light' : 'warning.light',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {errorCount > 0 ? (
            <ErrorIcon color="error" />
          ) : (
            <WarningIcon color="warning" />
          )}
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {validationFlags.length} Validation Issue{validationFlags.length !== 1 ? 's' : ''} Found
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {errorCount > 0 && (
            <Chip
              label={`${errorCount} Error${errorCount !== 1 ? 's' : ''}`}
              color="error"
              size="small"
            />
          )}
          {warningCount > 0 && (
            <Chip
              label={`${warningCount} Warning${warningCount !== 1 ? 's' : ''}`}
              color="warning"
              size="small"
            />
          )}
          <IconButton size="small">
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      {/* Content */}
      <Collapse in={expanded}>
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            These fields have been flagged for your review. The system will allow you to proceed, but please verify these values are correct.
          </Typography>

          {/* Parameter Not Found */}
          {flagsByType.PARAMETER_NOT_FOUND.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon color="warning" fontSize="small" />
                Parameters Not in Master ({flagsByType.PARAMETER_NOT_FOUND.length})
              </Typography>
              <List dense>
                {flagsByType.PARAMETER_NOT_FOUND.map((flag, idx) => (
                  <ListItem
                    key={idx}
                    sx={{
                      bgcolor: 'warning.light',
                      borderRadius: 1,
                      mb: 0.5,
                      cursor: onFlagClick ? 'pointer' : 'default',
                      '&:hover': onFlagClick ? { bgcolor: 'warning.main' } : {},
                    }}
                    onClick={() => onFlagClick?.(flag)}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {getFlagIcon(flag.flagType)}
                    </ListItemIcon>
                    <ListItemText
                      primary={<Typography variant="body2" sx={{ fontWeight: 600 }}>{flag.parameterName}</Typography>}
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {flag.message}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Unit Mismatch */}
          {flagsByType.UNIT_MISMATCH.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <ErrorIcon color="error" fontSize="small" />
                Unit Mismatches ({flagsByType.UNIT_MISMATCH.length})
              </Typography>
              <List dense>
                {flagsByType.UNIT_MISMATCH.map((flag, idx) => (
                  <ListItem
                    key={idx}
                    sx={{
                      bgcolor: 'error.light',
                      borderRadius: 1,
                      mb: 0.5,
                      cursor: onFlagClick ? 'pointer' : 'default',
                      '&:hover': onFlagClick ? { bgcolor: 'error.main' } : {},
                    }}
                    onClick={() => onFlagClick?.(flag)}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {getFlagIcon(flag.flagType)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {flag.parameterName}: <strong>{flag.actual}</strong>
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          Expected: {formatExpected(flag.expected)}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Value Type Mismatch */}
          {flagsByType.VALUE_TYPE_MISMATCH.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon color="warning" fontSize="small" />
                Value Type Mismatches ({flagsByType.VALUE_TYPE_MISMATCH.length})
              </Typography>
              <List dense>
                {flagsByType.VALUE_TYPE_MISMATCH.map((flag, idx) => (
                  <ListItem
                    key={idx}
                    sx={{
                      bgcolor: 'warning.light',
                      borderRadius: 1,
                      mb: 0.5,
                      cursor: onFlagClick ? 'pointer' : 'default',
                      '&:hover': onFlagClick ? { bgcolor: 'warning.main' } : {},
                    }}
                    onClick={() => onFlagClick?.(flag)}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {getFlagIcon(flag.flagType)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {flag.parameterName}: "{flag.actual}"
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          Expected type: {flag.expected}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default ValidationSummary;
