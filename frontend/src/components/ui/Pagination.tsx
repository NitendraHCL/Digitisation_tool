import React from 'react';
import { theme } from '../../styles/theme';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showFirstLast?: boolean;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  showFirstLast = true,
}) => {
  const buttonStyle = (isActive: boolean, isDisabled: boolean): React.CSSProperties => ({
    padding: '8px 12px',
    fontSize: theme.typography.sizes.small,
    fontWeight: isActive ? theme.typography.weights.semibold : theme.typography.weights.medium,
    fontFamily: theme.typography.fontFamily,
    backgroundColor: isActive
      ? theme.colors.accent
      : theme.colors.surface,
    color: isActive
      ? theme.colors.surface
      : isDisabled
      ? theme.colors.textTertiary
      : theme.colors.textPrimary,
    border: `1px solid ${isActive ? theme.colors.accent : theme.colors.border}`,
    borderRadius: theme.radius.sm,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    transition: theme.transitions.fast,
    minWidth: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const handlePageClick = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.xs,
      }}
    >
      {/* First Button */}
      {showFirstLast && (
        <button
          onClick={() => handlePageClick(1)}
          disabled={currentPage === 1}
          style={buttonStyle(false, currentPage === 1)}
          onMouseEnter={(e) => {
            if (currentPage !== 1) {
              e.currentTarget.style.borderColor = theme.colors.accent;
              e.currentTarget.style.backgroundColor = theme.colors.accentLight;
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage !== 1) {
              e.currentTarget.style.borderColor = theme.colors.border;
              e.currentTarget.style.backgroundColor = theme.colors.surface;
            }
          }}
        >
          ««
        </button>
      )}

      {/* Previous Button */}
      <button
        onClick={() => handlePageClick(currentPage - 1)}
        disabled={currentPage === 1}
        style={buttonStyle(false, currentPage === 1)}
        onMouseEnter={(e) => {
          if (currentPage !== 1) {
            e.currentTarget.style.borderColor = theme.colors.accent;
            e.currentTarget.style.backgroundColor = theme.colors.accentLight;
          }
        }}
        onMouseLeave={(e) => {
          if (currentPage !== 1) {
            e.currentTarget.style.borderColor = theme.colors.border;
            e.currentTarget.style.backgroundColor = theme.colors.surface;
          }
        }}
      >
        ‹
      </button>

      {/* Page Numbers */}
      {getPageNumbers().map((page, index) => {
        if (page === '...') {
          return (
            <span
              key={`ellipsis-${index}`}
              style={{
                padding: '8px 4px',
                color: theme.colors.textSecondary,
                fontSize: theme.typography.sizes.small,
                fontFamily: theme.typography.fontFamily,
              }}
            >
              ...
            </span>
          );
        }

        const pageNum = page as number;
        const isActive = pageNum === currentPage;

        return (
          <button
            key={pageNum}
            onClick={() => handlePageClick(pageNum)}
            style={buttonStyle(isActive, false)}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = theme.colors.accent;
                e.currentTarget.style.backgroundColor = theme.colors.accentLight;
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = theme.colors.border;
                e.currentTarget.style.backgroundColor = theme.colors.surface;
              }
            }}
          >
            {pageNum}
          </button>
        );
      })}

      {/* Next Button */}
      <button
        onClick={() => handlePageClick(currentPage + 1)}
        disabled={currentPage === totalPages}
        style={buttonStyle(false, currentPage === totalPages)}
        onMouseEnter={(e) => {
          if (currentPage !== totalPages) {
            e.currentTarget.style.borderColor = theme.colors.accent;
            e.currentTarget.style.backgroundColor = theme.colors.accentLight;
          }
        }}
        onMouseLeave={(e) => {
          if (currentPage !== totalPages) {
            e.currentTarget.style.borderColor = theme.colors.border;
            e.currentTarget.style.backgroundColor = theme.colors.surface;
          }
        }}
      >
        ›
      </button>

      {/* Last Button */}
      {showFirstLast && (
        <button
          onClick={() => handlePageClick(totalPages)}
          disabled={currentPage === totalPages}
          style={buttonStyle(false, currentPage === totalPages)}
          onMouseEnter={(e) => {
            if (currentPage !== totalPages) {
              e.currentTarget.style.borderColor = theme.colors.accent;
              e.currentTarget.style.backgroundColor = theme.colors.accentLight;
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage !== totalPages) {
              e.currentTarget.style.borderColor = theme.colors.border;
              e.currentTarget.style.backgroundColor = theme.colors.surface;
            }
          }}
        >
          »»
        </button>
      )}
    </div>
  );
};

export default Pagination;
