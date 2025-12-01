import React from 'react';
import { theme } from '../../styles/theme';

interface BadgeProps {
  label: string;
  variant: 'success' | 'warning' | 'error' | 'default' | 'info';
  size?: 'small' | 'medium';
}

const Badge: React.FC<BadgeProps> = ({ label, variant, size = 'small' }) => {
  const variantStyles = {
    success: {
      backgroundColor: '#E7F6ED',
      color: theme.colors.success,
      borderColor: theme.colors.success,
    },
    warning: {
      backgroundColor: '#FFF7E6',
      color: theme.colors.warning,
      borderColor: theme.colors.warning,
    },
    error: {
      backgroundColor: '#FEE2E2',
      color: theme.colors.error,
      borderColor: theme.colors.error,
    },
    info: {
      backgroundColor: theme.colors.accentLight,
      color: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    default: {
      backgroundColor: '#F5F5F5',
      color: theme.colors.textSecondary,
      borderColor: theme.colors.border,
    },
  };

  const sizeStyles = {
    small: {
      fontSize: theme.typography.sizes.tiny,
      padding: '4px 10px',
      height: '22px',
    },
    medium: {
      fontSize: theme.typography.sizes.small,
      padding: '6px 12px',
      height: '28px',
    },
  };

  const styles = variantStyles[variant];
  const sizing = sizeStyles[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        border: `1px solid ${styles.borderColor}20`,
        borderRadius: theme.radius.sm,
        fontSize: sizing.fontSize,
        fontWeight: theme.typography.weights.medium,
        fontFamily: theme.typography.fontFamily,
        padding: sizing.padding,
        height: sizing.height,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
};

export default Badge;
