import React, { useState } from 'react';
import { theme } from '../../styles/theme';

interface StatCardProps {
  title: string;
  value: number;
  icon: string;
  trend: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, color }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.md,
        boxShadow: isHovered ? theme.shadows.lg : theme.shadows.md,
        transition: theme.transitions.fast,
        border: `1px solid ${theme.colors.border}`,
        cursor: 'default',
      }}
    >
      {/* Icon and Title Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.spacing.sm,
        }}
      >
        <div
          style={{
            fontSize: theme.typography.sizes.small,
            fontWeight: theme.typography.weights.medium,
            color: theme.colors.textSecondary,
            fontFamily: theme.typography.fontFamily,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: '24px',
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${color}10`,
            borderRadius: theme.radius.md,
          }}
        >
          {icon}
        </div>
      </div>

      {/* Value */}
      <div
        style={{
          fontSize: '32px',
          fontWeight: theme.typography.weights.bold,
          color: theme.colors.textPrimary,
          fontFamily: theme.typography.fontFamily,
          lineHeight: theme.typography.lineHeights.tight,
          marginBottom: theme.spacing.xs,
        }}
      >
        {value}
      </div>

      {/* Trend */}
      <div
        style={{
          fontSize: theme.typography.sizes.tiny,
          fontWeight: theme.typography.weights.normal,
          color: color,
          fontFamily: theme.typography.fontFamily,
        }}
      >
        {trend}
      </div>
    </div>
  );
};

export default StatCard;
