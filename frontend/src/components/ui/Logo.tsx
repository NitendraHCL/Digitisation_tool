import React from 'react';
import { theme } from '../../styles/theme';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  centered?: boolean;
}

const Logo: React.FC<LogoProps> = ({ size = 'medium', centered = false }) => {
  // Size configurations
  const sizeConfig = {
    small: {
      mainFont: '18px',
      subtitleFont: '11px',
      dividerWidth: '60px',
      spacing: '4px',
    },
    medium: {
      mainFont: '24px',
      subtitleFont: '14px',
      dividerWidth: '80px',
      spacing: '6px',
    },
    large: {
      mainFont: '32px',
      subtitleFont: '16px',
      dividerWidth: '100px',
      spacing: '8px',
    },
  };

  const config = sizeConfig[size];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: centered ? 'center' : 'flex-start',
        fontFamily: theme.typography.fontFamily,
      }}
    >
      {/* Main Logo Text */}
      <div
        style={{
          fontSize: config.mainFont,
          fontWeight: theme.typography.weights.bold,
          color: theme.colors.textPrimary,
          letterSpacing: theme.typography.letterSpacing.tight,
          lineHeight: theme.typography.lineHeights.tight,
        }}
      >
        Lab Digitizer
      </div>

      {/* Divider Line */}
      <div
        style={{
          width: config.dividerWidth,
          height: '1px',
          backgroundColor: theme.colors.accent,
          margin: `${config.spacing} 0`,
        }}
      />

      {/* Subtitle */}
      <div
        style={{
          fontSize: config.subtitleFont,
          fontWeight: theme.typography.weights.normal,
          color: theme.colors.textSecondary,
          letterSpacing: theme.typography.letterSpacing.normal,
          lineHeight: theme.typography.lineHeights.normal,
        }}
      >
        AI-Powered Lab Reports
      </div>
    </div>
  );
};

export default Logo;
