import React from 'react';
import { theme } from '../../styles/theme';

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  showPercentage?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max,
  label,
  showPercentage = true,
}) => {
  const percentage = Math.round((value / max) * 100);

  return (
    <div
      style={{
        fontFamily: theme.typography.fontFamily,
      }}
    >
      {/* Label and Percentage */}
      {(label || showPercentage) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing.xs,
          }}
        >
          {label && (
            <div
              style={{
                fontSize: theme.typography.sizes.small,
                color: theme.colors.textSecondary,
                fontWeight: theme.typography.weights.medium,
              }}
            >
              {label}
            </div>
          )}
          {showPercentage && (
            <div
              style={{
                fontSize: theme.typography.sizes.small,
                color: theme.colors.accent,
                fontWeight: theme.typography.weights.semibold,
              }}
            >
              {percentage}%
            </div>
          )}
        </div>
      )}

      {/* Progress Bar Background */}
      <div
        style={{
          width: '100%',
          height: '8px',
          backgroundColor: theme.colors.background,
          borderRadius: theme.radius.full,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Progress Bar Fill */}
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            backgroundColor: theme.colors.accent,
            borderRadius: theme.radius.full,
            transition: 'width 300ms ease',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Animated Shimmer Effect */}
          {percentage < 100 && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                backgroundImage: `linear-gradient(
                  90deg,
                  transparent,
                  rgba(255, 255, 255, 0.3),
                  transparent
                )`,
                animation: 'shimmer 2s infinite',
              }}
            />
          )}
        </div>
      </div>

      {/* CSS Animation */}
      <style>
        {`
          @keyframes shimmer {
            0% {
              transform: translateX(-100%);
            }
            100% {
              transform: translateX(100%);
            }
          }
        `}
      </style>
    </div>
  );
};

export default ProgressBar;
