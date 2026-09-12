<p align="center"><img src="assets/logo.svg" alt="WarmySender" width="96"></p>

# WarmySender agent skill

**Run your outreach on autopilot with AI agents.** Your agent can run your entire outreach — build, launch and manage cold email, LinkedIn, Instagram and WhatsApp campaigns, verify emails, search a 200M+ B2B lead database, and tune email warmup, all in plain language — while WarmySender's scheduler keeps every account inside safe limits no matter who's driving. Works with Claude, ChatGPT, Cursor, Codex, OpenClaw, and Hermes Agent, and any agent that speaks MCP.

This repo ships the skill (`SKILL.md`) plus plugin manifests for Claude Code, Cursor and Grok Build. The MCP server itself is hosted at `https://warmysender.com/mcp`.

## Install

<!-- GENERATED:install START -->
**Any agent (skill only):**

```bash
npx skills add fortuneflick/warmysender-claude-plugin
```

**Claude Code:**

```
/plugin marketplace add fortuneflick/warmysender-claude-plugin
/plugin install warmysender@warmysender
```
<!-- GENERATED:install END -->

**Cursor:** Open Customize in the Cursor sidebar, find WarmySender, and select Install. For local development: clone this repo and symlink it into your Cursor plugins directory (`ln -s "$PWD" ~/.cursor/plugins/warmysender`), then reload Cursor — the manifest is `.cursor-plugin/plugin.json`.

**Grok Build:** In Grok Build run /marketplace and pick WarmySender, or add the repo as a marketplace source. Only the Grok manifest (`.grok-plugin/plugin.json`) bundles the hosted MCP server through its `mcpServers` field, so Grok gets tools and skill in one install. The Claude Code and Cursor plugins are skill-only on purpose — installing them never registers a second WarmySender server next to a connector you already have; connect those clients with the commands below.

## Connect the MCP server directly

