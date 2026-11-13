<div align="center">

# Bitrix24 Workspace

**An AI agent skill that reads your Bitrix24 workspace — chats, tasks, projects, files, mail, calendar and meetings. Read-only.**

[Русский](README.md) · **English**

</div>

A skill for Claude Code, Codex, OpenCode, Cursor, Hermes and other agents that support Agent
Skills and can run commands. Ask in plain words — "what was discussed in the project this week",
"find the contract on Drive", "what did we agree on in Tuesday's call" — and the agent calls the
bundled CLI and answers from the live portal.

The skill works through an **inbound webhook** and sees exactly what you see. It is **read-only**:
it cannot send, change or delete anything — the program only knows an allowlist of read methods.

## What it covers

| Section | What's inside |
|---|---|
| Chats | Recent dialogs and unread counters, messages in group chats, direct messages, task and project chats, search, members |
| Notifications | Mentions, assignments, invitations |
| Tasks and projects | My tasks across all roles, task card with its chat and checklist; workgroups, projects, collabs |
| Drive | Storages, folders, search by name and document text, download a file to read it |
| Mail | Mailboxes, message search, message text, thread |
| Calendar and meetings | Upcoming events, any period and calendar, AI meeting summaries: agreements, action items, transcript |
| Feed and knowledge base | Company news with comments, knowledge base documents |
| Org and time | My department, managers, colleagues; workday status and time records |

## Install

Requires **Node.js 20.19+**. Everything is bundled into one file; no npm install needed.

| Method | Command |
|---|---|
| One command (Linux, macOS, WSL) | `curl -fsSL https://raw.githubusercontent.com/nyxandro/bitrix24-workspace-skill/main/install.sh \| bash` |
| Claude Code, Codex, OpenCode, Cursor and others | `npx skills add nyxandro/bitrix24-workspace-skill` |
| Manual | Download [`bitrix24-workspace.skill`](bitrix24-workspace.skill) (a ZIP) and unpack it into the agent's skills folder |

`install.sh` puts the skill into `~/.agents/skills/`, links it from `~/.claude/skills/` and creates
an empty `~/.config/bitrix24-workspace/.env`. Use `--dir <folder>` for agents with their own skills
folder, or `bash install.sh --file bitrix24-workspace.skill` on an offline machine. Restart the
agent session afterwards.

## Webhook setup

1. In Bitrix24: **Developer resources → Other → Inbound webhook**.
2. Grant: `im`, `task`, `sonet_group`, `socialnetwork`, `disk`, `mail`, `calendar`, `user_basic`,
   `call`, `log`, `note`, `timeman` (see [`references/setup.md`](skills/bitrix24-workspace/references/setup.md)).
   CRM and the rest are not needed.
3. Put the webhook URL into `~/.config/bitrix24-workspace/.env` **yourself, never through the AI chat**:

   ```bash
   bash -c 'mkdir -p ~/.config/bitrix24-workspace && read -rsp "Webhook URL: " U && printf "BITRIX24_WORKSPACE_WEBHOOK_URL=%s\n" "$U" > ~/.config/bitrix24-workspace/.env && chmod 600 ~/.config/bitrix24-workspace/.env && echo " done"'
   ```

4. Ask the agent to check the Bitrix24 connection — it will run `status`.

## Security

- **Writes are blocked by the program, not by Bitrix24.** A webhook has no read-only mode; the URL
  itself allows writes. Keep it like a password; if it leaks, delete the webhook and create a new
  one. The `call` scope (meeting summaries) also enables paid robocalls per the docs — skip it if
  you don't need meeting summaries.
- **Secrets are never printed.** Neither the webhook URL nor file download links (they carry a key
  too) appear in output or errors; the skill downloads files itself.
- **Content is data, not instructions.** The agent instructions forbid following commands found in
  emails, messages or documents.
- **Lists are narrowed to your own.** Even for an administrator, task lists, meeting summaries and
  default Drive storages show only their own. By direct id (a task, a group, someone's calendar)
  and in Drive search, everything Bitrix24 allows that user is visible.

## Development

```bash
npm install
npm test
npm run typecheck
npm run lint
npm run pack:skill
```

Design and plan: [`docs/specs/`](docs/specs/) (Russian). License: [MIT](LICENSE).
