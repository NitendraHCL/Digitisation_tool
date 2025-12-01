import React, { useState } from 'react';
import { theme } from '../../styles/theme';

interface CustomButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  fullWidth?: boolean;
  loading?: boolean;
}

const CustomButton: React.FC<CustomButtonProps> = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled = false,
  fullWidth = false,
  loading = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;

  // Base styles for all buttons
  const baseStyles: React.CSSProperties = {
    padding: isPrimary ? '14px 24px' : '12px 20px',
    fontSize: isPrimary ? theme.typography.sizes.body : theme.typography.sizes.small,
    fontWeight: isPrimary ? theme.typography.weights.semibold : theme.typography.weights.medium,
    fontFamily: theme.typography.fontFamily,
    borderRadius: theme.radius.md,
    border: 'none',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    transition: theme.transitions.fast,
    width: fullWidth ? '100%' : 'auto',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    outline: 'none',
    position: 'relative',
    boxSizing: 'border-box',
  };

  // Primary button styles
  const primaryStyles: React.CSSProperties = {
    ...baseStyles,
    backgroundColor: isDisabled
      ? theme.colors.border
      : isActive
      ? '#1A35B8'
      : isHovered
      ? theme.colors.accentHover
      : theme.colors.accent,
    color: isDisabled ? theme.colors.textTertiary : theme.colors.surface,
    boxShadow: isHovered && !isDisabled ? theme.shadows.button : 'none',
    transform: isHovered && !isDisabled && !isActive ? 'translateY(-1px)' : 'translateY(0)',
  };

  // Secondary button styles
  const secondaryStyles: React.CSSProperties = {
    ...baseStyles,
    backgroundColor: isHovered && !isDisabled ? theme.colors.accentLight : theme.colors.surface,
    color: isHovered && !isDisabled ? theme.colors.accent : theme.colors.textPrimary,
    border: `1px solid ${
      isDisabled
        ? theme.colors.border
        : isHovered
        ? theme.colors.accent
        : theme.colors.border
    }`,
  };

  const buttonStyles = isPrimary ? primaryStyles : secondaryStyles;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsActive(false);
      }}
      onMouseDown={() => setIsActive(true)}
      onMouseUp={() => setIsActive(false)}
      style={buttonStyles}
    >
      {loading ? (
        <span
          style={{
            display: 'inline-block',
            animation: 'spin 1s linear infinite',
          }}
        >
          ⏳
        </span>
      ) : (
        children
      )}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </button>
  );
};

export default CustomButton;
