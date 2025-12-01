import React from 'react';
import { theme } from '../../styles/theme';

interface Step {
  label: string;
  description?: string;
}

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  steps: Step[];
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, totalSteps, steps }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing.lg,
        fontFamily: theme.typography.fontFamily,
      }}
    >
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;

        return (
          <div key={index} style={{ position: 'relative' }}>
            {/* Step Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing.sm,
                marginBottom: theme.spacing.sm,
              }}
            >
              {/* Step Number Circle */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: isActive
                    ? theme.colors.accent
                    : isCompleted
                    ? theme.colors.success
                    : theme.colors.background,
                  border: `2px solid ${
                    isActive || isCompleted ? 'transparent' : theme.colors.border
                  }`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: theme.typography.sizes.small,
                  fontWeight: theme.typography.weights.semibold,
                  color: isActive || isCompleted ? theme.colors.surface : theme.colors.textSecondary,
                  transition: theme.transitions.fast,
                  flexShrink: 0,
                }}
              >
                {isCompleted ? '✓' : stepNumber}
              </div>

              {/* Step Label */}
              <div>
                <div
                  style={{
                    fontSize: theme.typography.sizes.body,
                    fontWeight: isActive
                      ? theme.typography.weights.semibold
                      : theme.typography.weights.medium,
                    color: isActive ? theme.colors.textPrimary : theme.colors.textSecondary,
                    lineHeight: theme.typography.lineHeights.tight,
                  }}
                >
                  {step.label}
                </div>
                {step.description && (
                  <div
                    style={{
                      fontSize: theme.typography.sizes.small,
                      color: theme.colors.textSecondary,
                      lineHeight: theme.typography.lineHeights.normal,
                      marginTop: '2px',
                    }}
                  >
                    {step.description}
                  </div>
                )}
              </div>
            </div>

            {/* Content Area - Only show for active step */}
            {isActive && (
              <div
                style={{
                  marginLeft: '44px',
                  paddingTop: theme.spacing.sm,
                }}
              >
                {/* Content will be rendered by parent */}
              </div>
            )}

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                style={{
                  position: 'absolute',
                  left: '15px',
                  top: '40px',
                  width: '2px',
                  height: '32px',
                  backgroundColor: isCompleted
                    ? theme.colors.success
                    : theme.colors.border,
                  transition: theme.transitions.fast,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StepIndicator;
