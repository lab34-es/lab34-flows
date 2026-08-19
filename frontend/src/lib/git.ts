/**
 * Git decorations, the way an editor's file explorer draws them: a letter and
 * a colour next to a file, and the same colour on every folder above it.
 *
 * The backend reports each change once, against its path relative to the
 * context directory. The sidebar knows its files by a path relative to
 * `flows/` or `applications/`, so everything here takes a prefix and works
 * inside it.
 */

/** The order a folder resolves ties in: the loudest child wins its colour. */
const PRECEDENCE = ['conflicted', 'deleted', 'modified', 'renamed', 'added', 'untracked'];

export const GIT_STATUS = {
  untracked: { letter: 'U', label: 'Untracked', className: 'text-success' },
  added: { letter: 'A', label: 'Added', className: 'text-success' },
  modified: { letter: 'M', label: 'Modified', className: 'text-warning' },
  renamed: { letter: 'R', label: 'Renamed', className: 'text-info' },
  deleted: { letter: 'D', label: 'Deleted', className: 'text-destructive' },
  conflicted: { letter: '!', label: 'Conflicting', className: 'text-destructive' },
};

/**
 * What to draw for a status, or null for anything we do not recognise.
 * @param {string} status
 */
export const decorationFor = (status) => (status && GIT_STATUS[status]) || null;

/**
 * Join a prefix and a path the way the backend reports them.
 * @param {string} prefix - e.g. 'flows'
 * @param {string} relativePath - Path inside the prefix
 * @returns {string}
 */
const join = (prefix, relativePath) => {
  const parts = [prefix, relativePath].filter(Boolean);
  return parts.join('/');
};

/**
 * Index the changes of a context so a tree can be decorated in one pass:
 * exact paths for files, and every parent folder of every change so a
 * collapsed folder still shows that something inside it moved.
 *
 * @param {Array} changes - context.git.changes, as the API returns them
 * @returns {{files: Object, folders: Object}} path -> status
 */
export const indexChanges = (changes) => {
  const files = {};
  const folders = {};

  for (const change of changes || []) {
    const filePath = change?.contextPath;
    // A change outside the context directory has nothing to decorate
    if (!filePath) { continue; }

    files[filePath] = change.status;

    const segments = filePath.split('/');
    segments.pop();

    let current = '';
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      const existing = folders[current];
      if (!existing || PRECEDENCE.indexOf(change.status) < PRECEDENCE.indexOf(existing)) {
        folders[current] = change.status;
      }
    }
  }

  return { files, folders };
};

/**
 * A reader over an index, scoped to one of the context's subtrees.
 * @param {{files: Object, folders: Object}} index
 * @param {string} prefix - 'flows' or 'applications'
 */
export const scopedStatus = (index, prefix) => ({
  file: (relativePath) => index.files[join(prefix, relativePath)] || null,
  folder: (relativePath) => {
    const key = join(prefix, relativePath);
    return index.folders[key] || index.files[key] || null;
  },
});

/**
 * A one-line summary of how far the branch is from its remote, for a tooltip.
 * @param {Object} git - context.git
 * @returns {string}
 */
export const trackingLabel = (git) => {
  if (!git) { return ''; }
  if (!git.upstream) { return 'No upstream branch'; }
  if (!git.ahead && !git.behind) { return `Up to date with ${git.upstream}`; }

  const parts: string[] = [];
  if (git.behind) { parts.push(`${git.behind} to pull`); }
  if (git.ahead) { parts.push(`${git.ahead} to push`); }
  return `${parts.join(', ')} (${git.upstream})`;
};
