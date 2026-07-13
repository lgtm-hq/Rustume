/** Build a screen-reader announcement for item reordering. */
export function reorderAnnouncement(itemTitle: string, newIndex: number, total: number): string {
  return `${itemTitle} moved to position ${newIndex + 1} of ${total}`;
}
