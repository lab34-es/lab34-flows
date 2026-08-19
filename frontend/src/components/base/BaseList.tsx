import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, FileText } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import StatusDot from '@/components/shared/StatusDot';
import { useExecutions } from '@/context/ExecutionContext';
import { flowUrl } from '@/lib/flows';
import { formatValue, isEmpty } from '@/lib/properties';

/**
 * The other way a view can render its flows: one row each, with the columns
 * it asks for shown as small labelled chips underneath.
 *
 * @param {Object} props
 * @param {Array<Object>} props.columns
 * @param {Array<Object>} props.rows
 */
export function BaseList({ columns, rows }) {
  const { statusFor } = useExecutions();

  // The first column names the flow; the rest describe it
  const [nameColumn, ...detailColumns] = columns;

  return (
    <ul className="divide-y">
      {rows.map((row) => {
        const label = nameColumn && !isEmpty(row.values?.[nameColumn.id])
          ? formatValue(row.values[nameColumn.id])
          : row.title;

        return (
          <li key={row.relativePath} className="hover:bg-muted/50 px-6 py-3">
            <Link to={flowUrl(row)} className="group/name block">
              <div className="flex items-center gap-2">
                <StatusDot status={statusFor(row.path)} />
                <FileText className="text-muted-foreground size-4 shrink-0" />
                <span className="text-info truncate font-medium group-hover/name:underline">{label}</span>
                {row.hasErrors && (
                  <AlertTriangle className="text-destructive size-3.5 shrink-0" aria-label="has problems" />
                )}
              </div>

              <p className="text-muted-foreground truncate pl-8 font-mono text-xs">{row.relativePath}</p>

              {detailColumns.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-8 pt-1.5">
                  {detailColumns
                    .filter((column) => !isEmpty(row.values?.[column.id]))
                    .map((column) => (
                      <Badge key={column.id} variant="outline" className="font-normal">
                        <span className="text-muted-foreground">{column.displayName}</span>
                        <span>{formatValue(row.values[column.id])}</span>
                      </Badge>
                    ))}
                </div>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default BaseList;
