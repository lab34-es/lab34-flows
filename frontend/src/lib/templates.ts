/**
 * Template used when creating a new Markdown flow from the UI.
 */
export const newFlowTemplate = (title) => `---
title: ${title}
description: Describe what this flow verifies.
---

# ${title}

Write anything here — headings, prose, lists, links… This document *is* the
flow. Executable steps are fenced code blocks tagged as \`step\`:

\`\`\`step
application: calculator
method: add
description: An example step — replace me
parameters:
  body:
    a: 1
    b: 2
test:
  status: 200
  body:
    result: 3
\`\`\`

Press **Run** to execute the flow: the execution details of every step will
appear right below its block.
`;
