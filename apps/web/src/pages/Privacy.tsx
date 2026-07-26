import { A } from "@solidjs/router";
import { PRIVACY_VERSION, formatPolicyEffectiveDate } from "../lib/policies";

function DraftBanner() {
  return (
    <div
      class="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="note"
    >
      <strong>DRAFT — pending legal review.</strong> This text is a placeholder for the hosted
      Rustume Cloud service and must be reviewed by qualified legal counsel before the paid launch.
    </div>
  );
}

export default function Privacy() {
  const effectiveDate = formatPolicyEffectiveDate(PRIVACY_VERSION);

  return (
    <div class="max-w-3xl mx-auto px-4 py-10" data-testid="privacy-page">
      <header class="mb-8 space-y-3">
        <p class="text-xs font-mono uppercase tracking-wider text-stone">Legal</p>
        <h1 class="font-display text-3xl font-semibold text-ink">Privacy Policy</h1>
        <p class="text-sm text-stone">
          Version {PRIVACY_VERSION} · Effective {effectiveDate}
        </p>
      </header>

      <div class="space-y-6 text-sm text-ink leading-relaxed">
        <DraftBanner />

        <section>
          <h2 class="font-display text-lg font-semibold mb-2">1. Overview</h2>
          <p>
            Rustume Cloud is designed to be privacy-first. This policy describes how we collect,
            use, and protect personal data when you use the hosted service at app.rustume.com.
            Self-hosted instances are operated by their administrators and are outside this policy.
          </p>
        </section>

        <section>
          <h2 class="font-display text-lg font-semibold mb-2">2. Data we collect</h2>
          <ul class="list-disc pl-5 space-y-2">
            <li>
              <strong>Account data</strong> from WorkOS AuthKit (email, name, authentication
              identifiers).
            </li>
            <li>
              <strong>Resume content</strong> you create or import, stored to provide editing,
              export, and sync features.
            </li>
            <li>
              <strong>Usage and security logs</strong> such as sign-in events, IP addresses, and
              audit records for abuse prevention.
            </li>
            <li>
              <strong>Billing data</strong> processed by Paddle when paid plans launch (Paddle acts
              as merchant of record).
            </li>
          </ul>
        </section>

        <section>
          <h2 class="font-display text-lg font-semibold mb-2">3. How we use data</h2>
          <p>
            We use your data to operate the service, authenticate you, sync resumes across devices,
            respond to support requests, comply with law, and improve reliability. We do not sell
            your personal data.
          </p>
        </section>

        <section>
          <h2 class="font-display text-lg font-semibold mb-2">4. Retention and deletion</h2>
          <p>
            Resume data is retained while your account is active. You may export your resumes at any
            time and permanently delete your account from the account settings page, which removes
            your stored resumes and associated cloud data subject to backup retention limits.
          </p>
        </section>

        <section>
          <h2 class="font-display text-lg font-semibold mb-2">5. Subprocessors</h2>
          <p>
            We use WorkOS for authentication and will use Paddle for payments. Infrastructure
            providers host the application and database. Each subprocessor is bound by contractual
            obligations appropriate to their role.
          </p>
        </section>

        <section>
          <h2 class="font-display text-lg font-semibold mb-2">6. Your rights</h2>
          <p>
            Depending on your jurisdiction, you may have rights to access, correct, export, or
            delete your personal data. Contact us through the project issue tracker for privacy
            requests.
          </p>
        </section>

        <section>
          <h2 class="font-display text-lg font-semibold mb-2">7. Changes</h2>
          <p>
            We may update this policy by posting a new version with an updated effective date.
            Material changes will be communicated through the service where practicable.
          </p>
        </section>

        <p class="text-stone">
          See also our{" "}
          <A href="/terms" class="underline hover:text-ink">
            Terms of Service
          </A>
          .
        </p>
      </div>
    </div>
  );
}
