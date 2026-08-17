import React from 'react';
import { ArrowDown, ArrowDownUp, ArrowUp, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { displayName } from '@/lib/properties';

/**
 * How a view is ordered. Several entries can be stacked, and the first one
 * that separates two flows wins — so "priority, then owner" reads exactly
 * like that.
 *
 * @param {Object} props
 * @param {Array<Object>} props.sort - [{ property, direction }]
 * @param {Array<string>} props.available - Every column id that can be sorted on
 * @param {Object} props.properties - The views.yaml `properties` map
 * @param {Function} props.onChange - Called with the new sort list
 */
export function SortMenu({ sort, available, properties, onChange }) {
  const unused = available.filter(
    (columnId) => !sort.some((entry) => entry.property === columnId)
  );

  const flip = (index) => {
    const next = sort.map((entry, position) => (
      position === index
        ? { ...entry, direction: entry.direction === 'DESC' ? 'ASC' : 'DESC' }
        : entry
    ));
    onChange(next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowDownUp /> Sort
          {sort.length > 0 && <span className="text-muted-foreground">{sort.length}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>

        {sort.length === 0 && (
          <p className="text-muted-foreground px-2 py-1 text-xs">
            Not sorted. Flows keep the order they are read in.
          </p>
        )}

        {sort.map((entry, index) => (
          <div key={entry.property} className="flex items-center gap-1 px-2 py-1 text-sm">
            <span className="min-w-0 flex-1 truncate">{displayName(entry.property, properties)}</span>
            <button
              type="button"
              className="hover:bg-muted flex items-center gap-1 rounded px-1 py-0.5 text-xs"
              onClick={() => flip(index)}
              aria-label={`Reverse the order of ${entry.property}`}
            >
              {entry.direction === 'DESC' ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />}
              {entry.direction}
            </button>
            <button
              type="button"
              className="hover:bg-muted rounded p-0.5"
              onClick={() => onChange(sort.filter((_, position) => position !== index))}
              aria-label={`Stop sorting by ${entry.property}`}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={unused.length === 0}>
            <Plus /> Add a property
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
            {unused.map((columnId) => (
              <DropdownMenuItem
                key={columnId}
                onClick={() => onChange([...sort, { property: columnId, direction: 'ASC' }])}
              >
                {displayName(columnId, properties)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default SortMenu;
