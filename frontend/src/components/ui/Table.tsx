import React, { useState } from 'react';
import { theme } from '../../styles/theme';

interface Column {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface TableProps {
  columns: Column[];
  data: any[];
  onRowClick?: (row: any) => void;
  loading?: boolean;
}

const Table: React.FC<TableProps> = ({ columns, data, onRowClick, loading = false }) => {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  if (loading) {
    return (
      <div
        style={{
          padding: theme.spacing.xl,
          textAlign: 'center',
          color: theme.colors.textSecondary,
          fontFamily: theme.typography.fontFamily,
        }}
      >
        Loading...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        style={{
          padding: theme.spacing.xl,
          textAlign: 'center',
          color: theme.colors.textSecondary,
          fontFamily: theme.typography.fontFamily,
        }}
      >
        No data available
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        overflowX: 'auto',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface,
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: theme.typography.fontFamily,
        }}
      >
        <thead>
          <tr
            style={{
              backgroundColor: theme.colors.background,
              borderBottom: `1px solid ${theme.colors.border}`,
            }}
          >
            {columns.map((column) => (
              <th
                key={column.key}
                style={{
                  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                  textAlign: column.align || 'left',
                  fontSize: theme.typography.sizes.tiny,
                  fontWeight: theme.typography.weights.semibold,
                  color: theme.colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  width: column.width,
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              onMouseEnter={() => setHoveredRow(rowIndex)}
              onMouseLeave={() => setHoveredRow(null)}
              onClick={() => onRowClick && onRowClick(row)}
              style={{
                backgroundColor:
                  hoveredRow === rowIndex ? theme.colors.background : theme.colors.surface,
                borderBottom:
                  rowIndex < data.length - 1 ? `1px solid ${theme.colors.border}` : 'none',
                cursor: onRowClick ? 'pointer' : 'default',
                transition: theme.transitions.fast,
              }}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  style={{
                    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                    textAlign: column.align || 'left',
                    fontSize: theme.typography.sizes.small,
                    color: theme.colors.textPrimary,
                  }}
                >
                  {column.render
                    ? column.render(row[column.key], row)
                    : row[column.key] || '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
