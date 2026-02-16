import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";

export interface RichTextEditorProps {
  label?: string;
  description?: string;
  error?: string;
  placeholder?: string;
  value?: string;
  onInput?: (html: string) => void;
  disabled?: boolean;
  class?: string;
}

export function RichTextEditor(props: RichTextEditorProps) {
  const [editorEl, setEditorEl] = createSignal<HTMLDivElement>();
  const [editor, setEditor] = createSignal<Editor | null>(null);
  const [isFocused, setIsFocused] = createSignal(false);
  // Incremented on each TipTap transaction to trigger Solid reactivity for toolbar active state.
  const [txVersion, setTxVersion] = createSignal(0);

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
          placeholder: props.placeholder || "",
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

    setEditor(ed);
  });

  // Sync external value changes
  createEffect(() => {
    const ed = editor();
    const val = props.value;
    if (ed && val !== undefined && ed.getHTML() !== val) {
      ed.commands.setContent(val, { emitUpdate: false });
    }
  });

  // Sync disabled state
  createEffect(() => {
    const ed = editor();
    if (ed) {
      ed.setEditable(!props.disabled);
    }
  });

  // Sync placeholder changes
  createEffect(() => {
    const ed = editor();
    const placeholder = props.placeholder || "";
    if (ed) {
      const ext = ed.extensionManager.extensions.find((e) => e.name === "placeholder");
      if (ext) {
        ext.options.placeholder = placeholder;
        ed.view.dispatch(ed.state.tr);
      }
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
      // Not a valid absolute URL — try prepending https://
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
    txVersion(); // Subscribe to transaction changes for Solid reactivity
    return editor()?.isActive(name) ?? false;
  };

  return (
    <div class={`flex flex-col gap-1.5 ${props.class || ""}`}>
      <Show when={props.label}>
        <label class="font-mono text-xs uppercase tracking-wider text-stone">{props.label}</label>
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
        {/* Toolbar */}
        <div class="flex items-center gap-0.5 border-b border-border px-2 py-1">
          <ToolbarButton
            active={isActive("bold")}
            onClick={toggleBold}
            disabled={props.disabled}
            title="Bold"
          >
            <span class="font-bold">B</span>
          </ToolbarButton>
          <ToolbarButton
            active={isActive("italic")}
            onClick={toggleItalic}
            disabled={props.disabled}
            title="Italic"
          >
            <span class="italic">I</span>
          </ToolbarButton>
          <ToolbarButton
            active={isActive("underline")}
            onClick={toggleUnderline}
            disabled={props.disabled}
            title="Underline"
          >
            <span class="underline">U</span>
          </ToolbarButton>

          <div class="mx-1 h-4 w-px bg-border" />

          <ToolbarButton
            active={isActive("link")}
            onClick={setLink}
            disabled={props.disabled}
            title="Link"
          >
            <svg
              class="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </ToolbarButton>

          <div class="mx-1 h-4 w-px bg-border" />

          <ToolbarButton
            active={isActive("bulletList")}
            onClick={toggleBulletList}
            disabled={props.disabled}
            title="Bullet List"
          >
            <svg
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
          </ToolbarButton>
          <ToolbarButton
            active={isActive("orderedList")}
            onClick={toggleOrderedList}
            disabled={props.disabled}
            title="Ordered List"
          >
            <svg
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
          </ToolbarButton>
        </div>

        {/* Editor area */}
        <div
          ref={setEditorEl}
          class="rich-text-editor px-3 py-2 min-h-[100px] font-body text-ink"
        />
      </div>

      <Show when={props.description && !props.error}>
        <p class="text-xs text-stone">{props.description}</p>
      </Show>

      <Show when={props.error}>
        <p class="text-xs text-red-600">{props.error}</p>
      </Show>
    </div>
  );
}

interface ToolbarButtonProps {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: any;
}

function ToolbarButton(props: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={props.title}
      disabled={props.disabled}
      onMouseDown={(e) => {
        e.preventDefault(); // Prevent focus loss from editor
        props.onClick();
      }}
      class={`flex items-center justify-center h-7 w-7 rounded text-xs transition-colors
        ${props.active ? "bg-accent/20 text-accent" : "text-stone hover:bg-surface hover:text-ink"}
        ${props.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {props.children}
    </button>
  );
}
