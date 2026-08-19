import React, { useMemo, useState } from 'react';
import {
  AppWindow,
  Braces,
  ChevronRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  FolderTree,
  Ghost,
  Globe,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  MessageCircleQuestion,
  Play,
  Radio,
  Rocket,
  Search,
  Share2,
  Shield,
  Sparkles,
  Terminal,
  Ticket,
  Wand2,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import Markdown from '@/components/shared/Markdown';
import { cn } from '@/lib/utils';
import { HELP_CATEGORIES, HELP_TOPICS } from '@/components/settings/help/helpContent';

const ICONS = {
  app: AppWindow,
  check: CheckCircle2,
  code: Braces,
  file: FileText,
  folder: FolderTree,
  ghost: Ghost,
  globe: Globe,
  key: KeyRound,
  layout: LayoutDashboard,
  'life-buoy': LifeBuoy,
  message: MessageCircleQuestion,
  play: Play,
  radio: Radio,
  rocket: Rocket,
  share: Share2,
  shield: Shield,
  sparkles: Sparkles,
  terminal: Terminal,
  ticket: Ticket,
  wand: Wand2,
};

const REPOSITORY = 'https://github.com/lab34-es/lab34-flows';

// Everything an article can be found by, lowercased once per topic.
const HAYSTACKS = new Map(
  HELP_TOPICS.map((topic) => [
    topic.id,
    [topic.title, topic.summary, topic.keywords.join(' '), topic.body].join(' ').toLowerCase(),
  ])
);

const matches = (topic, terms) => {
  const haystack = HAYSTACKS.get(topic.id) || '';
  return terms.every((term) => haystack.includes(term));
};

/**
 * The Help section: every article the tool ships with, searchable, grouped by
 * category and rendered as Markdown. Content lives in helpContent.js.
 */
export function HelpSection() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [open, setOpen] = useState(() => new Set());

  const terms = useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query]
  );
  const searching = terms.length > 0;

  const topics = useMemo(() => HELP_TOPICS.filter((topic) => {
    if (category !== 'all' && topic.category !== category) { return false; }
    return !searching || matches(topic, terms);
  }), [category, searching, terms]);

  // While searching, everything that survived the filter is worth reading, so
  // it is opened for you. Otherwise the section remembers what you opened.
  const isOpen = (id) => searching || open.has(id);

  const toggle = (id) => {
    if (searching) { return; }
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const allOpen = topics.length > 0 && topics.every((topic) => open.has(topic.id));

  const toggleAll = () => {
    setOpen(allOpen ? new Set() : new Set(topics.map((topic) => topic.id)));
  };

  const groups = HELP_CATEGORIES
    .map((item) => ({ ...item, topics: topics.filter((topic) => topic.category === item.id) }))
    .filter((group) => group.topics.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <LifeBuoy className="size-5" /> Help
        </h1>
        <p className="text-muted-foreground text-sm">
          How flows are written, run and integrated — everything in one place. Search it, or
          browse by topic.
        </p>
      </div>

      {/* ------------------------------ Search ------------------------------ */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-10 space-y-3 py-2 backdrop-blur">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the help — “memory”, “xray”, “random email”…"
            aria-label="Search help"
            className="pr-9 pl-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-1"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[{ id: 'all', label: 'All' }, ...HELP_CATEGORIES].map((item) => {
            const active = category === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs transition',
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {item.label}
              </button>
            );
          })}

          <div className="ml-auto flex items-center gap-2">
            {searching && (
              <span className="text-muted-foreground text-xs">
                {topics.length} {topics.length === 1 ? 'article' : 'articles'}
              </span>
            )}
            {!searching && topics.length > 0 && (
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {allOpen ? 'Collapse all' : 'Expand all'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------ Articles ---------------------------- */}
      {topics.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm font-medium">Nothing found for “{query}”</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Try a single word, or{' '}
            <button
              type="button"
              className="text-info underline underline-offset-4"
              onClick={() => { setQuery(''); setCategory('all'); }}
            >
              browse every topic
            </button>
            .
          </p>
        </Card>
      ) : (
        groups.map((group) => (
          <section key={group.id} className="space-y-2">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {group.label}
            </h2>

            <div className="space-y-2">
              {group.topics.map((topic) => {
                const Icon = ICONS[topic.icon] || FileText;
                const expanded = isOpen(topic.id);
                return (
                  <Collapsible
                    key={topic.id}
                    open={expanded}
                    onOpenChange={() => toggle(topic.id)}
                    asChild
                  >
                    <Card className="gap-0 overflow-hidden py-0">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="hover:bg-accent/50 flex w-full items-start gap-3 p-4 text-left transition"
                        >
                          <span className="bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md">
                            <Icon className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">{topic.title}</span>
                            <span className="text-muted-foreground block text-sm">
                              {topic.summary}
                            </span>
                          </span>
                          <ChevronRight
                            className={cn(
                              'text-muted-foreground mt-1 size-4 shrink-0 transition-transform',
                              expanded && 'rotate-90'
                            )}
                          />
                        </button>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="border-t px-4 py-4 pl-15">
                          <Markdown>{topic.body}</Markdown>
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          </section>
        ))
      )}

      {/* ------------------------------- Footer ----------------------------- */}
      <Card className="flex-row flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-medium">Still stuck?</p>
          <p className="text-muted-foreground text-sm">
            The README covers every corner of the tool, and issues are read.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={REPOSITORY} target="_blank" rel="noreferrer">
              <ExternalLink /> Documentation
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`${REPOSITORY}/issues`} target="_blank" rel="noreferrer">
              <ExternalLink /> Report an issue
            </a>
          </Button>
          <Badge variant="secondary">lab34-flows</Badge>
        </div>
      </Card>
    </div>
  );
}

export default HelpSection;
