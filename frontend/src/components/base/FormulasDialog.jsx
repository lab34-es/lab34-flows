import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';

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

/**
 * Columns computed from other properties.
 *
 * A formula is available to every view of the context as `formula.<name>`,
 * both as a column and inside a filter.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {Function} props.onOpenChange
 * @param {Object} props.formulas - name -> expression
 * @param {Function} props.onSave - Called with the new formulas map
 */
export function FormulasDialog({ open, onOpenChange, formulas, onSave }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!open) { return; }
    setRows(Object.entries(formulas || {}).map(([name, expression]) => ({ name, expression })));
  }, [open, formulas]);

  const update = (index, patch) => {
    setRows(rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  };

  const save = () => {
    const next = {};
    rows.forEach(({ name, expression }) => {
      const key = String(name).trim();
      if (key && String(expression).trim()) {
        next[key] = String(expression).trim();
      }
    });
    onSave(next);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Formulas</DialogTitle>
          <DialogDescription>
            A column worked out from the others. Every view of this context can show it
            as <code>formula.&lt;name&gt;</code>, and filter on it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {rows.length === 0 && (
            <p className="text-muted-foreground text-sm">No formulas yet.</p>
          )}

          {rows.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={row.name}
                onChange={(event) => update(index, { name: event.target.value })}
                placeholder="coverage"
                className="w-40 font-mono text-xs"
                aria-label="Formula name"
              />
              <Input
                value={row.expression}
                onChange={(event) => update(index, { expression: event.target.value })}
                placeholder='if(flow.steps > 3, "deep", "shallow")'
                className="flex-1 font-mono text-xs"
                aria-label="Formula expression"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setRows(rows.filter((_, position) => position !== index))}
                aria-label="Remove this formula"
              >
                <X />
              </Button>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setRows([...rows, { name: '', expression: '' }])}
          >
            <Plus /> Add a formula
          </Button>

          <p className="text-muted-foreground text-xs">
            The same expressions filters use, plus <code>if(condition, then, else)</code>,{' '}
            <code>min()</code>, <code>max()</code>, <code>round()</code> and{' '}
            <code>default(value, fallback)</code>.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FormulasDialog;
