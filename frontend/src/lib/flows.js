/**
 * URL of the notebook view for a flow tree node.
 */
export function flowUrl(node) {
  return `/flows/view?path=${encodeURIComponent(node.path)}`;
}
