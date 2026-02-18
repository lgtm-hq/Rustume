interface ColumnControlsProps {
  /** Current number of columns (1-3). */
  columnCount: number;
  /** Called when the user picks a new column count. */
  onChange: (count: number) => void;
}

const PRESETS = [
  { count: 1, label: "1 Column", icon: "M4 4h16v16H4z" },
  {
    count: 2,
    label: "2 Columns",
    icon: "M4 4h7v16H4zM13 4h7v16h-7z",
  },
  {
    count: 3,
    label: "3 Columns",
    icon: "M4 4h4v16H4zM10 4h4v16h-4zM16 4h4v16h-4z",
  },
] as const;

export function ColumnControls(props: ColumnControlsProps) {
  return (
    <div class="flex items-center gap-1">
      {PRESETS.map((preset) => (
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono
            transition-colors border"
          classList={{
            "bg-accent/10 text-accent border-accent/30": props.columnCount === preset.count,
            "text-stone hover:text-ink hover:bg-surface border-transparent":
              props.columnCount !== preset.count,
          }}
          onClick={() => props.onChange(preset.count)}
          title={preset.label}
          aria-label={preset.label}
          aria-pressed={props.columnCount === preset.count}
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d={preset.icon}
            />
          </svg>
          <span class="hidden sm:inline">{preset.label}</span>
        </button>
      ))}
    </div>
  );
}
