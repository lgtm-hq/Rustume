import type { Page } from "@playwright/test";

/**
 * A node of the browser's accessibility tree, reduced to what the structural
 * assertions read.
 */
export interface AxNode {
  /** Computed ARIA role, e.g. `listbox`, `group`, `option`, `generic`. */
  role: string;
  /** Computed accessible name, empty when the node has none. */
  name: string;
  /** Children with the ignored nodes spliced out (see `readAxTree`). */
  children: AxNode[];
}

/** The subset of CDP's `AXNode` payload these helpers consume. */
interface RawAxNode {
  nodeId: string;
  parentId?: string;
  ignored?: boolean;
  role?: { value?: unknown };
  name?: { value?: unknown };
  childIds?: string[];
}

function stringValue(property: { value?: unknown } | undefined): string {
  return typeof property?.value === "string" ? property.value : "";
}

/**
 * Reads Chromium's accessibility tree for the page.
 *
 * Deliberately not `expect(locator).toMatchAriaSnapshot()`: aria snapshots
 * prune roleless containers, so a `listbox` that owns a bare `div` of options
 * snapshots identically to one that owns the options directly — exactly the
 * defect this file has to be able to see (Rustume#675). The CDP tree keeps
 * every node, including the generics.
 *
 * Nodes the browser ignores (a `role="presentation"` wrapper, a decorative
 * span) are spliced out and replaced by their children, which is how assistive
 * technology walks the tree — so what is left is the ownership chain a screen
 * reader actually reports.
 *
 * Chromium-only: callers must guard on `browserName`.
 */
export async function readAxTree(page: Page): Promise<AxNode> {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Accessibility.enable");
    const { nodes } = (await session.send("Accessibility.getFullAXTree")) as {
      nodes: RawAxNode[];
    };
    const byId = new Map(nodes.map((node) => [node.nodeId, node]));
    // The document node, found by structure rather than by position: CDP does
    // not promise the root comes first in the array.
    const root =
      nodes.find((node) => !node.parentId) ??
      nodes.find((node) => stringValue(node.role) === "RootWebArea");
    if (!root) throw new Error("Chromium returned no root accessibility node");

    const effectiveChildren = (node: RawAxNode): AxNode[] =>
      (node.childIds ?? []).flatMap((childId) => {
        const child = byId.get(childId);
        if (!child) return [];
        if (child.ignored) return effectiveChildren(child);
        return [
          {
            role: stringValue(child.role),
            name: stringValue(child.name),
            children: effectiveChildren(child),
          },
        ];
      });

    return {
      role: stringValue(root.role),
      name: stringValue(root.name),
      children: effectiveChildren(root),
    };
  } finally {
    await session.detach();
  }
}

/** Depth-first search for the first node with `role` and accessible `name`. */
export function findAxNode(tree: AxNode, role: string, name: string): AxNode | undefined {
  if (tree.role === role && tree.name === name) return tree;
  for (const child of tree.children) {
    const match = findAxNode(child, role, name);
    if (match) return match;
  }
  return undefined;
}
