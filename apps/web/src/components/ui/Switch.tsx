import { Switch as KobalteSwitch } from "@kobalte/core/switch";
import { Show } from "solid-js";

export interface SwitchProps {
  label?: string;
  description?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  class?: string;
}

export function Switch(props: SwitchProps) {
  return (
    <KobalteSwitch
      class={`flex items-center justify-between gap-4 ${props.class || ""}`}
      checked={props.checked}
      onChange={props.onChange}
      disabled={props.disabled}
    >
      <Show when={props.label || props.description}>
        <div class="flex flex-col">
          <Show when={props.label}>
            <KobalteSwitch.Label class="font-body text-sm text-ink cursor-pointer">
              {props.label}
            </KobalteSwitch.Label>
          </Show>
          <Show when={props.description}>
            <KobalteSwitch.Description class="text-xs text-stone">
              {props.description}
            </KobalteSwitch.Description>
          </Show>
        </div>
      </Show>

      <KobalteSwitch.Input class="peer" />
      <KobalteSwitch.Control
        class="w-10 h-6 bg-border rounded-full relative transition-colors duration-150
          data-[checked]:bg-accent
          peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2"
      >
        <KobalteSwitch.Thumb
          class="block w-5 h-5 bg-paper rounded-full shadow-soft
            translate-x-0.5 transition-transform duration-150
            data-[checked]:translate-x-[18px]"
        />
      </KobalteSwitch.Control>
    </KobalteSwitch>
  );
}
