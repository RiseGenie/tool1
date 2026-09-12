---
name: cold-email-launch
description: Build and launch a cold email campaign on WarmySender end to end — sequence copy, prospects, safe launch. Use when the user wants to create, write, or launch a cold email / outreach campaign.
---

# Cold Email Launch

Take the user from idea to a running campaign using WarmySender's MCP tools.

## Workflow

1. Clarify the essentials if missing: offer, audience, tone, number of steps (default 3), days between steps (default 3).
2. Draft the sequence in chat first — subject + body per step, short and plain-spoken, one clear CTA, no spam-trigger phrasing. Get the user's approval on copy before creating anything.
3. `create_campaign` with the approved steps (draft state — nothing sends yet).
4. Prospects: `bulk_create_prospects` for a pasted list, or `search_leads` + `save_leads` from the built-in database, then `enroll_prospects`.
5. Before starting: `list_mailboxes` / `get_mailbox_health` to confirm a healthy connected mailbox exists. If none, stop and direct the user to connect one in the WarmySender app — the agent cannot connect accounts.
6. `start_campaign` only after explicit user confirmation.

## Rules

- Sending is paced by WarmySender's scheduler within safe limits; never promise instant delivery volume.
- If the user also wants verification first, run the list-hygiene skill flow before enrolling.
