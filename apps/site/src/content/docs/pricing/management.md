---
title: "Subscription Management"
description: 'Manage Rustume-operated hosting access, invoices, payment methods, and cancellation through the hosted billing portal.'
category: pricing
order: 30
---

A hosted subscription is an operational service contract. It pays for Rustume to run the deployment
and synchronization service; it does not grant exclusive access to application features.

## Responsibility split

| Responsibility | Owner |
| --- | --- |
| Checkout, payment methods, invoices, refunds, taxes | [Paddle](https://developer.paddle.com/) |
| Hosted account access and managed operations | Rustume Cloud |
| Self-hosted deployments and their data | The operator |
| Browser-local resumes and exports | The user |

Before ending hosted access, export any records that should remain independently portable.
Self-hosted Rustume remains available regardless of hosted subscription state. See [Hosting
Options](/docs/pricing/plans/) and [Cloud Storage](/docs/cloud/storage/).
