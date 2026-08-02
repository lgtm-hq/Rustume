/**
 * Rendered markdown for the sheet's rich-text fields.
 *
 * The sheet is the rendered document (#785), so markdown draws as formatted
 * text: paragraphs, lists, bold, italic. Links render as accent-coloured text
 * rather than anchors — the sheet is a document surface, not a navigation
 * surface, and an anchor inside a click-to-edit field would compete with the
 * field's own click target.
 *
 * Parsing lives in `lib/markdownBlocks.ts`; this component only draws blocks.
 */

import { For, Show, type JSX } from "solid-js";
import { parseMarkdownBlocks, type MarkdownInline } from "../../lib/markdownBlocks";

function Inlines(props: { inlines: MarkdownInline[] }): JSX.Element {
  return (
    <For each={props.inlines}>
      {(inline) => {
        switch (inline.type) {
          case "strong":
            return <strong>{inline.text}</strong>;
          case "em":
            return <em>{inline.text}</em>;
          case "link":
            return <span class="doc-sheet__md-link">{inline.text}</span>;
          default:
            return inline.text;
        }
      }}
    </For>
  );
}

function Lines(props: { lines: MarkdownInline[][] }): JSX.Element {
  return (
    <For each={props.lines}>
      {(line, index) => (
        <>
          <Show when={index() > 0}>
            <br />
          </Show>
          <Inlines inlines={line} />
        </>
      )}
    </For>
  );
}

/** The formatted view of one markdown value. */
export function MarkdownView(props: { value: string }): JSX.Element {
  return (
    <For each={parseMarkdownBlocks(props.value)}>
      {(block) => {
        if (block.type === "list") {
          const items = (
            <For each={block.items}>
              {(item) => (
                <li>
                  <Inlines inlines={item} />
                </li>
              )}
            </For>
          );
          return block.ordered ? (
            <ol class="doc-sheet__md-list doc-sheet__md-list--ordered">{items}</ol>
          ) : (
            <ul class="doc-sheet__md-list">{items}</ul>
          );
        }
        return (
          <p class="doc-sheet__md-paragraph">
            <Lines lines={block.lines} />
          </p>
        );
      }}
    </For>
  );
}
