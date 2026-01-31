import { TextField } from "@kobalte/core/text-field";
import { splitProps, Show } from "solid-js";

export interface TextAreaProps {
  label?: string;
  description?: string;
  error?: string;
  placeholder?: string;
  value?: string;
  onInput?: (value: string) => void;
  onChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  rows?: number;
  class?: string;
}

export function TextArea(props: TextAreaProps) {
  const [local, others] = splitProps(props, [
    "label",
    "description",
    "error",
    "placeholder",
    "value",
    "onInput",
    "onChange",
    "disabled",
    "required",
    "rows",
    "class",
  ]);

  return (
    <TextField
      class={`flex flex-col gap-1.5 ${local.class || ""}`}
      value={local.value}
      onChange={local.onChange}
      disabled={local.disabled}
      validationState={local.error ? "invalid" : "valid"}
    >
      <Show when={local.label}>
        <TextField.Label class="font-mono text-xs uppercase tracking-wider text-stone">
          {local.label}
          {local.required && <span class="text-accent ml-0.5">*</span>}
        </TextField.Label>
      </Show>

      <TextField.TextArea
        placeholder={local.placeholder}
        rows={local.rows || 4}
        onInput={(e) => local.onInput?.(e.currentTarget.value)}
        class={`w-full px-3 py-2 bg-paper border border-border rounded-lg font-body text-ink resize-y
          placeholder:text-stone/50
          focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent
          disabled:bg-surface disabled:text-stone disabled:cursor-not-allowed
          transition-colors duration-150
          ${local.error ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
      />

      <Show when={local.description && !local.error}>
        <TextField.Description class="text-xs text-stone">
          {local.description}
        </TextField.Description>
      </Show>

      <Show when={local.error}>
        <TextField.ErrorMessage class="text-xs text-red-600">
          {local.error}
        </TextField.ErrorMessage>
      </Show>
    </TextField>
  );
}
