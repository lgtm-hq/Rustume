import { A } from "@solidjs/router";
import { TERMS_VERSION, formatPolicyEffectiveDate } from "../lib/policies";

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

export default function Terms() {
  const effectiveDate = formatPolicyEffectiveDate(TERMS_VERSION);

  return (
    <div class="max-w-3xl mx-auto px-4 py-10" data-testid="terms-page">
      <header class="mb-8 space-y-3">
        <p class="text-xs font-mono uppercase tracking-wider text-stone">Legal</p>
        <h1 class="font-display text-3xl font-semibold text-ink">Terms of Service</h1>
        <p class="text-sm text-stone">
          Version {TERMS_VERSION} · Effective {effectiveDate}
        </p>
      </header>

      <div class="space-y-6 text-sm text-ink leading-relaxed">
        <DraftBanner />

        <section>
          <h2 class="font-display text-lg font-semibold mb-2">1. Service</h2>
          <p>
            Rustume Cloud is a hosted resume builder operated by Rustume. You may create an account,
            store resume documents, export them, and use related features subject to these terms.
            Self-hosted deployments of Rustume are governed by the AGPL license, not this agreement.
          </p>
        </section>

        <section>
          <h2 class="font-display text-lg font-semibold mb-2">2. Accounts</h2>
          <p>
            Accounts are provided through WorkOS AuthKit. You are responsible for activity under
            your account and for keeping your sign-in credentials secure. We may suspend or
            terminate accounts that violate these terms or applicable law.
          </p>
        </section>

        <section>
          <h2 class="font-display text-lg font-semibold mb-2">3. Your content</h2>
          <p>
            You retain ownership of resume data you upload or create. You grant Rustume a limited
            license to store, process, and display your content solely to provide the service. You
            may export or delete your data at any time from your account settings.
          </p>
        </section>

        <section>
          <h2 class="font-display text-lg font-semibold mb-2">4. Billing</h2>
          <p>
            Paid plans, when available, will be processed by Paddle as merchant of record. Pricing,
            renewal, and cancellation terms will be disclosed at checkout. Free-tier features may
            change with reasonable notice.
          </p>
        </section>

        <section>
          <h2 class="font-display text-lg font-semibold mb-2">5. Acceptable use</h2>
          <p>
            You may not misuse the service, attempt unauthorized access, upload malware, or use
            Rustume Cloud in ways that harm other users or our infrastructure.
          </p>
        </section>

        <section>
          <h2 class="font-display text-lg font-semibold mb-2">6. Disclaimers</h2>
          <p>
            The service is provided &ldquo;as is&rdquo; without warranties of any kind. To the
            extent permitted by law, Rustume&apos;s liability is limited to the fees you paid in the
            twelve months preceding a claim.
          </p>
        </section>

        <section>
          <h2 class="font-display text-lg font-semibold mb-2">7. Changes</h2>
          <p>
            We may update these terms by posting a new version with an updated effective date.
            Continued use after changes become effective constitutes acceptance of the revised
            terms.
          </p>
        </section>

        <p class="text-stone">
          See also our{" "}
          <A href="/privacy" class="underline hover:text-ink">
            Privacy Policy
          </A>
          .
        </p>
      </div>
    </div>
  );
}