<!-- GENERATED:connect-table START -->
Sign-in is the default: the client registers itself and you sign in to WarmySender in the browser. Clients without a sign-in path use an API key from **Settings → API Keys** (replace `ws_YOUR_API_KEY_HERE`). Full per-client instructions, including the API-key form for every client, are in [SKILL.md](SKILL.md#1-connect-first) and at https://warmysender.com/mcp.

| Client | Auth | Connect |
|---|---|---|
| Claude | Sign in (default) | <code>https://warmysender.com/mcp</code> |
| ChatGPT | Sign in (default) | <code>codex mcp add warmysender --url https://warmysender.com/mcp<br>codex mcp login warmysender</code> |
| Claude Code | Sign in (default) | <code>claude mcp add --transport http warmysender https://warmysender.com/mcp</code> |
| Cursor | Sign in (default) | `.cursor/mcp.json`: <code>{<br>  "mcpServers": {<br>    "warmysender": {<br>      "url": "https://warmysender.com/mcp"<br>    }<br>  }<br>}</code> |
| Codex | Sign in (default) | <code>codex mcp add warmysender --url https://warmysender.com/mcp<br>codex mcp login warmysender</code> |
| OpenClaw | Sign in (default) | <code>openclaw mcp add warmysender --url https://warmysender.com/mcp --transport streamable-http --auth oauth<br>openclaw mcp login warmysender</code> |
| Hermes Agent | Sign in (default) | `~/.hermes/config.yaml`: <code>mcp_servers:<br>  warmysender:<br>    url: "https://warmysender.com/mcp"<br>    auth: oauth</code> |
| Muse Code | API key | `~/.config/muse/settings.json`: <code>{<br>  "schema_version": 1,<br>  "mcp_servers": {<br>    "warmysender": {<br>      "transport": "streamable_http",<br>      "url": "https://warmysender.com/mcp",<br>      "headers": {<br>        "Authorization": "Bearer ws_YOUR_API_KEY_HERE"<br>      }<br>    }<br>  }<br>}</code> |
| Grok Bot | API key | <code>{<br>  "name": "warmysender",<br>  "url": "https://warmysender.com/mcp",<br>  "headers": {<br>    "Authorization": "Bearer ws_YOUR_API_KEY_HERE"<br>  }<br>}</code> |
| Windsurf | Sign in (default) | `~/.codeium/windsurf/mcp_config.json`: <code>{<br>  "mcpServers": {<br>    "warmysender": {<br>      "serverUrl": "https://warmysender.com/mcp"<br>    }<br>  }<br>}</code> |
| Zed | API key | `settings.json`: <code>{<br>  "context_servers": {<br>    "warmysender": {<br>      "command": {<br>        "path": "npx",<br>        "args": [<br>          "-y",<br>          "@warmysender/mcp",<br>          "--api-key=ws_YOUR_API_KEY_HERE"<br>        ]<br>      }<br>    }<br>  }<br>}</code> |

Cursor one-click: [![Add to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](cursor://anysphere.cursor-deeplink/mcp/install?name=warmysender&config=eyJ1cmwiOiJodHRwczovL3dhcm15c2VuZGVyLmNvbS9tY3AifQ%3D%3D)
<!-- GENERATED:connect-table END -->

## What the agent can do

- Build, launch, pause and resume cold email, LinkedIn, Instagram and WhatsApp campaigns; enroll prospects; import lists; manage suppressions.
- Publish LinkedIn posts and manage recruiter jobs.
- Verify single addresses or whole lists, check the allowance first, and turn results into a clean list.
- Search 200M+ B2B leads for free and save or export the ones you want.
- Tune warmup per mailbox or in bulk, and read mailbox, account and campaign health.
<!-- GENERATED:tool-count START -->
- 78 tools in total — grouped by channel in [SKILL.md](SKILL.md#3-tool-catalogue-78-tools).
<!-- GENERATED:tool-count END -->

## What the agent cannot do

- **It never sends a message itself.** Creating or launching only writes the campaign and hands it to WarmySender's scheduler, which paces every email, LinkedIn, Instagram and WhatsApp action inside safe limits and the gradual ramp.
- **It can never raise a limit** or skip a safety check.
- **Connecting or disconnecting accounts stays in the app** — mailboxes, LinkedIn seats, Instagram accounts and WhatsApp numbers are connected at warmysender.com.

## Bundled skills

Besides the general `warmysender` skill, the Claude Code plugin ships three workflow skills:

- **campaign-doctor** — diagnose a quiet campaign from real skip reasons
- **cold-email-launch** — idea → approved copy → enrolled prospects → safe launch
- **list-hygiene** — verify lists allowance-first and build clean prospect lists

Requires a WarmySender account on a paid plan. Email features need a connected mailbox; LinkedIn, Instagram and WhatsApp need the respective add-on. Accounts are connected in the WarmySender app — deliberately not through the agent.

## Privacy

WarmySender's privacy policy: https://warmysender.com/privacy. The plugin itself stores nothing; all data access goes through the authenticated connection to your own WarmySender workspace.

## Security

- **No executable code.** The skill is a Markdown file and the manifests are JSON. Nothing in this repo runs, downloads binaries, or installs anything beyond copying that file into your agent.
- **One runtime endpoint:** `https://warmysender.com/mcp` (HTTPS). Every connect command above points at that address; the tools run there, not on your machine.
- **Optional local fallback:** clients that cannot connect to a remote server directly (the Claude Desktop config file and Zed) run the published npm package `@warmysender/mcp`, a small launcher that only proxies to that same endpoint.
- **`npx skills add`** fetches this repository and nothing else.
- **Credentials:** either sign-in (the client registers itself; no secret is stored in this repo) or a `ws_` API key the user creates under Settings → API Keys and keeps in their own client config. This repo contains no keys and never asks for one in chat.
- **No telemetry.** Nothing phones home.
- Every tool is workspace-scoped and carries `readOnlyHint` / `destructiveHint` annotations so clients can ask before anything that stops or removes work.

## Links

- Setup and server docs: https://warmysender.com/mcp
- AI agents overview: https://warmysender.com/ai-agents
- Connect your agent: https://warmysender.com/documentation/connect-your-ai-agent
- Pricing: https://warmysender.com/pricing
- Support: https://warmysender.com/support

## License

MIT — see [LICENSE](LICENSE).
