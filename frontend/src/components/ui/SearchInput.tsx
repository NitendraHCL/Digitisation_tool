import React, { useState } from 'react';
import { theme } from '../../styles/theme';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          padding: '10px 14px 10px 38px',
          fontSize: theme.typography.sizes.small,
          fontFamily: theme.typography.fontFamily,
          color: theme.colors.textPrimary,
          backgroundColor: theme.colors.surface,
          border: `1px solid ${isFocused ? theme.colors.borderFocus : theme.colors.border}`,
          borderRadius: theme.radius.sm,
          outline: 'none',
          transition: theme.transitions.fast,
          boxShadow: isFocused ? theme.shadows.focus : 'none',
          width: '280px',
          boxSizing: 'border-box',
        }}
        onMouseEnter={(e) => {
          if (!isFocused) {
            e.currentTarget.style.borderColor = theme.colors.borderHover;
          }
        }}
        onMouseLeave={(e) => {
          if (!isFocused) {
            e.currentTarget.style.borderColor = theme.colors.border;
          }
        }}
      />
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          position: 'absolute',
          left: '14px',
          pointerEvents: 'none',
          color: theme.colors.textSecondary,
        }}
      >
        <path
          d="M21 21L15.5 15.5M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export default SearchInput;
