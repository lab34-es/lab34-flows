import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowDown, ArrowUp, Check, FileCode2, FileText, Minus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import StatusDot from '@/components/shared/StatusDot';
import { useExecutions } from '@/context/ExecutionContext';
import { flowUrl } from '@/lib/flows';
import { formatValue, inferType, isEmpty } from '@/lib/properties';
import { cn } from '@/lib/utils';

/**
 * One cell, rendered after the type its value implies: a checkbox reads as a
 * tick, a list as chips, a number right-aligned. Nothing is configured —
 * exactly like Obsidian, the value decides.
 */
function Cell({ value }) {
  if (isEmpty(value) && typeof value !== 'boolean') {
    return <Minus className="text-muted-foreground/40 size-3" aria-label="empty" />;
  }

  const type = inferType(value);

  if (type === 'checkbox') {
    return value
      ? <Check className="text-success size-4" aria-label="yes" />
      : <Minus className="text-muted-foreground/60 size-3" aria-label="no" />;
  }

  if (type === 'list') {
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((item, index) => (
          <Badge key={index} variant="secondary" className="font-normal">{formatValue(item)}</Badge>
        ))}
      </div>
    );
  }

  if (type === 'number') {
    return <span className="tabular-nums">{formatValue(value)}</span>;
  }

  if (type === 'date') {
    return <span className="tabular-nums">{formatValue(value).slice(0, 10)}</span>;
  }

  return <span className="line-clamp-2">{formatValue(value)}</span>;
}

/**
 * The table a folder of flows is rendered as: the columns a view asks for,
 * sorted by clicking a header, with the first column linking to the flow.
 *
 * @param {Object} props
 * @param {Array<Object>} props.columns - { id, displayName, width }
 * @param {Array<Object>} props.rows - Rows from /api/views/query
 * @param {Array<Object>} props.sort - [{ property, direction }]
 * @param {Function} props.onToggleSort - Called with a column id
 */
export function BaseTable({ columns, rows, sort, onToggleSort }) {
  const { statusFor } = useExecutions();

  const sortFor = (columnId) => sort.find((entry) => entry.property === columnId);

  if (!columns.length) {
    return (
      <p className="text-muted-foreground p-6 text-sm">
        This view shows no columns. Add one from <strong>Properties</strong>.
      </p>
    );
  }

  return (
    <Table containerClassName="h-full">
      <TableHeader className="bg-background sticky top-0 z-10">
        <TableRow>
          {columns.map((column) => {
            const entry = sortFor(column.id);
            return (
              <TableHead key={column.id} style={column.width ? { width: column.width } : undefined}>
                <button
                  type="button"
                  className="hover:text-foreground -mx-1 flex items-center gap-1 rounded px-1 py-0.5"
                  onClick={() => onToggleSort(column.id)}
                  title={`Sort by ${column.displayName}`}
                >
                  <span className="truncate">{column.displayName}</span>
                  {entry && (entry.direction === 'DESC'
                    ? <ArrowDown className="size-3 shrink-0" />
                    : <ArrowUp className="size-3 shrink-0" />)}
                </button>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>

      <TableBody>
        {rows.map((row) => {
          const Icon = row.format === 'markdown' ? FileText : FileCode2;
          return (
            <TableRow key={row.relativePath}>
              {columns.map((column, index) => (
                <TableCell
                  key={column.id}
                  className={cn(index === 0 && 'font-medium', 'max-w-[28rem]')}
                >
                  {index === 0 ? (
                    <Link
                      to={flowUrl(row)}
                      className="group/name flex items-center gap-2"
                      title={row.relativePath}
                    >
                      <StatusDot status={statusFor(row.path)} />
                      <Icon className="text-muted-foreground size-3.5 shrink-0" />
                      <span className="text-info truncate group-hover/name:underline">
                        {isEmpty(row.values?.[column.id]) ? row.name : formatValue(row.values[column.id])}
                      </span>
                      {row.hasErrors && (
                        <AlertTriangle className="text-destructive size-3.5 shrink-0" aria-label="has problems" />
                      )}
                    </Link>
                  ) : (
                    <Cell value={row.values?.[column.id]} />
                  )}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default BaseTable;
