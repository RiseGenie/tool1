# Catalog submissions — owner checklist

> **INTERNAL. NOT CUSTOMER-FACING.** This file is a working checklist for the repo owner. It is safe to keep in the public repo (no secrets), but nothing here is product copy.

Order: **1. push the repo → 2. Anthropic → 3. Cursor → 4. xAI → 5. claude.ai Connectors Directory (when Team/Enterprise) → 6. ChatGPT Apps SDK (last).** The MCP Registry needs nothing.

> **Status 2026-09-09 (verified in the claude.ai admin portal, org "Warmysender"):** the MCP server listing `warmysender` is **In review** (submitted 2 weeks ago) and the Claude Code/Cowork plugin from this repo is **Submitted, pending review**. Do NOT open a second submission for either — updates pushed to this repo are picked up automatically. The empty repo `fortuneflick/warmysender-agent` created on 2026-09-09 is superseded by this one and can be deleted.

> **xAI status 2026-09-09:** PR opened — https://github.com/xai-org/plugin-marketplace/pull/641 (remote source pinned to `a6bc0679`). After any change to this repo, bump the `sha` in a follow-up PR; never open a parallel entry.
> **Cursor status 2026-09-09:** publisher application at cursor.com/marketplace/publish is a one-page form (org name `WarmySender`, handle `warmysender`, contact hello@warmysender.com, logo https://raw.githubusercontent.com/fortuneflick/warmysender-claude-plugin/main/assets/logo.svg, repo URL, website https://warmysender.com). Not listed yet (cursor.com/marketplace/warmysender is 404).

> **ChatGPT status 2026-09-09:** the program is now "ChatGPT Plugins" — portal https://platform.openai.com/plugins (OpenAI org login, Apps Management access, verified publisher identity; no public status check). Requirements: `/.well-known/openai-apps-challenge` domain verification (already served by the app), honest tool annotations, a fully featured demo account WITHOUT MFA, exactly 5 positive + 3 negative test cases, privacy/terms/support URLs, test in Developer Mode on desktop + mobile. Policy risk: guidelines ban "telemarketing / consent-bypass" and in-plugin upselling — foreground opt-out, consent and the scheduler's caps; never mention credits/upgrades inside the plugin.
> **Meta 2026-09-09:** there is NO Meta directory for third-party MCP servers ("Meta Ads AI Connectors" is Meta's own server that users add into Claude/ChatGPT). Nothing to submit.
> **AI Agents — Muse Code (Meta) 2026-09-09:** Muse Code 1.0.3 (`1.0.3-R2198.1`) is now a first-class client in `shared/mcp-install.ts` and in the connect table above. **Status: NOTHING TO SUBMIT — Muse Code has no plugin/connector catalog**; users add WarmySender themselves in `~/.config/muse/settings.json`. Verified locally on 2026-09-09 against the real binary: that settings path is the file Muse Code reads, `"schema_version": 1` is mandatory (a wrong version is refused by path), servers live under `mcp_servers` with `transport: "streamable_http"` + `url` + `headers`, and a run with that entry really does reach the WarmySender server and stop on an authentication failure when the key is missing or fake. **Not verified:** a successful tool call with a real key. **Known absent:** Muse Code 1.0.3 has no browser sign-in flow for MCP servers (bearer header or nothing), so the published path is the API key — do not add a sign-in instruction until Meta documents one.

## 0. Before anything

- [ ] Create the public GitHub repo `fortuneflick/warmysender-claude-plugin` and push `main` (this repo has one local commit; nothing is pushed).
- [ ] After the first push, record the 40-char commit SHA: `git ls-remote https://github.com/fortuneflick/warmysender-claude-plugin.git HEAD`
- [ ] Confirm the GitHub Action `sync-skill.yml` ran green (it only fires on later pushes that touch `SKILL.md`).
- [ ] `claude plugin validate .` and `claude plugin validate .claude-plugin/plugin.json` pass locally (both passed on 2026-09-09).

## 1. Anthropic plugin directory (Claude Code)

- Path that works for an **individual** account: https://platform.claude.com/plugins/submit (Console).
- The claude.ai-side listing path requires a Team/Enterprise org — skip unless/until that exists.
- Fields: repo URL `https://github.com/fortuneflick/warmysender-claude-plugin`, plugin name `warmysender`, marketplace name `warmysender-claude-plugin`, manifest `.claude-plugin/plugin.json`, description (use the plugin.json description verbatim), homepage `https://warmysender.com/ai-agents`, category `productivity`, license MIT.
- Note for the reviewer: the plugin is **skill-only** by design; the MCP server is connected separately (`claude mcp add --transport http warmysender https://warmysender.com/mcp`), so no second server is registered next to an existing connector.

## 2. Cursor marketplace

- https://cursor.com/marketplace/publish
- Fields: repository URL `https://github.com/fortuneflick/warmysender-claude-plugin`, manifest path `.cursor-plugin/plugin.json`, logo `assets/logo.svg` (committed), marketplace file `.cursor-plugin/marketplace.json`.
- The Cursor plugin is skill-only; the one-click server install is the deeplink in README.md.

## 3. xAI plugin marketplace (Grok Build)

1. Fork https://github.com/xai-org/plugin-marketplace, branch from `main`.
2. Append this entry to `.grok-plugin/marketplace.json` (remote source — nothing is vendored):

```json
{
  "name": "warmysender",
  "description": "WarmySender for AI agents — run cold email, email warmup, LinkedIn, Instagram and WhatsApp outreach on autopilot, verify emails and tap a 200M B2B lead database from Claude, ChatGPT, Cursor, Codex, OpenClaw, Hermes Agent or any agent that speaks MCP. The agent never sends directly and never raises a limit: WarmySender's scheduler paces every action inside safe limits.",
  "category": "productivity",
  "source": {
    "source": "url",
    "url": "https://github.com/fortuneflick/warmysender-claude-plugin.git",
    "sha": "a6bc067975ef239b6d9a48ee3a06d184077b2c01"
  },
  "homepage": "https://warmysender.com/ai-agents",
  "keywords": [
    "warmysender",
    "warmysender cold email",
    "warmysender warmup",
    "warmysender linkedin outreach",
    "warmysender email verification",
    "warmysender leads"
  ],
  "domains": ["warmysender.com"]
}
```

3. Replace `a6bc067975ef239b6d9a48ee3a06d184077b2c01` with the full 40-char lowercase SHA (a tag or branch is rejected).
4. `python3 scripts/generate-plugin-index.py` then `python3 scripts/validate-catalog.py` and `python3 scripts/generate-plugin-index.py --check` — all must pass.
5. PR title: `Add warmysender`. Fill in the template. Keywords/domains are brand-scoped on purpose (xAI rejects generic terms like `email` or `linkedin`).
6. Expect the "official org vs personal account" question: `fortuneflick` is the owner's GitHub account. If review pushes back, transfer the repo to an org named after the product and re-pin the SHA.

## 4. claude.ai Connectors Directory (Team/Enterprise gated)

Not available on an individual plan today. Packet to have ready:

| Field | Value |
|---|---|
| Name | WarmySender |
| Slug | `warmysender` |
| Tagline (≤55 chars) | `Run outreach on autopilot with AI agents` (40 chars) |
| Description (≤2000 chars) | Use `long_description` from `chatgpt-app-submission.json` |
| Categories (1–5) | Productivity, Sales, Marketing |
| MCP server URL | https://warmysender.com/mcp |
| Auth | OAuth 2.1 with dynamic client registration |
| Docs URL | https://warmysender.com/mcp |
| Privacy URL | https://warmysender.com/privacy |
| Support contact | hello@warmysender.com / https://warmysender.com/support |
| Icon | `assets/icon-192.png` |
| Use cases | Cold email campaigns from a list; LinkedIn / Instagram / WhatsApp campaigns; verify a list; search leads and save; tune warmup; explain why a campaign is slow |
| Test-account instructions | PLACEHOLDER — create a demo workspace with sample campaigns, one mailbox, one template, leads access and verification allowance; confirm the email so sign-in needs no extra step |
| Example prompts (3+) | The six `starter_prompts` in `chatgpt-app-submission.json` |

## 5. MCP Registry

**Already live as `com.warmysender/mcp` v1.1.0 — nothing to submit.** The registry signing private key is held offline by the owner; republishing means `mcp-publisher login http --domain warmysender.com --private-key <hex>` then `mcp-publisher publish` from the launcher package. Do not rotate or remove the `/.well-known/mcp-registry-auth` route.

## 6. ChatGPT Apps SDK (last)

Everything is drafted in `chatgpt-app-submission.json`; the `_notes` array lists every step the owner must still do (identity verification, demo account without MFA/email confirmation, domain challenge token, test cases, availability, attestations). Read it top to bottom before opening the portal.
