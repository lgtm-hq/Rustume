import { type ParentComponent, type JSX, children, createSignal, Show } from "solid-js";

export interface SplitPaneProps {
  left: JSX.Element;
  right: JSX.Element;
  defaultRatio?: number;
  minLeft?: number;
  minRight?: number;
  showLeft?: boolean;
  showRight?: boolean;
}

export const SplitPane: ParentComponent<SplitPaneProps> = (props) => {
  const [ratio, setRatio] = createSignal(props.defaultRatio ?? 0.5);
  const [isDragging, setIsDragging] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;

  // Memoize slot content so reactive prop getters aren't re-invoked on every
  // layout read (which would remount pane trees passed as JSX props).
  const leftContent = children(() => props.left);
  const rightContent = children(() => props.right);

  const showLeft = () => props.showLeft ?? true;
  const showRight = () => props.showRight ?? true;
  const minLeft = () => props.minLeft ?? 320;
  const minRight = () => props.minRight ?? 400;

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef) return;

      const rect = containerRef.getBoundingClientRect();
      const x = e.clientX - rect.left;
      let newRatio = x / rect.width;

      // Enforce minimum widths
      const containerWidth = rect.width;
      const minLeftRatio = minLeft() / containerWidth;
      const maxLeftRatio = 1 - minRight() / containerWidth;

      newRatio = Math.max(minLeftRatio, Math.min(maxLeftRatio, newRatio));
      setRatio(newRatio);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      ref={(el) => (containerRef = el)}
      class="flex h-full"
      classList={{ "select-none": isDragging() }}
    >
      {/* Left Pane */}
      <Show when={showLeft()}>
        <div
          class="h-full overflow-auto"
          style={{
            width: showRight() ? `${ratio() * 100}%` : "100%",
          }}
        >
          {leftContent()}
        </div>
      </Show>

      {/* Divider */}
      <Show when={showLeft() && showRight()}>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize editor and preview panels"
          aria-valuenow={Math.round(ratio() * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          class="w-1 bg-border hover:bg-accent cursor-col-resize
            transition-colors duration-150 flex-shrink-0 relative group"
          classList={{ "bg-accent": isDragging() }}
          onMouseDown={handleMouseDown}
        >
          <div
            class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
              w-4 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100
              transition-opacity"
          >
            <div class="w-1 h-6 flex flex-col justify-center gap-1">
              <div class="w-full h-1 bg-stone/30 rounded-full" />
              <div class="w-full h-1 bg-stone/30 rounded-full" />
              <div class="w-full h-1 bg-stone/30 rounded-full" />
            </div>
          </div>
        </div>
      </Show>

      {/* Right Pane */}
      <Show when={showRight()}>
        <div
          class="h-full overflow-auto"
          style={{
            width: showLeft() ? `${(1 - ratio()) * 100}%` : "100%",
          }}
        >
          {rightContent()}
        </div>
      </Show>
    </div>
  );
};
