import { TextField } from "@kobalte/core/text-field";
import { splitProps, type JSX, Show } from "solid-js";

export interface InputProps {
  label?: string;
  description?: string;
  error?: string;
  placeholder?: string;
  value?: string;
  onInput?: (value: string) => void;
  onChange?: (value: string) => void;
  type?: "text" | "email" | "tel" | "url" | "password";
  disabled?: boolean;
  required?: boolean;
  class?: string;
  inputClass?: string;
}

export function Input(props: InputProps) {
  const [local, others] = splitProps(props, [
    "label",
    "description",
    "error",
    "placeholder",
    "value",
    "onInput",
    "onChange",
    "type",
    "disabled",
    "required",
    "class",
    "inputClass",
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

      <TextField.Input
        type={local.type || "text"}
        placeholder={local.placeholder}
        onInput={(e) => local.onInput?.(e.currentTarget.value)}
        class={`w-full px-3 py-2 bg-paper border border-border rounded-lg font-body text-ink
          placeholder:text-stone/50
          focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent
          disabled:bg-surface disabled:text-stone disabled:cursor-not-allowed
          transition-colors duration-150
          ${local.error ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}
          ${local.inputClass || ""}`}
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
