---
name: campaign-doctor
description: Diagnose why a WarmySender campaign is sending little or nothing, across email, LinkedIn and Instagram. Use when the user asks "why isn't my campaign sending?", "campaign stuck", "no emails going out", or wants a delivery health check.
---

# Campaign Doctor

Diagnose a quiet campaign with WarmySender's MCP tools. Never guess — every conclusion must come from a tool response.

## Workflow

1. `list_campaigns` — find the campaign (or use the one the user named). Note its status and counters.
2. `list_skipped_actions` with the campaign id (omit it for a workspace-wide view). This returns the actual skip reasons with plain-English explanations.
   - Reasons flagged `is_normal_wait: true` mean the system is pacing correctly — reassure, don't alarm. Report `resumes_at` when present.
   - Other reasons are genuine blockers — surface them verbatim.
3. For email campaigns: `get_mailbox_health` on the sending mailboxes. Check BOTH channels: `health_status` (can we send) AND `read_channel_state` (can we read what arrives). `not_tested` is NOT a pass.
4. For LinkedIn: `get_linkedin_account_health` — if `sending_paused_for_safety` is true, report `safety_pause_explanation` verbatim and stop; a safety rest cannot and must not be shortened.
5. For LinkedIn campaigns: `get_linkedin_campaign_throttle` to see which allowance binds and when it refreshes.

## Report format

Give a short verdict first (working-as-designed vs genuinely blocked), then the evidence, then at most three next actions the user can take in the WarmySender app. Never suggest raising limits — pacing protects their accounts.
