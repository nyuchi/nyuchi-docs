---
title: Incident response
description: "Operations playbook: incident response."
sidebar:
  label: Incident response
---

For a suspected vulnerability in a running service (the `nyuchi-api` pattern):

1. **Reproduce with a failing test** before the fix. A fix without a test
   that failed first is unverified.
2. **Fix with a signed or bound design:** a value the client controls is
   never trusted for identity or authority; bind it to the session or sign it.
   Closing the symptom while the trust gap stays is not a fix.
3. **Ship the normal way:** issue, PR, green checks, merge queue. In
   `nyuchi/nyuchi-api`, `fly-deploy.yml` deploys to Fly after "Test & Build"
   succeeds on a push to `main`, using the exact commit CI tested. A missing
   `FLY_API_TOKEN` fails loudly. There is no Fly staging app.
4. **Verify live** against the deployed service: the exploit request now
   fails, a normal request works, the reported version is the new release.
   `gh run list -R nyuchi/nyuchi-api --workflow fly-deploy.yml --limit 3`.
5. **Give the owner a describe-only audit query list:** read-only queries
   (counts, shapes, time ranges) that show whether the bug was used, each with
   what it counts. The owner runs them; you do not run them on production data.
6. **Never read personal data to investigate.** Work from code, tests,
   metrics and payload-free logs. Exploitable detail stays out of public
   issues. Rotating credentials and any production-data action are the owner's.
