import React from 'react';
import { Ticket } from 'lucide-react';

import JiraSettings from '@/components/settings/JiraSettings';
import XrayPull from '@/components/settings/XrayPull';

/**
 * The Jira / Xray section of the Settings screen. The card below loads on its
 * own, so a failure here never hides the rest of the settings.
 */
export function XraySettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Ticket className="size-5" /> Xray
        </h1>
        <p className="text-muted-foreground text-sm">
          Link your flows to Xray, the test management app for Jira: a flow is a Test, and
          every step block is one of its steps.
        </p>
      </div>

      <JiraSettings />
      <XrayPull />
    </div>
  );
}

export default XraySettings;
