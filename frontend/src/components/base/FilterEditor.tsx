import React, { useEffect, useState } from 'react';
import { Filter, Plus, X } from 'lucide-react';

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

const CONJUNCTIONS = [
  { value: 'and', label: 'All of these are true' },
  { value: 'or', label: 'Any of these is true' },
  { value: 'not', label: 'None of these is true' },
];

/**
 * Read a stored filter group into what the dialog edits: one conjunction and
 * a flat list of expressions. A hand-written views.yaml can nest groups more
 * deeply than that — those are left alone rather than flattened, and the
 * dialog says so.
 *
 * @param {*} filters
 * @returns {{ conjunction: string, expressions: Array<string>, editable: boolean }}
 */
function readFilters(filters) {
  const empty = { conjunction: 'and', expressions: [], editable: true };

  if (!filters) { return empty; }

  if (typeof filters === 'string') {
    return { conjunction: 'and', expressions: [filters], editable: true };
  }

  if (typeof filters !== 'object' || Array.isArray(filters)) { return empty; }

  const keys = Object.keys(filters);
  if (keys.length !== 1 || !['and', 'or', 'not'].includes(keys[0])) {
    return { ...empty, editable: false };
  }

  const children = Array.isArray(filters[keys[0]]) ? filters[keys[0]] : [filters[keys[0]]];
  if (!children.every((child) => typeof child === 'string')) {
    return { ...empty, editable: false };
  }

  return { conjunction: keys[0], expressions: children, editable: true };
}

/**
 * Which flows a view lists.
 *
 * Filters are expressions, exactly as they are stored in views.yaml, so what
 * the dialog shows is what the file holds — no lossy translation into
 * dropdowns that cannot express what the language can.
 *
 * @param {Object} props
 * @param {*} props.filters - The view's current filter group
 * @param {Array<string>} props.available - Column ids, for the cheat sheet
 * @param {number} props.matched - How many flows the current filters keep
 * @param {number} props.total - How many flows the folder holds
 * @param {Array<string>} props.errors - Filter errors reported by the backend
 * @param {Function} props.onChange - Called with the new filter group (or null)
 */
export function FilterEditor({ filters, available, matched, total, errors, onChange }) {
  const [open, setOpen] = useState(false);
  const [conjunction, setConjunction] = useState('and');
  const [expressions, setExpressions] = useState<any[]>([]);
  const [editable, setEditable] = useState(true);

  const current = readFilters(filters);
  const count = current.expressions.length;

  useEffect(() => {
    if (!open) { return; }
    const parsed = readFilters(filters);
    setConjunction(parsed.conjunction);
    setExpressions(parsed.expressions.length ? parsed.expressions : ['']);
    setEditable(parsed.editable);
  }, [open, filters]);

  const apply = () => {
    const kept = expressions.map((expression) => expression.trim()).filter(Boolean);
    onChange(kept.length ? { [conjunction]: kept } : null);
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Filter /> Filter
        {count > 0 && <span className="text-muted-foreground">{count}</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Filter this view</DialogTitle>
            <DialogDescription>
              Every flow below the folder is listed unless a filter says otherwise.
              Right now {matched} of {total} match.
            </DialogDescription>
          </DialogHeader>

          {!editable ? (
            <p className="text-muted-foreground text-sm">
              These filters use nested groups, which only <code>views.yaml</code> can express.
              Edit the file directly to change them.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-1.5">
                <Label>Keep a flow when</Label>
                <Select value={conjunction} onValueChange={setConjunction}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONJUNCTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                {expressions.map((expression, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={expression}
                      onChange={(event) => setExpressions(
                        expressions.map((item, position) => (position === index ? event.target.value : item))
                      )}
                      placeholder='priority > 5'
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setExpressions(expressions.filter((_, position) => position !== index))}
                      aria-label="Remove this condition"
                    >
                      <X />
                    </Button>
                  </div>
                ))}

                <Button variant="outline" size="sm" onClick={() => setExpressions([...expressions, ''])}>
                  <Plus /> Add a condition
                </Button>
              </div>

              {errors.length > 0 && (
                <div className="text-destructive space-y-0.5 text-xs">
                  {errors.map((error, index) => <p key={index} className="font-mono">{error}</p>)}
                </div>
              )}

              <details className="text-muted-foreground text-xs">
                <summary className="cursor-pointer select-none">What can I write here?</summary>
                <div className="space-y-2 pt-2">
                  <p>
                    A condition is an expression. A bare name is a frontmatter property, so{' '}
                    <code>priority</code> and <code>note.priority</code> are the same thing.
                  </p>
                  <ul className="list-disc space-y-0.5 pl-4">
                    <li><code>priority &gt; 5</code>, <code>owner == &quot;ana&quot;</code>, <code>reviewed != true</code></li>
                    <li><code>owner.contains(&quot;an&quot;)</code>, <code>tags.contains(&quot;smoke&quot;)</code>, <code>owner.isEmpty()</code></li>
                    <li><code>file.hasTag(&quot;smoke&quot;)</code>, <code>file.inFolder(&quot;payments&quot;)</code>, <code>file.hasProperty(&quot;owner&quot;)</code></li>
                    <li><code>flow.steps &gt; 3</code>, <code>flow.hasErrors</code>, <code>flow.format == &quot;markdown&quot;</code></li>
                    <li>Combine with <code>&amp;&amp;</code>, <code>||</code> and <code>!</code></li>
                  </ul>
                  <p>
                    Properties available here:{' '}
                    <span className="font-mono">{available.join(', ')}</span>
                  </p>
                </div>
              </details>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={apply} disabled={!editable}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default FilterEditor;
