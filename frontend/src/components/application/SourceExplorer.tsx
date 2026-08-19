import React from 'react';
import {
  ChevronDown,
  FileCode2,
  FilePlus2,
  FileText,
  Folder,
  MoreHorizontal,
  Pencil,
  Settings2,
  Trash2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const FILE_ICONS = {
  md: FileText,
  markdown: FileText,
  js: FileCode2,
  json: FileCode2,
  env: Settings2,
};

const extensionOf = (filePath) => (filePath.split('.').pop() || '').toLowerCase();

/**
 * Turn the flat list of files into a nested tree, so folders of any depth
 * (env/, lib/, lib/http/…) render the way they sit on disk.
 */
const buildTree = (files) => {
  const root = { name: '', path: '', folders: new Map(), files: [] };

  for (const file of files) {
    const segments = file.path.split('/');
    let node = root;

    for (const segment of segments.slice(0, -1)) {
      const folderPath = node.path ? `${node.path}/${segment}` : segment;
      if (!node.folders.has(segment)) {
        node.folders.set(segment, { name: segment, path: folderPath, folders: new Map(), files: [] });
      }
      node = node.folders.get(segment);
    }

    (node.files as any[]).push(file);
  }

  return root;
};

const sortedFolders = (node) =>
  [...node.folders.values()].sort((a, b) => a.name.localeCompare(b.name));

/** The "…" menu shared by file and folder rows. */
function RowActions({ label, isFolder, targetPath, onAction }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${label}`}
          className={cn(
            'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            'mr-1 flex size-5 shrink-0 items-center justify-center rounded',
            'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100'
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isFolder && (
          <>
            <DropdownMenuItem onClick={() => onAction({ type: 'new-file', parentPath: targetPath })}>
              <FilePlus2 /> New file
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => onAction({ type: 'rename', targetPath, isFolder })}>
          <Pencil /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onAction({ type: 'delete', targetPath, isFolder })}
        >
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** One file in the explorer tree. */
function FileRow({ file, depth, isActive, isDirty, onSelect, onAction }) {
  const Icon = FILE_ICONS[extensionOf(file.path)] || FileText;
  const label = file.path.split('/').pop();

  return (
    <div
      className={cn(
        'group/row flex w-full items-center',
        'hover:bg-accent hover:text-accent-foreground',
        isActive && 'bg-accent text-accent-foreground'
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(file)}
        title={file.path}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-1 text-left font-mono text-xs',
          isActive && 'font-medium',
          !file.exists && 'text-muted-foreground italic'
        )}
        style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
      >
        <Icon className="size-3.5 shrink-0 opacity-70" />
        <span className="truncate">{label}</span>
        {isDirty && <span className="bg-warning size-1.5 shrink-0 rounded-full" />}
        {!file.exists && (
          <Badge variant="secondary" className="ml-auto shrink-0 px-1 py-0 text-[9px]">new</Badge>
        )}
      </button>

      {/* Files that do not exist yet have nothing to rename or delete */}
      {file.exists && (
        <RowActions label={file.path} isFolder={false} targetPath={file.path} onAction={onAction} />
      )}
    </div>
  );
}

/** One folder in the explorer tree, with its contents underneath. */
function FolderRow({ node, depth, children, onAction }) {
  return (
    <div>
      <div
        className={cn(
          'group/row text-muted-foreground flex w-full items-center',
          'hover:bg-accent hover:text-accent-foreground'
        )}
      >
        <div
          className="flex min-w-0 flex-1 items-center gap-1 py-1 font-mono text-xs"
          style={{ paddingLeft: `${0.25 + depth * 0.75}rem` }}
          title={node.path}
        >
          <ChevronDown className="size-3.5 shrink-0" />
          <Folder className="size-3.5 shrink-0 opacity-70" />
          <span className="truncate">{node.name}</span>
        </div>
        <RowActions label={node.path} isFolder targetPath={node.path} onAction={onAction} />
      </div>
      {children}
    </div>
  );
}

function TreeNodes({ node, depth, selected, isDirty, onSelect, onAction }) {
  return (
    <>
      {sortedFolders(node).map((folder) => (
        <FolderRow key={folder.path} node={folder} depth={depth} onAction={onAction}>
          <TreeNodes
            node={folder}
            depth={depth + 1.5}
            selected={selected}
            isDirty={isDirty}
            onSelect={onSelect}
            onAction={onAction}
          />
        </FolderRow>
      ))}
      {node.files.map((file) => (
        <FileRow
          key={file.path}
          file={file}
          depth={depth}
          isActive={file.path === selected}
          isDirty={isDirty(file.path)}
          onSelect={onSelect}
          onAction={onAction}
        />
      ))}
    </>
  );
}

/**
 * VS Code-like file explorer of an application: its files as a tree, plus the
 * actions to create, rename and delete them.
 */
export function SourceExplorer({ files, selected, isDirty, onSelect, onAction }) {
  const tree = buildTree(files);

  return (
    <aside className="bg-muted/40 flex w-56 shrink-0 flex-col border-r">
      <div className="flex shrink-0 items-center gap-1 py-1 pl-3 pr-1">
        <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
          Explorer
        </span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          title="New file"
          aria-label="New file"
          onClick={() => onAction({ type: 'new-file', parentPath: '' })}
        >
          <FilePlus2 className="size-3.5" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto pb-2">
        <TreeNodes
          node={tree}
          depth={0}
          selected={selected}
          isDirty={isDirty}
          onSelect={onSelect}
          onAction={onAction}
        />
      </div>
    </aside>
  );
}

export default SourceExplorer;
