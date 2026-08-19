import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Columns3, Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { defaultDisplayName, displayName } from '@/lib/properties';
import { cn } from '@/lib/utils';

/**
 * Which properties a view shows, and in which order.
 *
 * Ticking a property appends it to the view's `order`; the arrows move it,
 * and the pencil renames it — the rename lands in the document-wide
 * `properties` map, so every view that shows that column follows.
 *
 * @param {Object} props
 * @param {Array<string>} props.order - The view's column ids, in order
 * @param {Array<string>} props.available - Every column id that can be shown
 * @param {Object} props.properties - The views.yaml `properties` map
 * @param {Function} props.onOrderChange - Called with the new order
 * @param {Function} props.onRename - Called with (columnId, displayName)
 */
export function PropertiesMenu({ order, available, properties, onOrderChange, onRename }) {
  const [renaming, setRenaming] = useState<any>(null);
  const [draft, setDraft] = useState('');

  const toggle = (columnId) => {
    onOrderChange(
      order.includes(columnId)
        ? order.filter((id) => id !== columnId)
        : [...order, columnId]
    );
  };

  const move = (columnId, offset) => {
    const index = order.indexOf(columnId);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= order.length) { return; }
    const next = [...order];
    next.splice(target, 0, next.splice(index, 1)[0]);
    onOrderChange(next);
  };

  const startRename = (columnId) => {
    setRenaming(columnId);
    setDraft(displayName(columnId, properties));
  };

  const commitRename = () => {
    if (!renaming) { return; }
    // An empty name, or the humanized default, means "no custom name"
    const value = draft.trim();
    onRename(renaming, value === defaultDisplayName(renaming) ? '' : value);
    setRenaming(null);
  };

  // Shown columns first, in the view's own order, then everything else
  const hidden = available.filter((id) => !order.includes(id));

  const renderRow = (columnId, index, isShown) => {
    if (renaming === columnId) {
      return (
        <div key={columnId} className="flex items-center gap-1 px-1 py-1">
          <Input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') { commitRename(); }
              if (event.key === 'Escape') { setRenaming(null); }
            }}
            onBlur={commitRename}
            className="h-7 text-xs"
          />
        </div>
      );
    }

    return (
      <div
        key={columnId}
        className="hover:bg-accent group/row flex items-center gap-1 rounded-sm px-1 py-1 text-sm"
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => toggle(columnId)}
        >
          <span className={cn('flex size-4 shrink-0 items-center justify-center', !isShown && 'opacity-0')}>
            <Check className="size-3.5" />
          </span>
          <span className="truncate">{displayName(columnId, properties)}</span>
          <span className="text-muted-foreground shrink-0 font-mono text-[10px]">{columnId}</span>
        </button>

        {isShown && (
          <>
            <button
              type="button"
              className="hover:bg-muted rounded p-0.5 opacity-0 group-hover/row:opacity-100 disabled:opacity-0"
              onClick={() => move(columnId, -1)}
              disabled={index === 0}
              aria-label={`Move ${columnId} up`}
            >
              <ChevronUp className="size-3.5" />
            </button>
            <button
              type="button"
              className="hover:bg-muted rounded p-0.5 opacity-0 group-hover/row:opacity-100 disabled:opacity-0"
              onClick={() => move(columnId, 1)}
              disabled={index === order.length - 1}
              aria-label={`Move ${columnId} down`}
            >
              <ChevronDown className="size-3.5" />
            </button>
          </>
        )}

        <button
          type="button"
          className="hover:bg-muted rounded p-0.5 opacity-0 group-hover/row:opacity-100"
          onClick={() => startRename(columnId)}
          aria-label={`Rename ${columnId}`}
        >
          <Pencil className="size-3" />
        </button>
      </div>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3 /> Properties
          <span className="text-muted-foreground">{order.length}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] w-80 overflow-y-auto">
        <DropdownMenuLabel>Shown in this view</DropdownMenuLabel>
        {order.length === 0 && (
          <p className="text-muted-foreground px-2 py-1 text-xs">No columns yet.</p>
        )}
        {order.map((columnId, index) => renderRow(columnId, index, true))}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Available</DropdownMenuLabel>
        {hidden.length === 0 && (
          <p className="text-muted-foreground px-2 py-1 text-xs">Every property is already shown.</p>
        )}
        {hidden.map((columnId) => renderRow(columnId, -1, false))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default PropertiesMenu;
