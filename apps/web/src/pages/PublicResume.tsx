import { createSignal, onMount, Show, Suspense } from "solid-js";
import { useParams } from "@solidjs/router";
import { lazy } from "solid-js";
import { fetchPublicResume } from "../api/sharing";
import { ApiError } from "../api/client";
import { Spinner } from "../components/ui";
import { StatusPage } from "../components/errors/StatusPage";
import { validateResumeData } from "../stores/resume";
import type { ResumeData } from "../wasm/types";

const Preview = lazy(() =>
  import("../components/preview").then((module) => ({ default: module.Preview })),
);

function PublicNotFoundIcon() {
  return (
    <svg
      class="h-8 w-8 text-accent"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.75"
        d="M8 4h8l3 4v11a1 1 0 01-1 1H6a1 1 0 01-1-1V5a1 1 0 011-1h2z"
      />
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M9 12h6" />
    </svg>
  );
}

export default function PublicResume() {
  const params = useParams<{ slug: string }>();
  const [resume, setResume] = createSignal<ResumeData | null>(null);
  const [title, setTitle] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [notFound, setNotFound] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    const slug = params.slug;
    if (!slug) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setNotFound(false);
    setError(null);

    try {
      const row = await fetchPublicResume(slug);
      setTitle(row.title);
      setResume(validateResumeData(row.data, row.id));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setNotFound(true);
      } else {
        console.error("Failed to load public resume:", e);
        setError(e instanceof Error ? e.message : "Failed to load resume");
      }
    } finally {
      setIsLoading(false);
    }
  });

  return (
    <Show
      when={!isLoading()}
      fallback={
        <div class="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
          <Spinner class="h-8 w-8 text-accent" ariaLabel="Loading resume" />
        </div>
      }
    >
      <Show
        when={!notFound() && !error() && resume()}
        fallback={
          <Show
            when={notFound()}
            fallback={
              <StatusPage
                testId="public-resume-error"
                titleId="public-resume-error-title"
                statusCode="Error"
                title="Could not load resume"
                description={error() ?? "Something went wrong while loading this resume."}
                icon={<PublicNotFoundIcon />}
                primaryAction={{
                  label: "Back to Rustume",
                  href: "/",
                }}
              />
            }
          >
            <StatusPage
              testId="public-resume-not-found"
              titleId="public-resume-not-found-title"
              statusCode="404"
              title="Resume not found"
              description="This resume may be unpublished or the link may be incorrect."
              icon={<PublicNotFoundIcon />}
              primaryAction={{
                label: "Back to Rustume",
                href: "/",
              }}
            />
          </Show>
        }
      >
        {(resumeData) => (
          <div class="flex h-[calc(100vh-3.5rem)] flex-col">
            <div class="border-b border-border bg-paper px-4 py-3">
              <h1 class="font-display text-lg font-semibold text-ink">{title()}</h1>
              <p class="text-sm text-stone">Shared resume preview</p>
            </div>
            <div class="flex-1 overflow-hidden">
              <Suspense
                fallback={
                  <div class="flex h-full items-center justify-center">
                    <Spinner class="h-8 w-8 text-accent" ariaLabel="Rendering preview" />
                  </div>
                }
              >
                <Preview resumeData={resumeData()} />
              </Suspense>
            </div>
          </div>
        )}
      </Show>
    </Show>
  );
}
