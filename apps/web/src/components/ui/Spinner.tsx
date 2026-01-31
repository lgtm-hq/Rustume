export interface SpinnerProps {
  class?: string;
}

export function Spinner(props: SpinnerProps) {
  return (
    <svg class={`animate-spin ${props.class ?? "w-6 h-6"}`} viewBox="0 0 24 24">
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
        fill="none"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
