---
title: "Hosted Checkout"
description: 'Subscriptions to the operated Rustume Cloud service through <a href="https://developer.paddle.com/">Paddle</a> as Merchant of Record.'
category: pricing
order: 20
---

Checkout purchases access to the hosted Rustume Cloud deployment. It is not a checkout for feature
entitlements: the open-source connected application provides the same Rustume capabilities when you
run it yourself.

## Checkout flow

1. A user selects hosted Rustume Cloud access.
2. Paddle handles payment, invoicing, and applicable tax requirements as Merchant of Record.
3. Verified billing events activate access to the Rustume-operated deployment.
4. The signed-in user begins using managed [sync](/docs/cloud/sync/) and storage.

Billing endpoints must validate signed webhooks and handle repeated events idempotently. Read
[Subscription Management](/docs/pricing/management/) for cancellation and account operations, or
[Cloud Getting Started](/docs/cloud/getting-started/) for product use.
