import React from 'react';
import { theme } from '../../styles/theme';

interface AvatarProps {
  name: string;
  size?: 'small' | 'medium' | 'large';
  backgroundColor?: string;
}

const Avatar: React.FC<AvatarProps> = ({
  name,
  size = 'medium',
  backgroundColor = theme.colors.accent
}) => {
  const sizeConfig = {
    small: {
      width: '32px',
      height: '32px',
      fontSize: theme.typography.sizes.tiny,
    },
    medium: {
      width: '40px',
      height: '40px',
      fontSize: theme.typography.sizes.small,
    },
    large: {
      width: '56px',
      height: '56px',
      fontSize: theme.typography.sizes.body,
    },
  };

  const config = sizeConfig[size];

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      style={{
        width: config.width,
        height: config.height,
        borderRadius: theme.radius.full,
        backgroundColor: backgroundColor,
        color: theme.colors.surface,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: config.fontSize,
        fontWeight: theme.typography.weights.semibold,
        fontFamily: theme.typography.fontFamily,
        flexShrink: 0,
      }}
    >
      {getInitials(name)}
    </div>
  );
};

export default Avatar;
