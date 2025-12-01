import React, { useState } from 'react';
import { theme } from '../../styles/theme';

interface CustomInputProps {
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  autoComplete?: string;
  showPasswordToggle?: boolean;
}

const CustomInput: React.FC<CustomInputProps> = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  autoFocus = false,
  disabled = false,
  error = false,
  helperText,
  autoComplete,
  showPasswordToggle = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const inputType = showPasswordToggle && showPassword ? 'text' : type;

  return (
    <div style={{ marginBottom: theme.spacing.md }}>
      {/* Label */}
      <label
        style={{
          display: 'block',
          fontSize: theme.typography.sizes.small,
          fontWeight: theme.typography.weights.medium,
          color: error ? theme.colors.error : theme.colors.textSecondary,
          marginBottom: '6px',
          fontFamily: theme.typography.fontFamily,
        }}
      >
        {label}
        {required && (
          <span style={{ color: theme.colors.error, marginLeft: '4px' }}>*</span>
        )}
      </label>

      {/* Input Container */}
      <div style={{ position: 'relative' }}>
        <input
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoFocus={autoFocus}
          disabled={disabled}
          autoComplete={autoComplete}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            width: '100%',
            padding: '14px 16px',
            fontSize: theme.typography.sizes.body,
            fontFamily: theme.typography.fontFamily,
            color: theme.colors.textPrimary,
            backgroundColor: disabled ? '#F5F5F5' : theme.colors.surface,
            border: `1px solid ${
              error
                ? theme.colors.error
                : isFocused
                ? theme.colors.borderFocus
                : theme.colors.border
            }`,
            borderRadius: theme.radius.sm,
            outline: 'none',
            transition: theme.transitions.fast,
            boxShadow: isFocused && !error ? theme.shadows.focus : 'none',
            cursor: disabled ? 'not-allowed' : 'text',
            boxSizing: 'border-box',
            paddingRight: showPasswordToggle ? '48px' : '16px',
          }}
          onMouseEnter={(e) => {
            if (!isFocused && !error && !disabled) {
              e.currentTarget.style.borderColor = theme.colors.borderHover;
            }
          }}
          onMouseLeave={(e) => {
            if (!isFocused && !error) {
              e.currentTarget.style.borderColor = theme.colors.border;
            }
          }}
        />

        {/* Password Toggle Button */}
        {showPasswordToggle && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: theme.colors.textSecondary,
              fontSize: '14px',
              fontFamily: theme.typography.fontFamily,
              transition: theme.transitions.fast,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = theme.colors.textPrimary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = theme.colors.textSecondary;
            }}
          >
            {showPassword ? '👁️' : '👁️‍🗨️'}
          </button>
        )}
      </div>

      {/* Helper Text / Error Message */}
      {helperText && (
        <div
          style={{
            fontSize: theme.typography.sizes.small,
            color: error ? theme.colors.error : theme.colors.textSecondary,
            marginTop: '6px',
            fontFamily: theme.typography.fontFamily,
          }}
        >
          {helperText}
        </div>
      )}
    </div>
  );
};

export default CustomInput;
