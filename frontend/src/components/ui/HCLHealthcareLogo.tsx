import React from 'react';

interface HCLHealthcareLogoProps {
  width?: number;
  color?: 'blue' | 'white';
}

const HCLHealthcareLogo: React.FC<HCLHealthcareLogoProps> = ({
  width = 280,
  color = 'blue'
}) => {
  const blueColor = '#0073B7';
  const whiteColor = '#FFFFFF';

  const primaryColor = color === 'blue' ? blueColor : whiteColor;
  const textOnShape = color === 'blue' ? whiteColor : blueColor;

  return (
    <svg
      width={width}
      height={width * 0.18}
      viewBox="0 0 400 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* HCL Blue Shape (Parallelogram) */}
      <path
        d="M0 0H95L80 72H0V0Z"
        fill={primaryColor}
      />

      {/* HCL Text inside shape */}
      <text
        x="40"
        y="48"
        fontSize="32"
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
        fill={textOnShape}
        textAnchor="middle"
      >
        HCL
      </text>

      {/* Horizontal line extending from shape */}
      <rect
        x="80"
        y="68"
        width="320"
        height="4"
        fill={primaryColor}
      />

      {/* HCL HEALTHCARE Text */}
      <text
        x="105"
        y="48"
        fontSize="28"
        fontWeight="600"
        fontFamily="Arial, sans-serif"
        fill={primaryColor}
        letterSpacing="2"
      >
        HCL HEALTHCARE
      </text>
    </svg>
  );
};

export default HCLHealthcareLogo;
