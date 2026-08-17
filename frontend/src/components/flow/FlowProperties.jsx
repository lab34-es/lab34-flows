import React, { useState } from 'react';
import { Check, Loader2, Plus, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  HEADLINE_PROPERTIES,
  defaultDisplayName,
  formatValue,
  inferType,
  isEmpty,
  parseInputValue,
  toInputValue,
} from '@/lib/properties';
import { cn } from '@/lib/utils';

// What a brand new property starts as. Nothing is stored anywhere: from the
// next read on, the value itself is what says what the property is.
const NEW_PROPERTY_TYPES = [
  { value: 'text', label: 'Text', initial: '' },
  { value: 'number', label: 'Number', initial: 0 },
  { value: 'checkbox', label: 'Checkbox', initial: false },
  { value: 'date', label: 'Date', initial: '' },
  { value: 'list', label: 'List', initial: [] },
];

const INPUT_TYPES = { number: 'number', date: 'date' };

/**
 * Rebuild a properties object with one key renamed, keeping the order.
 * @param {Object} properties
 * @param {string} from
 * @param {string} to
 * @returns {Object}
 */
function renameKey(properties, from, to) {
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [key === from ? to : key, value])
  );
}

/**
 * The frontmatter of a flow, as a property list.
 *
 * `title` and `description` are ordinary frontmatter properties, but they are
 * rendered above the list — as the document's heading and standfirst — the
 * way Obsidian treats them.
 *
 * @param {Object} props
 * @param {Object} props.properties - The flow's frontmatter
 * @param {string} props.fallbackTitle - Shown when there is no title property
 * @param {boolean} props.readOnly
 * @param {string} props.readOnlyReason - Why, shown to the user
 * @param {boolean} props.saving
 * @param {Function} props.onChange - Called with the whole new frontmatter
 */
