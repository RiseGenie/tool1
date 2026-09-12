---
name: list-hygiene
description: Verify email lists with WarmySender and turn the results into a clean prospect list. Use when the user wants to verify emails, clean a list, reduce bounces, or check verification credits.
---

# List Hygiene

Verify addresses and build a clean list, spending the user's allowance carefully.

## Workflow

1. `get_verification_allowance` FIRST — report what's left before spending anything.
2. Single address → `verify_email`. A list → `submit_verification_batch`, then poll `get_verification_result` / `list_verification_batches` until done.
3. Report outcomes honestly: `valid` is confirmed; `risky` (accept-all) is NOT a guarantee — the tools return `confirmed_count` and `unconfirmable_count`, use those words.
4. `create_list_from_verification` to turn usable results into a prospect list (keeps valid + risky by design; say so).
5. A running batch can be stopped with `cancel_verification_batch` — unused credits are returned.

## Rules

- Never re-verify addresses that already have a recent result unless the user asks.
- If allowance is exhausted, say so plainly and point to the WarmySender app for more credits — never retry around a limit.
