import { StatusPage } from "./StatusPage";

export interface AppErrorFallbackProps {
  error: unknown;
  onRetry: () => void;
}

/** Fallback UI shown when an unhandled render error is caught by the app ErrorBoundary. */
export function AppErrorFallback(props: AppErrorFallbackProps) {
  const message =
    props.error instanceof Error ? props.error.message : "An unexpected error occurred.";

  return (
    <StatusPage
      statusCode="Error"
      title="Something went wrong"
      description={`Rustume hit an unexpected problem while rendering this page. ${message}`}
      testId="app-error-boundary"
      titleId="app-error-boundary-title"
      primaryAction={{
        label: "Reload page",
        onClick: () => window.location.reload(),
      }}
      secondaryAction={{
        label: "Try again",
        onClick: () => props.onRetry(),
      }}
    />
  );
}
