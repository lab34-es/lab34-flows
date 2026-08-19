import React, { useEffect, useState } from 'react';
import { LayoutList, Plus, Table2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const ICONS = { table: Table2, list: LayoutList };

/**
 * The saved views, as a tab bar.
 *
 * Views belong to the context, not to a folder: the same tab bar shows up on
 * every folder, and each one is applied to whatever folder is open.
 *
 * @param {Object} props
 * @param {Array<Object>} props.views - [{ name, type }]
 * @param {string} props.activeName
 * @param {Function} props.onSelect - Called with a view name
 * @param {Function} props.onCreate - Called with { name, type }
 */
export function ViewTabs({ views, activeName, onSelect, onCreate }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('table');
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!open) { return; }
    setName('');
    setType('table');
    setError(null);
  }, [open]);

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('The view needs a name.');
      return;
    }
    if (views.some((view) => view.name === trimmed)) {
      setError('A view with that name already exists.');
      return;
    }
    onCreate({ name: trimmed, type });
    setOpen(false);
  };

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto">
        {views.map((view) => {
          const Icon = ICONS[view.type] || Table2;
          const isActive = view.name === activeName;
          return (
            <button
              key={view.name}
              type="button"
              onClick={() => onSelect(view.name)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors',
                isActive
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              <Icon className="size-3.5" />
              {view.name}
            </button>
          );
        })}

        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={() => setOpen(true)}
          title="New view"
          aria-label="New view"
        >
          <Plus />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New view</DialogTitle>
            <DialogDescription>
              Views are saved in <code>views.yaml</code> and can be opened on any folder.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="view-name">Name</Label>
              <Input
                id="view-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && create()}
                placeholder="Critical flows"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="view-type">Layout</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="view-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="table">Table</SelectItem>
                  <SelectItem value="list">List</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ViewTabs;
