import React from 'react';
import { theme } from '../../styles/theme';

interface IconButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'danger';
  size?: 'small' | 'medium';
  disabled?: boolean;
  title?: string;
}

const IconButton: React.FC<IconButtonProps> = ({
  children,
  onClick,
  variant = 'default',
  size = 'medium',
  disabled = false,
  title,
}) => {
  const sizeMap = {
    small: '32px',
    medium: '40px',
  };

  const colorMap = {
    default: {
      color: theme.colors.textSecondary,
      hoverBg: theme.colors.background,
      hoverColor: theme.colors.textPrimary,
    },
    primary: {
      color: theme.colors.accent,
      hoverBg: theme.colors.accentLight,
      hoverColor: theme.colors.accent,
    },
    danger: {
      color: theme.colors.error,
      hoverBg: '#FEE2E2',
      hoverColor: theme.colors.error,
    },
  };

  const colors = colorMap[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: sizeMap[size],
        height: sizeMap[size],
        border: 'none',
        borderRadius: theme.radius.sm,
        backgroundColor: 'transparent',
        color: colors.color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: theme.transitions.fast,
        fontFamily: theme.typography.fontFamily,
        fontSize: size === 'small' ? '18px' : '20px',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = colors.hoverBg;
          e.currentTarget.style.color = colors.hoverColor;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = colors.color;
        }
      }}
    >
      {children}
    </button>
  );
};

export default IconButton;
