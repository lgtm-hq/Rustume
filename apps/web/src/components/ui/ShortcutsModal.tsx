import { For } from "solid-js";
import { Modal } from "./Modal";
import { formatShortcut, type Shortcut } from "../../hooks/useHotkeys";
import { uiStore } from "../../stores/ui";

interface ShortcutsModalProps {
  shortcuts: Shortcut[];
}

export function ShortcutsModal(props: ShortcutsModalProps) {
  const { store: ui, closeModal } = uiStore;

  const grouped = () => {
    const map = new Map<string, Shortcut[]>();
    for (const s of props.shortcuts) {
      const list = map.get(s.category) || [];
      list.push(s);
      map.set(s.category, list);
    }
    return map;
  };

  return (
    <Modal
      open={ui.modal === "shortcuts"}
      onOpenChange={(open) => !open && closeModal()}
      title="Keyboard Shortcuts"
      size="md"
    >
      <div class="space-y-5 max-h-80 overflow-y-auto -mx-1 px-1">
        <For each={[...grouped().entries()]}>
          {([category, items]) => (
            <div>
              <h3 class="text-xs font-mono uppercase tracking-wider text-stone mb-2">{category}</h3>
              <div class="space-y-1">
                <For each={items}>
                  {(shortcut) => (
                    <div class="flex items-center justify-between py-1.5 px-2 rounded hover:bg-surface">
                      <span class="text-sm text-ink">{shortcut.label}</span>
                      <kbd class="text-xs font-mono bg-surface border border-border rounded px-2 py-0.5 text-stone">
                        {formatShortcut(shortcut)}
                      </kbd>
                    </div>
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>
    </Modal>
  );
}
