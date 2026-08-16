import React, { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AppWindow,
  FilePlus2,
  FolderPlus,
  Globe,
  Plus,
  RefreshCw,
  Settings,
  Upload,
  Workflow,
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import FlowTree from '@/components/app-sidebar/FlowTree';
import FlowDialogs from '@/components/app-sidebar/FlowDialogs';
import { useAppState } from '@/context/AppStateContext';
import { flowsApi } from '@/services/api';

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tree, treeLoading, refreshTree, applications, applicationsLoading, environments, environment, setEnvironment } = useAppState();

  const [action, setAction] = useState(null);
  const uploadInputRef = useRef(null);
  const uploadTargetRef = useRef('');

  const handleAction = (nextAction) => {
    if (nextAction.type === 'upload') {
      uploadTargetRef.current = nextAction.parentPath || '';
      uploadInputRef.current?.click();
      return;
    }
    setAction(nextAction);
  };

  const handleUploadFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) { return; }

    const parent = uploadTargetRef.current;
    const relativePath = parent ? `${parent}/${file.name}` : file.name;
    const content = await file.text();

    try {
      await flowsApi.saveFile(relativePath, content);
      await refreshTree();
    } catch (ex) {
      if (ex.response?.status === 409) {
        const replace = window.confirm(`“${relativePath}” already exists. Replace it?`);
        if (!replace) { return; }
        try {
          await flowsApi.saveFile(relativePath, content, true);
          await refreshTree();
        } catch (retryEx) {
          window.alert(retryEx.response?.data?.error || retryEx.message);
        }
        return;
      }
      window.alert(ex.response?.data?.error || ex.message);
    }
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" onClick={() => navigate('/')}>
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Workflow className="size-4" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-semibold">Lab34 Flows</span>
                <span className="text-muted-foreground truncate text-xs">E2E flow testing</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* ------------------------------ Flows ------------------------------ */}
        <SidebarGroup>
          <SidebarGroupLabel>Flows</SidebarGroupLabel>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarGroupAction title="Add flow, folder or upload">
                <Plus /> <span className="sr-only">Add</span>
              </SidebarGroupAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start">
              <DropdownMenuItem onClick={() => handleAction({ type: 'new-flow', parentPath: '' })}>
                <FilePlus2 /> New flow
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction({ type: 'new-folder', parentPath: '' })}>
                <FolderPlus /> New folder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction({ type: 'upload', parentPath: '' })}>
                <Upload /> Upload file
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => refreshTree()}>
                <RefreshCw /> Refresh
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <SidebarGroupContent>
            {treeLoading ? (
              <div className="space-y-1 px-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-4/5" />
                <Skeleton className="h-6 w-3/5" />
              </div>
            ) : (
              <FlowTree tree={tree} onAction={handleAction} />
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* --------------------------- Applications -------------------------- */}
        <SidebarGroup>
          <SidebarGroupLabel>Applications</SidebarGroupLabel>
          <SidebarGroupContent>
            {applicationsLoading ? (
              <div className="space-y-1 px-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-2/3" />
              </div>
            ) : (
              <SidebarMenu>
                {applications.length === 0 && (
                  <div className="text-muted-foreground px-2 py-1.5 text-xs">
                    No applications found in the applications folder.
                  </div>
                )}
                {applications.map((app) => (
                  <SidebarMenuItem key={app.slug}>
                    <SidebarMenuButton
                      isActive={location.pathname === `/applications/${app.slug}`}
                      onClick={() => navigate(`/applications/${app.slug}`)}
                      title={app.description || app.name}
                    >
                      <AppWindow className="text-muted-foreground" />
                      <span>{app.name}</span>
                    </SidebarMenuButton>
                    <SidebarMenuBadge>{app.methods?.length || 0}</SidebarMenuBadge>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={location.pathname.startsWith('/settings')}
              onClick={() => navigate('/settings')}
              title="AI, Xray, UI and help"
            >
              <Settings className="text-muted-foreground" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="grid gap-1 px-2 pb-1">
          <Label className="text-muted-foreground flex items-center gap-1 text-xs">
            <Globe className="size-3" /> Environment
          </Label>
          <Select value={environment || undefined} onValueChange={setEnvironment}>
            <SelectTrigger size="sm" className="w-full" aria-label="Environment">
              <SelectValue placeholder="Select environment" />
            </SelectTrigger>
            <SelectContent>
              {environments.map((env) => (
                <SelectItem key={env} value={env}>{env}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SidebarFooter>

      <SidebarRail />

      {/* Hidden input backing the "Upload file" actions */}
      <input
        ref={uploadInputRef}
        type="file"
        accept=".md,.markdown,.yaml,.yml"
        className="hidden"
        onChange={handleUploadFile}
      />

      <FlowDialogs action={action} onClose={() => setAction(null)} />
    </Sidebar>
  );
}

export default AppSidebar;
