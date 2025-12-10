import React, { useEffect } from 'react';
import { theme } from '../../styles/theme';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
}

const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = 'md',
}) => {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const maxWidthMap = {
    sm: '480px',
    md: '640px',
    lg: '800px',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: theme.zIndex.modalBackdrop,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing.md,
          animation: 'fadeIn 200ms ease',
        }}
      >
        {/* Modal Card */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.xl,
            boxShadow: theme.shadows.xl,
            maxWidth: maxWidthMap[maxWidth],
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: theme.typography.fontFamily,
            animation: 'slideUp 200ms ease',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: theme.spacing.lg,
              borderBottom: `1px solid ${theme.colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <h2
              style={{
                fontSize: theme.typography.sizes.subheading,
                fontWeight: theme.typography.weights.semibold,
                color: theme.colors.textPrimary,
                margin: 0,
              }}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '24px',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: theme.radius.sm,
                transition: theme.transitions.fast,
                width: '32px',
                height: '32px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.background;
                e.currentTarget.style.color = theme.colors.textPrimary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = theme.colors.textSecondary;
              }}
              title="Close"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div
            style={{
              padding: theme.spacing.lg,
              overflowY: 'auto',
              flex: 1,
            }}
          >
            {children}
          </div>

          {/* Actions */}
          {actions && (
            <div
              style={{
                padding: theme.spacing.lg,
                borderTop: `1px solid ${theme.colors.border}`,
                display: 'flex',
                justifyContent: 'flex-end',
                gap: theme.spacing.sm,
              }}
            >
              {actions}
            </div>
          )}
        </div>
      </div>

      {/* CSS Animations */}
      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          @keyframes slideUp {
            from {
              transform: translateY(20px);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}
      </style>
    </>
  );
};

export default Modal;
