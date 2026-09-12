# Changelog

All notable changes to the WarmySender agent skill and plugin manifests are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- The connect section and tool catalogue in `SKILL.md`, and the install commands, connect table and tool count in `README.md`, are now generated from the WarmySender platform's own install and tool definitions (regions marked `<!-- GENERATED:... -->`). OpenClaw now shows sign-in as the default with the API-key form as the fallback, and the Claude and Claude Code hints match the in-app copy word for word.
- `README.md` Security section restated plainly: no executable code in this repo, one runtime endpoint (`https://warmysender.com/mcp`), the optional local launcher `@warmysender/mcp` only proxies to that endpoint, `npx skills add` fetches this repository only, no telemetry.

## [1.0.0] - 2026-09-09

### Added
- `SKILL.md` (mirrored at `skills/warmysender/SKILL.md`): connect instructions for every supported client with sign-in as the default and an API-key fallback, hard rules for the agent (it never sends a message itself, never raises a limit, connecting accounts stays in the app), the full tool catalogue grouped by channel with read-only / mutating / destructive marks, per-channel workflows with example prompts, and troubleshooting.
- Claude Code plugin: `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json` (skill-only; connect the server separately so no second server is registered next to an existing connector).
- Cursor plugin: `.cursor-plugin/plugin.json` + `.cursor-plugin/marketplace.json` (skill-only).
- Grok Build plugin: `.grok-plugin/plugin.json` + `.grok-plugin/marketplace.json`; the Grok manifest also declares the hosted MCP server (`https://warmysender.com/mcp`, sign-in on first connect) through `mcpServers`.
- `README.md` with per-agent install commands, a direct-connect table for every client, capability and safety framing, and a security section declaring the single network endpoint and credential model.
- GitHub Action that keeps `skills/warmysender/SKILL.md` identical to the root `SKILL.md`.
- MIT license.
