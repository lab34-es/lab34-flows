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
import { useExecutions } from '@/context/ExecutionContext';
import { flowUrl } from '@/lib/flows';

function FolderNode({ node, onAction, children }) {
  return (
    <SidebarMenuItem>
      <Collapsible defaultOpen className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90">
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            <ChevronRight className="transition-transform" />
            <Folder className="text-muted-foreground" />
            <span>{node.name}</span>
          </SidebarMenuButton>
        </CollapsibleTrigger>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction showOnHover aria-label={`Actions for folder ${node.name}`}>
              <MoreHorizontal />
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start">
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

  const url = flowUrl(node);
  const isActive = location.pathname === '/flows/view' &&
    new URLSearchParams(location.search).get('path') === node.path;

  const status = statusFor(node.path);
  const Icon = node.format === 'markdown' ? FileText : FileCode2;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        onClick={() => navigate(url)}
        title={node.relativePath}
      >
        <StatusDot status={status} />
        <Icon className="text-muted-foreground" />
        <span>{node.title || node.name}</span>
      </SidebarMenuButton>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover aria-label={`Actions for flow ${node.name}`}>
            <MoreHorizontal />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
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
