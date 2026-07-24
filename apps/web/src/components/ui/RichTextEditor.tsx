import { createEffect, createSignal, For, onCleanup, onMount, Show, type JSX } from "solid-js";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Modal } from "./Modal";

export interface RichTextEditorProps {
  label?: string;
  description?: string;
  error?: string;
  placeholder?: string;
  value?: string;
  onInput?: (html: string) => void;
  disabled?: boolean;
  class?: string;
  /** Hide the expand-to-fullscreen control (used inside the fullscreen modal itself). */
  hideExpand?: boolean;
}

let editorIdCounter = 0;

interface ToolbarAction {
  title: string;
  active: () => boolean;
  onClick: () => void;
  children: JSX.Element;
}

export function RichTextEditor(props: RichTextEditorProps) {
  const editorId = `rte-${++editorIdCounter}`;
  const labelId = `${editorId}-label`;
  const [editorEl, setEditorEl] = createSignal<HTMLDivElement>();
  const [editor, setEditor] = createSignal<Editor | null>(null);
  const [isFocused, setIsFocused] = createSignal(false);
  const [txVersion, setTxVersion] = createSignal(0);
  const [expanded, setExpanded] = createSignal(false);

  onMount(() => {
    const el = editorEl();
    if (!el) return;
    const ed = new Editor({
      element: el,
      extensions: [
        StarterKit.configure({
          heading: false,
          codeBlock: false,
          code: false,
          blockquote: false,
          horizontalRule: false,
          strike: false,
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          HTMLAttributes: { rel: "noopener noreferrer nofollow" },
        }),
        Placeholder.configure({
          placeholder: () => props.placeholder || "",
        }),
      ],
      content: props.value || "",
      editable: !props.disabled,
      onUpdate: ({ editor: e }) => {
        props.onInput?.(e.getHTML());
      },
      onTransaction: () => setTxVersion((v) => v + 1),
      onFocus: () => setIsFocused(true),
      onBlur: () => setIsFocused(false),
    });

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !ed.isFocused || props.disabled) return;

      const handled = event.shiftKey
        ? ed.chain().focus().liftListItem("listItem").run()
        : ed.isActive("listItem")
          ? ed.chain().focus().sinkListItem("listItem").run()
          : ed.chain().focus().toggleBulletList().run();

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    el.addEventListener("keydown", handleTabKey, true);
    onCleanup(() => {
      el.removeEventListener("keydown", handleTabKey, true);
    });

    setEditor(ed);
  });

  createEffect(() => {
    const ed = editor();
    const val = props.value;
    if (ed && val !== undefined && ed.getHTML() !== val) {
      ed.commands.setContent(val, { emitUpdate: false });
    }
  });

  createEffect(() => {
    const ed = editor();
    if (ed) {
      ed.setEditable(!props.disabled);
    }
  });

  onCleanup(() => {
    editor()?.destroy();
  });

  const toggleBold = () => editor()?.chain().focus().toggleBold().run();
  const toggleItalic = () => editor()?.chain().focus().toggleItalic().run();
  const toggleUnderline = () => editor()?.chain().focus().toggleUnderline().run();
  const toggleBulletList = () => editor()?.chain().focus().toggleBulletList().run();
  const toggleOrderedList = () => editor()?.chain().focus().toggleOrderedList().run();

  const setLink = () => {
    const ed = editor();
    if (!ed) return;

    if (ed.isActive("link")) {
      ed.chain().focus().unsetLink().run();
      return;
    }

    const input = window.prompt("URL:");
    if (!input) return;

    const trimmed = input.trim();
    const ALLOWED_PROTOCOLS = ["http:", "https:", "mailto:", "tel:"];
    try {
      const parsed = new URL(trimmed);
      if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) return;
      ed.chain().focus().setLink({ href: parsed.href }).run();
    } catch {
      try {
        const withProtocol = new URL("https://" + trimmed);
        if (!ALLOWED_PROTOCOLS.includes(withProtocol.protocol)) return;
        ed.chain().focus().setLink({ href: withProtocol.href }).run();
      } catch {
        // Invalid URL, ignore
      }
    }
  };

  const isActive = (name: string) => {
    txVersion();
    return editor()?.isActive(name) ?? false;
  };

  const toolbarActions = (): ToolbarAction[] => [
    {
      title: "Bold",
      active: () => isActive("bold"),
      onClick: toggleBold,
      children: <span class="font-bold">B</span>,
    },
    {
      title: "Italic",
      active: () => isActive("italic"),
      onClick: toggleItalic,
      children: <span class="italic">I</span>,
    },
    {
      title: "Underline",
      active: () => isActive("underline"),
      onClick: toggleUnderline,
      children: <span class="underline">U</span>,
    },
    {
      title: "Link",
      active: () => isActive("link"),
      onClick: setLink,
      children: (
        <svg
          aria-hidden="true"
          class="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      ),
    },
    {
      title: "Bullet List",
      active: () => isActive("bulletList"),
      onClick: toggleBulletList,
      children: (
        <svg
          aria-hidden="true"
          class="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <circle cx="3" cy="6" r="1" fill="currentColor" />
          <circle cx="3" cy="12" r="1" fill="currentColor" />
          <circle cx="3" cy="18" r="1" fill="currentColor" />
        </svg>
      ),
    },
    {
      title: "Ordered List",
      active: () => isActive("orderedList"),
      onClick: toggleOrderedList,
      children: (
        <svg
          aria-hidden="true"
          class="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <line x1="10" y1="6" x2="21" y2="6" />
          <line x1="10" y1="12" x2="21" y2="12" />
          <line x1="10" y1="18" x2="21" y2="18" />
          <text
            x="1"
            y="8"
            font-size="8"
            fill="currentColor"
            stroke="none"
            font-family="sans-serif"
          >
            1
          </text>
          <text
            x="1"
            y="14"
            font-size="8"
            fill="currentColor"
            stroke="none"
            font-family="sans-serif"
          >
            2
          </text>
          <text
            x="1"
            y="20"
            font-size="8"
            fill="currentColor"
            stroke="none"
            font-family="sans-serif"
          >
            3
          </text>
        </svg>
      ),
    },
  ];

  return (
    <div class={`flex flex-col gap-1.5 ${props.class || ""}`}>
      <Show when={props.label}>
        <span id={labelId} class="font-mono text-xs uppercase tracking-wider text-stone">
          {props.label}
        </span>
      </Show>

      <div
        class={`rounded-lg border bg-paper transition-colors duration-150 ${
          props.error
            ? "border-red-500"
            : isFocused()
              ? "border-accent ring-1 ring-accent"
              : "border-border"
        } ${props.disabled ? "bg-surface text-stone cursor-not-allowed opacity-60" : ""}`}
      >
        <div class="flex items-center justify-between gap-2 border-b border-border px-1">
          <FormattingToolbar actions={toolbarActions()} disabled={props.disabled} />
          <Show when={!props.hideExpand}>
            <button
              type="button"
              class="focus-ring mr-1 rounded p-1.5 text-stone hover:bg-surface hover:text-ink
                disabled:opacity-40"
              aria-label="Expand editor"
              title="Expand editor"
              disabled={props.disabled}
              onClick={() => setExpanded(true)}
            >
              <svg
                class="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4"
                />
              </svg>
            </button>
          </Show>
        </div>

        <div
          ref={setEditorEl}
          class={`rich-text-editor px-3 py-2 font-body text-ink ${
            props.hideExpand ? "min-h-[50vh]" : "min-h-[100px]"
          }`}
        />
      </div>

      <Show when={props.description && !props.error}>
        <p class="text-xs text-stone">{props.description}</p>
      </Show>

      <Show when={props.error}>
        <p class="text-xs text-red-600">{props.error}</p>
      </Show>

      <Show when={expanded() && !props.hideExpand}>
        <Modal
          open={expanded()}
          onOpenChange={setExpanded}
          title={props.label || "Edit content"}
          description="Full-screen editing — changes sync back when you close."
          size="2xl"
        >
          <RichTextEditor
            hideExpand
            label={undefined}
            placeholder={props.placeholder}
            value={props.value}
            onInput={props.onInput}
            disabled={props.disabled}
          />
          <div class="mt-4 flex justify-end">
            <button
              type="button"
              class="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper hover:opacity-90"
              onClick={() => setExpanded(false)}
            >
              Done
            </button>
          </div>
        </Modal>
      </Show>
    </div>
  );
}

