import { useNavigate } from "@solidjs/router";
import { Button } from "../components/ui";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <main class="min-h-[calc(100vh-4rem)] bg-paper px-6 py-16 text-ink">
      <section class="mx-auto flex max-w-3xl flex-col items-start gap-8 rounded-3xl border border-border/60 bg-surface/70 p-8 shadow-card md:p-12">
        <div class="space-y-4">
          <p class="font-mono text-sm uppercase tracking-[0.35em] text-stone">404</p>
          <h1 class="font-display text-4xl font-semibold leading-tight md:text-5xl">
            This page is off the page.
          </h1>
          <p class="max-w-2xl text-lg leading-8 text-stone">
            The route you opened does not exist in Rustume. Your saved resumes are still available
            from the home screen.
          </p>
        </div>

        <Button size="lg" onClick={() => navigate("/", { replace: true })}>
          Back to resumes
        </Button>
      </section>
    </main>
  );
}
