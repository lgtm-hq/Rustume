import { lazy, Suspense } from "solid-js";
import { Spinner } from "./Spinner";
import type { RichTextEditorProps } from "./RichTextEditor";

const RichTextEditor = lazy(() =>
  import("./RichTextEditor").then((module) => ({ default: module.RichTextEditor })),
);

export function LazyRichTextEditor(props: RichTextEditorProps) {
  return (
    <Suspense
      fallback={
        <div class="flex min-h-[120px] items-center justify-center rounded-md border border-border bg-surface">
          <Spinner class="w-4 h-4" />
        </div>
      }
    >
      <RichTextEditor {...props} />
    </Suspense>
  );
}

export type { RichTextEditorProps };