interface FormattingToolbarProps {
  actions: ToolbarAction[];
  disabled?: boolean;
}

function FormattingToolbar(props: FormattingToolbarProps) {
  const [focusedIndex, setFocusedIndex] = createSignal(0);
  let buttonRefs: HTMLButtonElement[] = [];

  const focusButton = (index: number) => {
    const count = props.actions.length;
    if (count === 0) return;
    const wrapped = ((index % count) + count) % count;
    setFocusedIndex(wrapped);
    buttonRefs[wrapped]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const count = props.actions.length;
    if (count === 0) return;

    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusButton(focusedIndex() + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusButton(focusedIndex() - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusButton(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusButton(count - 1);
    }
  };

  const handleFocusIn = (event: FocusEvent) => {
    const target = event.target as HTMLElement;
    const index = buttonRefs.findIndex((ref) => ref === target);
    if (index >= 0) {
      setFocusedIndex(index);
    }
  };

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      class="flex items-center gap-0.5 border-b border-border px-2 py-1"
      onKeyDown={handleKeyDown}
      onFocusIn={handleFocusIn}
    >
      <For each={props.actions}>
        {(action, index) => (
          <>
            <Show when={index() === 3 || index() === 4}>
              <div class="mx-1 h-4 w-px bg-border" aria-hidden="true" />
            </Show>
            <ToolbarButton
              ref={(el) => {
                buttonRefs[index()] = el;
              }}
              active={action.active()}
              onClick={action.onClick}
              disabled={props.disabled}
              title={action.title}
              tabIndex={index() === focusedIndex() ? 0 : -1}
            >
              {action.children}
            </ToolbarButton>
          </>
        )}
      </For>
    </div>
  );
}

interface ToolbarButtonProps {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title: string;
  tabIndex: number;
  ref?: (el: HTMLButtonElement) => void;
  children: JSX.Element;
}

function ToolbarButton(props: ToolbarButtonProps) {
  const activateWithMouse = (event: MouseEvent) => {
    event.preventDefault();
    props.onClick();
  };

  return (
    <button
      ref={props.ref}
      type="button"
      title={props.title}
      aria-label={props.title}
      aria-pressed={props.active}
      disabled={props.disabled}
      tabIndex={props.tabIndex}
      onMouseDown={activateWithMouse}
      onClick={(event) => {
        // Keyboard activation fires click without mousedown; mouse is handled above.
        if (event.detail === 0) {
          props.onClick();
        }
      }}
      class={`focus-ring flex items-center justify-center h-7 w-7 rounded text-xs transition-colors
        ${props.active ? "bg-accent/20 text-accent" : "text-stone hover:bg-surface hover:text-ink"}
        ${props.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {props.children}
    </button>
  );
}
