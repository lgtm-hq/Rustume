/**
 * Plain-text coordinates for the armed `LiveText` field.
 *
 * An armed field is a `contenteditable="plaintext-only"` element, so its
 * content is text nodes with the occasional `<br>` a browser leaves behind for
 * a line break. These helpers give that content one consistent coordinate
 * space — the concatenated text with `<br>` as `\n` — so the markdown commands
 * in `markdown.ts`, which are pure text-in/text-out, can run over a live DOM
 * selection exactly as they run over a textarea's.
 *
 * Every function walks the same way in the same order; that shared walk is
 * what keeps `editableText`, `selectionOffsets` and `setSelectionOffsets`
 * agreeing on where offset N is.
 */

/** Whether `node` contributes a line break rather than text. */
function isLineBreak(node: Node): boolean {
  return node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === "BR";
}

/**
 * Walk `root`'s content in document order.
 *
 * `visit` receives each text node (with its text) and each `<br>` (with
 * `"\n"`), plus the absolute offset where that piece starts. Returning `true`
 * stops the walk early.
 */
function walk(root: Node, visit: (node: Node, text: string, at: number) => boolean): number {
  let at = 0;
  const step = (node: Node): boolean => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = (child as Text).data;
        if (visit(child, text, at)) return true;
        at += text.length;
        continue;
      }
      if (isLineBreak(child)) {
        if (visit(child, "\n", at)) return true;
        at += 1;
        continue;
      }
      if (step(child)) return true;
    }
    return false;
  };
  step(root);
  return at;
}

/** The field's content as plain text, with `<br>` as `\n`. */
export function editableText(root: Node): string {
  let text = "";
  walk(root, (_node, piece) => {
    text += piece;
    return false;
  });
  return text;
}

/** Absolute offset of `(node, offsetInNode)` in `root`'s text, or `null`. */
function absoluteOffset(root: Node, node: Node, offsetInNode: number): number | null {
  // An element-anchored position (offset counts child nodes) resolves to the
  // start of the child it points at — or the very end when it points past the
  // last child.
  if (node.nodeType !== Node.TEXT_NODE) {
    const children = node.childNodes;
    const target = offsetInNode < children.length ? children[offsetInNode] : null;
    if (target === null) {
      if (node === root || root.contains(node)) return editableText(root).length;
      return null;
    }
    let found: number | null = null;
    walk(root, (each, _piece, at) => {
      if (each === target || (each.nodeType === Node.TEXT_NODE && target.contains(each))) {
        found = at;
        return true;
      }
      return false;
    });
    return found;
  }

  let found: number | null = null;
  walk(root, (each, _piece, at) => {
    if (each === node) {
      found = at + offsetInNode;
      return true;
    }
    return false;
  });
  return found;
}

/**
 * The current selection as offsets into `root`'s text, or `null` when the
 * selection does not sit inside `root`.
 */
export function selectionOffsets(root: Node): { start: number; end: number } | null {
  const selection = root.ownerDocument?.getSelection?.() ?? null;
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const start = absoluteOffset(root, range.startContainer, range.startOffset);
  const end = absoluteOffset(root, range.endContainer, range.endOffset);
  if (start === null || end === null) return null;
  return start <= end ? { start, end } : { start: end, end: start };
}

/** The DOM position of absolute `offset`, clamped to the content's end. */
function resolvePosition(root: Node, offset: number): { node: Node; offset: number } {
  let resolved: { node: Node; offset: number } | null = null;
  let last: { node: Node; length: number } | null = null;
  walk(root, (node, piece, at) => {
    last = { node, length: piece.length };
    if (offset >= at && offset <= at + piece.length) {
      resolved = isLineBreak(node)
        ? { node: root, offset: indexInParentChain(root, node) + (offset > at ? 1 : 0) }
        : { node, offset: offset - at };
      return true;
    }
    return false;
  });
  if (resolved) return resolved;
  if (last !== null) {
    const { node, length } = last as { node: Node; length: number };
    return isLineBreak(node)
      ? { node: root, offset: root.childNodes.length }
      : { node, offset: length };
  }
  return { node: root, offset: 0 };
}

/** `node`'s child index under `root`'s direct children (for `<br>` anchors). */
function indexInParentChain(root: Node, node: Node): number {
  let child: Node = node;
  while (child.parentNode !== null && child.parentNode !== root) child = child.parentNode;
  return [...root.childNodes].indexOf(child as ChildNode);
}

/** Select `[start, end]` of `root`'s text (a caret when they are equal). */
export function setSelectionOffsets(root: Node, start: number, end: number): void {
  const document = root.ownerDocument;
  const selection = document?.getSelection?.() ?? null;
  if (!document || !selection) return;
  const from = resolvePosition(root, Math.min(start, end));
  const to = resolvePosition(root, Math.max(start, end));
  const range = document.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Place the caret at the pointer position that armed the field, per spec
 * §1.11 — falling back to a caret at the end. Never select-all.
 */
export function placeCaretAtPoint(root: HTMLElement, point: { x: number; y: number } | null): void {
  const document = root.ownerDocument;
  const selection = document.getSelection?.() ?? null;
  if (!selection) return;

  const caretRange = ((): Range | null => {
    if (!point) return null;
    // Chromium and WebKit expose `caretRangeFromPoint`; Firefox exposes the
    // standard `caretPositionFromPoint`.
    const byRange = (
      document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }
    ).caretRangeFromPoint;
    if (byRange) return byRange.call(document, point.x, point.y);
    const byPosition = (
      document as Document & {
        caretPositionFromPoint?: (
          x: number,
          y: number,
        ) => { offsetNode: Node; offset: number } | null;
      }
    ).caretPositionFromPoint;
    const position = byPosition?.call(document, point.x, point.y) ?? null;
    if (!position) return null;
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  })();

  if (caretRange && root.contains(caretRange.startContainer)) {
    selection.removeAllRanges();
    selection.addRange(caretRange);
    return;
  }

  const end = document.createRange();
  end.selectNodeContents(root);
  end.collapse(false);
  selection.removeAllRanges();
  selection.addRange(end);
}
