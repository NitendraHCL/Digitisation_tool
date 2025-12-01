import React from 'react';
import { theme } from '../../styles/theme';

interface InputProps {
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: 'text' | 'number';
  disabled?: boolean;
  autoFocus?: boolean;
  width?: string;
  label?: string;
  fullWidth?: boolean;
}

const Input: React.FC<InputProps> = ({
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder,
  type = 'text',
  disabled = false,
  autoFocus = false,
  width = '100%',
  label,
  fullWidth = false,
}) => {
  return (
    <div style={{ width: fullWidth ? '100%' : width }}>
      {label && (
        <label
          style={{
            display: 'block',
            fontSize: theme.typography.sizes.tiny,
            fontWeight: theme.typography.weights.medium,
            color: theme.colors.textSecondary,
            marginBottom: '4px',
          }}
        >
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        style={{
          width: '100%',
          padding: '8px 12px',
          fontSize: theme.typography.sizes.body,
          fontFamily: theme.typography.fontFamily,
          color: theme.colors.textPrimary,
          backgroundColor: disabled ? theme.colors.background : theme.colors.surface,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.sm,
          outline: 'none',
          transition: theme.transitions.fast,
          cursor: disabled ? 'not-allowed' : 'text',
        }}
        onFocusCapture={(e) => {
          e.currentTarget.style.borderColor = theme.colors.accent;
          e.currentTarget.style.boxShadow = `0 0 0 3px ${theme.colors.accentLight}`;
        }}
        onBlurCapture={(e) => {
          e.currentTarget.style.borderColor = theme.colors.border;
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
    </div>
  );
};

export default Input;