export function FlowProperties({
  properties,
  fallbackTitle,
  readOnly,
  readOnlyReason,
  saving,
  onChange,
}) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('text');

  const meta = properties || {};
  const entries = Object.entries(meta).filter(([key]) => !HEADLINE_PROPERTIES.includes(key));

  const commit = (next) => {
    setEditing(null);
    onChange(next);
  };

  const setValue = (key, value) => commit({ ...meta, [key]: value });

  const startEditing = (key) => {
    if (readOnly) { return; }
    setEditing({ key, field: 'value' });
    setDraft(toInputValue(meta[key]));
  };

  const startRenaming = (key) => {
    if (readOnly) { return; }
    setEditing({ key, field: 'name' });
    setDraft(key);
  };

  const commitEditing = () => {
    if (!editing) { return; }
    const { key, field } = editing;

    if (field === 'name') {
      const name = draft.trim();
      if (!name || name === key || Object.prototype.hasOwnProperty.call(meta, name)) {
        setEditing(null);
        return;
      }
      commit(renameKey(meta, key, name));
      return;
    }

    const value = parseInputValue(draft, inferType(meta[key]));
    if (JSON.stringify(value) === JSON.stringify(meta[key])) {
      setEditing(null);
      return;
    }
    commit({ ...meta, [key]: value });
  };

  const remove = (key) => {
    const next = { ...meta };
    delete next[key];
    commit(next);
  };

  const addProperty = () => {
    const name = newName.trim();
    if (!name || Object.prototype.hasOwnProperty.call(meta, name)) {
      setAdding(false);
      setNewName('');
      return;
    }
    const type = NEW_PROPERTY_TYPES.find((candidate) => candidate.value === newType);
    setAdding(false);
    setNewName('');
    setNewType('text');
    commit({ ...meta, [name]: type ? type.initial : '' });
  };

  const editKeys = (event) => {
    if (event.key === 'Enter') { commitEditing(); }
    if (event.key === 'Escape') { setEditing(null); }
  };

  /**
   * The right-hand side of a property row.
   * @param {string} key
   * @returns {React.ReactNode}
   */
  const renderValue = (key) => {
    const value = meta[key];
    const type = inferType(value);

    if (editing?.key === key && editing.field === 'value') {
      return (
        <Input
          autoFocus
          type={INPUT_TYPES[type] || 'text'}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitEditing}
          onKeyDown={editKeys}
          placeholder={type === 'list' ? 'comma, separated, values' : ''}
          className="h-7 text-sm"
        />
      );
    }

    // A checkbox is a single click, so it never has an editing state
    if (type === 'checkbox') {
      return (
        <button
          type="button"
          disabled={readOnly}
          onClick={() => setValue(key, !value)}
          className={cn(
            'border-input flex size-4 items-center justify-center rounded-sm border',
            value && 'bg-primary text-primary-foreground border-primary',
            readOnly && 'cursor-default opacity-60'
          )}
          aria-label={`${key}: ${value ? 'yes' : 'no'}`}
          aria-pressed={Boolean(value)}
        >
          {value && <Check className="size-3" />}
        </button>
      );
    }

    if (type === 'list') {
      return (
        <button
          type="button"
          disabled={readOnly}
          onClick={() => startEditing(key)}
          className="flex w-full flex-wrap gap-1 text-left"
        >
          {value.length === 0
            ? <span className="text-muted-foreground/60 text-sm">Empty</span>
            : value.map((item, index) => (
              <Badge key={index} variant="secondary" className="font-normal">{formatValue(item)}</Badge>
            ))}
        </button>
      );
    }

    if (type === 'object') {
      // A nested block (xray, latentApplications…) is structure, not a value:
      // it belongs in the Source tab
      return (
        <span className="text-muted-foreground font-mono text-xs">
          {formatValue(value)}
        </span>
      );
    }

    return (
      <button
        type="button"
        disabled={readOnly}
        onClick={() => startEditing(key)}
        className="w-full truncate text-left text-sm"
      >
        {isEmpty(value)
          ? <span className="text-muted-foreground/60">Empty</span>
          : formatValue(value)}
      </button>
    );
  };

  /**
   * A headline property — title and description — rendered as the document's
   * own heading rather than as a row of the list.
   * @param {string} key
   * @param {string} placeholder
   * @param {string} className
   * @returns {React.ReactNode}
   */
  const renderHeadline = (key, placeholder, className) => {
    const value = meta[key];

    if (editing?.key === key && editing.field === 'value') {
      return (
        <Input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitEditing}
          onKeyDown={editKeys}
          className={cn('h-auto border-x-0 border-t-0 px-0 shadow-none', className)}
        />
      );
    }

    const shown = isEmpty(value) ? null : formatValue(value);

    return (
      <button
        type="button"
        disabled={readOnly}
        onClick={() => {
          if (readOnly) { return; }
          setEditing({ key, field: 'value' });
          setDraft(toInputValue(value ?? ''));
        }}
        className={cn('block w-full text-left', className, !shown && 'text-muted-foreground/50')}
      >
        {shown || placeholder}
      </button>
    );
  };

  return (
    <section className="mb-6" aria-label="Flow properties">
      {renderHeadline('title', fallbackTitle || 'Untitled flow', 'text-2xl font-bold tracking-tight')}
      {renderHeadline('description', 'Add a description…', 'text-muted-foreground pt-1 text-sm')}

      <div className="mt-4 border-t pt-3">
        <dl className="grid gap-0.5">
          {entries.map(([key]) => (
            <div key={key} className="group/prop flex items-start gap-3 rounded-sm px-1 py-1 hover:bg-muted/40">
              <dt className="w-40 shrink-0">
                {editing?.key === key && editing.field === 'name' ? (
                  <Input
                    autoFocus
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={commitEditing}
                    onKeyDown={editKeys}
                    className="h-7 text-sm"
                  />
                ) : (
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => startRenaming(key)}
                    className="text-muted-foreground w-full truncate text-left text-sm"
                    title={`${key} — click to rename`}
                  >
                    {defaultDisplayName(`note.${key}`)}
                  </button>
                )}
              </dt>

              <dd className="min-w-0 flex-1">{renderValue(key)}</dd>

              {!readOnly && (
                <button
                  type="button"
                  onClick={() => remove(key)}
                  className="text-muted-foreground hover:text-destructive shrink-0 opacity-0 group-hover/prop:opacity-100"
                  aria-label={`Remove the ${key} property`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </dl>

        {entries.length === 0 && !adding && (
          <p className="text-muted-foreground px-1 text-sm">No properties yet.</p>
        )}

        {adding && (
          <div className="flex items-center gap-2 px-1 py-1">
            <Input
              autoFocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') { addProperty(); }
                if (event.key === 'Escape') { setAdding(false); setNewName(''); }
              }}
              placeholder="Property name"
              className="h-7 w-40 text-sm"
            />
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger size="sm" className="w-32" aria-label="Property type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NEW_PROPERTY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={addProperty}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewName(''); }}>
              Cancel
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          {!readOnly && !adding && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setAdding(true)}>
              <Plus /> Add property
            </Button>
          )}
          {saving && (
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <Loader2 className="size-3 animate-spin" /> Saving…
            </span>
          )}
          {readOnly && readOnlyReason && (
            <span className="text-muted-foreground px-1 text-xs">{readOnlyReason}</span>
          )}
        </div>
      </div>
    </section>
  );
}

export default FlowProperties;
