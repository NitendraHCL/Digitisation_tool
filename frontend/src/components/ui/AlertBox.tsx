import React from 'react';
import { theme } from '../../styles/theme';

interface AlertBoxProps {
  variant: 'info' | 'warning' | 'error' | 'success';
  children: React.ReactNode;
  action?: React.ReactNode;
}

const AlertBox: React.FC<AlertBoxProps> = ({ variant, children, action }) => {
  const variantStyles = {
    success: {
      backgroundColor: '#E7F6ED',
      borderColor: theme.colors.success,
      iconColor: theme.colors.success,
      icon: '✓',
    },
    warning: {
      backgroundColor: '#FFF7E6',
      borderColor: theme.colors.warning,
      iconColor: theme.colors.warning,
      icon: '⚠',
    },
    error: {
      backgroundColor: '#FEE2E2',
      borderColor: theme.colors.error,
      iconColor: theme.colors.error,
      icon: '✕',
    },
    info: {
      backgroundColor: theme.colors.accentLight,
      borderColor: theme.colors.accent,
      iconColor: theme.colors.accent,
      icon: 'ℹ',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: theme.spacing.sm,
        backgroundColor: styles.backgroundColor,
        border: `1px solid ${styles.borderColor}40`,
        borderRadius: theme.radius.md,
        fontFamily: theme.typography.fontFamily,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.sm,
          flex: 1,
        }}
      >
        <div
          style={{
            fontSize: '18px',
            color: styles.iconColor,
            fontWeight: theme.typography.weights.bold,
            flexShrink: 0,
          }}
        >
          {styles.icon}
        </div>
        <div
          style={{
            fontSize: theme.typography.sizes.small,
            color: theme.colors.textPrimary,
            lineHeight: theme.typography.lineHeights.normal,
          }}
        >
          {children}
        </div>
      </div>
      {action && (
        <div
          style={{
            marginLeft: theme.spacing.md,
            flexShrink: 0,
          }}
        >
          {action}
        </div>
      )}
    </div>
  );
};

export default AlertBox;
