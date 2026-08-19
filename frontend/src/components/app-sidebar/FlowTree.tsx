import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  FileText,
  FileCode2,
  Folder,
  FolderPlus,
  MoreHorizontal,
  FilePlus2,
  Pencil,
  Table2,
  Trash2,
  Upload,
} from 'lucide-react';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuSub,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import StatusDot from '@/components/shared/StatusDot';
import GitBadge from '@/components/shared/GitBadge';
import { useExecutions } from '@/context/ExecutionContext';
import { useGitStatus } from '@/context/AppStateContext';
import { decorationFor } from '@/lib/git';
import { flowUrl, folderUrl } from '@/lib/flows';
import { cn } from '@/lib/utils';

/* The letter sits where the row's actions appear on hover, so it steps aside
   for them. Unlike the application badges it cannot also key off
   data-state=open: in this tree that attribute belongs to the collapsible, so
   every expanded folder -- and everything under it -- would lose its letter. */
const BADGE_CLASSES =
  'ml-auto group-hover/menu-item:hidden group-focus-within/menu-item:hidden';

function FolderNode({ node, onAction, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const git = useGitStatus('flows');
  // folders start collapsed: the tree opens as a short list of top-level
  // folders instead of every flow in the repository at once
  const [open, setOpen] = React.useState(false);

  const isActive = location.pathname === '/flows/folder' &&
    new URLSearchParams(location.search).get('path') === node.relativePath;

  // A folder wears the status of whatever changed inside it, however deep
  const gitStatus = git.folder(node.relativePath);
  const gitClass = decorationFor(gitStatus)?.className;

  return (
    <SidebarMenuItem>
      <Collapsible open={open} onOpenChange={setOpen}>
        {/* The chevron expands the folder in place; the name opens it as a
            table. Two separate buttons, so neither steals the other's click */}
        <div className="flex items-center">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="hover:bg-sidebar-accent flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm"
              aria-label={`${open ? 'Collapse' : 'Expand'} folder ${node.name}`}
            >
              <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
            </button>
          </CollapsibleTrigger>

          <SidebarMenuButton
            isActive={isActive}
            onClick={() => navigate(folderUrl(node.relativePath))}
            title={`Open ${node.relativePath} as a table`}
          >
            <Folder className={cn('text-muted-foreground', gitClass)} />
            <span className={gitClass}>{node.name}</span>
            <GitBadge status={gitStatus} className={BADGE_CLASSES} />
          </SidebarMenuButton>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction showOnHover aria-label={`Actions for folder ${node.name}`}>
              <MoreHorizontal />
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start">
            <DropdownMenuItem onClick={() => navigate(folderUrl(node.relativePath))}>
              <Table2 /> Open as table
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onAction({ type: 'new-flow', parentPath: node.relativePath })}>
              <FilePlus2 /> New flow
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction({ type: 'new-folder', parentPath: node.relativePath })}>
              <FolderPlus /> New folder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction({ type: 'upload', parentPath: node.relativePath })}>
              <Upload /> Upload file
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onAction({ type: 'rename', targetPath: node.relativePath, isFolder: true })}>
              <Pencil /> Rename folder
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onAction({ type: 'delete', targetPath: node.relativePath, isFolder: true })}
            >
              <Trash2 /> Delete folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <CollapsibleContent>
          <SidebarMenuSub className="mr-0 pr-0">{children}</SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}

function FlowNode({ node, onAction }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { statusFor } = useExecutions();
  const git = useGitStatus('flows');

  const url = flowUrl(node);
  const isActive = location.pathname === '/flows/view' &&
    new URLSearchParams(location.search).get('path') === node.path;

  const status = statusFor(node.path);
  const Icon = node.format === 'markdown' ? FileText : FileCode2;

  const gitStatus = git.file(node.relativePath);
  const gitClass = decorationFor(gitStatus)?.className;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        onClick={() => navigate(url)}
        title={node.relativePath}
      >
        <StatusDot status={status} />
        <Icon className={cn('text-muted-foreground', gitClass)} />
        <span className={gitClass}>{node.title || node.name}</span>
        <GitBadge status={gitStatus} className={BADGE_CLASSES} />
      </SidebarMenuButton>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover aria-label={`Actions for flow ${node.name}`}>
            <MoreHorizontal />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem
            onClick={() => onAction({ type: 'rename', targetPath: node.relativePath, isFolder: false })}
          >
            <Pencil /> Rename flow
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onAction({ type: 'delete', targetPath: node.relativePath, isFolder: false })}
          >
            <Trash2 /> Delete flow
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

function TreeNodes({ nodes, onAction }) {
  return nodes.map((node) => {
    if (node.type === 'folder') {
      return (
        <FolderNode key={node.relativePath} node={node} onAction={onAction}>
          <TreeNodes nodes={node.children || []} onAction={onAction} />
        </FolderNode>
      );
    }
    return <FlowNode key={node.relativePath} node={node} onAction={onAction} />;
  });
}

export function FlowTree({ tree, onAction }) {
  if (!tree.length) {
    return (
      <div className="text-muted-foreground px-2 py-1.5 text-xs">
        No flows yet. Create one with the + button.
      </div>
    );
  }

  return (
    <SidebarMenu>
      <TreeNodes nodes={tree} onAction={onAction} />
    </SidebarMenu>
  );
}

export default FlowTree;
