/**
 * URL of the notebook view for a flow tree node.
 */
export function flowUrl(node) {
  return `/flows/view?path=${encodeURIComponent(node.path)}`;
}

/**
 * URL of the base view for a folder of the flows tree. An empty path is the
 * flows directory itself.
 */
export function folderUrl(relativePath) {
  return `/flows/folder?path=${encodeURIComponent(relativePath || '')}`;
}
