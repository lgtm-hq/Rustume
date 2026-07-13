import { createSignal } from "solid-js";
import { StatusPage } from "../components/errors/StatusPage";
import { useI18n } from "../i18n";
import { authStore } from "../stores/auth";

function LockIcon() {
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
        d="M16 11V8a4 4 0 10-8 0v3M6 11h12v9H6z"
      />
    </svg>
  );
}

/** Shown when hosted Rustume Cloud requires sign-in before using the app. */
export default function Unauthorized() {
  const { t } = useI18n();
  const { signIn } = authStore;
  const [signingIn, setSigningIn] = createSignal(false);

  const handleSignIn = () => {
    setSigningIn(true);
    try {
      signIn();
    } catch {
      setSigningIn(false);
    }
  };

  return (
    <StatusPage
      testId="unauthorized-page"
      titleId="unauthorized-page-title"
      statusCode="401"
      title={t("auth.unauthorized.title")}
      description={t("auth.unauthorized.description")}
      icon={<LockIcon />}
      primaryAction={{
        label: t("auth.unauthorized.primaryAction"),
        onClick: handleSignIn,
        loading: signingIn(),
      }}
      secondaryAction={{
        label: t("auth.unauthorized.secondaryAction"),
        href: "/account",
      }}
    />
  );
}
