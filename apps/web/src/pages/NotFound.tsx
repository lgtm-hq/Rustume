import { useLocation, useNavigate } from "@solidjs/router";
import { StatusPage } from "../components/errors/StatusPage";

function MissingPageIcon() {
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

export default function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();

  const pathLabel = () => {
    const path = location.pathname;
    return path.length > 48 ? `${path.slice(0, 45)}…` : path;
  };

  return (
    <StatusPage
      testId="not-found-page"
      statusCode="404"
      title="Page not found"
      description={`We couldn't find a page at ${pathLabel()}. Your resumes are still safe — head back home or open one from your list.`}
      icon={<MissingPageIcon />}
      primaryAction={{
        label: "Back to resumes",
        onClick: () => navigate("/", { replace: true }),
      }}
      secondaryAction={{
        label: "Open account",
        href: "/account",
      }}
    />
  );
}
