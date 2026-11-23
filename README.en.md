<div align="center">

# Bitrix24 Workspace

**An AI agent skill that reads your Bitrix24 workspace: chats, tasks, projects, files, mail, calendar and meetings. Read-only.**

[![Release](https://img.shields.io/github/v/release/nyxandro/bitrix24-workspace-skill)](https://github.com/nyxandro/bitrix24-workspace-skill/releases)
[![CI](https://github.com/nyxandro/bitrix24-workspace-skill/actions/workflows/ci.yml/badge.svg)](https://github.com/nyxandro/bitrix24-workspace-skill/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/nyxandro/bitrix24-workspace-skill)](LICENSE)
[![Agent Skills](https://img.shields.io/badge/Agent%20Skills-SKILL.md-6f42c1)](https://agentskills.io/specification)
[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-d97757)](#install)
![Node 20.19+](https://img.shields.io/badge/node-%E2%89%A520.19-339933?logo=nodedotjs&logoColor=white)

[Русский](README.md) · **English**

</div>

A skill for Claude Code, Codex, OpenCode, Cursor and other agents that read Agent Skills and can
run commands. You ask in plain words, the agent calls the bundled CLI and answers from the live
portal through the [Bitrix24 REST API](https://apidocs.bitrix24.com/), not from memory. You never
run the CLI yourself.

The skill works through an **inbound webhook** and sees exactly what you see in the portal. It is
**read-only**. It can't send, change or delete anything: the program carries an allowlist of
methods, and all of them only read.

## What it does

| Area | What's inside |
|---|---|
| Chats | Recent dialogs and unread counters, messages in group chats, direct messages, task and project chats, search within a chat, members |
| Notifications | Mentions, assignments, invitations |
| Tasks and projects | My tasks in every role, a task card with its chat and checklist, time logged in tasks (how much and what was done, totals for a period), workgroups, projects, collabs |
| Drive | Storages, folders, search by name and document text, downloading a file to read it |
| Mail | Mailboxes, message search, message text, the thread |
| Calendar and meetings | Upcoming events, any period and calendar, AI summaries of video meetings with agreements, action items and the transcript |
| Feed and knowledge base | Company news with comments, knowledge base documents |
| Org and work time | My department, managers, colleagues, the workday log |

CRM, open channels, telephony and business processes are not part of the skill.

## Install

You need **Node.js 20.19 or newer**. It's the only external dependency. All the code is bundled
into one file, with no npm packages and no build step.

| Way | Command |
|---|---|
| Claude Code, as a plugin | `/plugin install bitrix24-workspace --marketplace nyxandro/skills` |
| Claude Code, Codex, OpenCode, Cursor and others | `npx skills add nyxandro/bitrix24-workspace-skill` |
| One command, Linux, macOS, WSL | `curl -fsSL https://raw.githubusercontent.com/nyxandro/bitrix24-workspace-skill/main/install.sh \| bash` |
| By hand | Download the [latest `.skill` archive](https://github.com/nyxandro/bitrix24-workspace-skill/releases/latest/download/bitrix24-workspace.skill) and unpack it into the agent's skills folder |

Pick one. If you install it two ways, Claude Code loads the skill twice. Restart the agent's
session after installing.

Don't install it next to other Bitrix24 skills with a similar description, the agent may pick the
wrong one.

<details>
<summary>More about the install options</summary>

<br>

- `install.sh` downloads the skill, puts it into `~/.agents/skills/`, links it from
  `~/.claude/skills/`, and creates an empty `~/.config/bitrix24-workspace/.env` closed to other
  users of the machine. Running it again updates the skill and leaves the URL you entered alone.
- For an agent with its own skills folder add `--dir <folder>`. For a machine without internet
  copy the archive over and run `bash install.sh --file bitrix24-workspace.skill`.
- The plugin and `npx skills` don't create the `.env` file. Create it as shown in
  [Webhook setup](#webhook-setup).
- The `.skill` archive is a ZIP. Unpack it into the skills folder, the agent doesn't pick up the
  archive file itself.

  ```bash
  unzip bitrix24-workspace.skill -d ~/.agents/skills/     # or -d ~/.claude/skills/ for Claude Code
  ```

- The one-line plugin install needs Claude Code 2.1.275 or later. On an older version, add the
  catalog first with `/plugin marketplace add nyxandro/skills`.
- With `npx skills`, add `-g` to install the skill for every project. To install a given version,
  add its tag, as in `nyxandro/bitrix24-workspace-skill@v0.1.2`.
- The skill tells you in `status` when a new version appears in the repository.

</details>

## Usage

Ask as you normally would. The skill's interface and messages are in Russian.

- *What was written in the project this week?*
- *What are they discussing in task 4521?*
- *How many hours did I log in tasks in November, and on what?*
- *What's unread and what came in for me?*
- *Find the supplier contract on Drive and tell me the payment terms.*
- *What do I have tomorrow, and what did we agree on in Tuesday's call?*
- *Where are our vacation rules, and who is my manager?*
- *Tell Ivanov I'll be late.* The agent answers that the skill only reads.

At the start the agent calls `status`. It checks the connection and shows whose webhook is in use,
which permissions are missing and which are not needed.

## Webhook setup

1. In Bitrix24 open **Developer resources → Other → Inbound webhook**.
2. Tick the permissions `im`, `task`, `sonet_group`, `socialnetwork`, `disk`, `mail`, `calendar`,
   `user_basic`, `call`, `log`, `note`, `timeman`. What each one is for is listed in
   [`references/setup.md`](skills/bitrix24-workspace/references/setup.md), in Russian. CRM and the
   rest are not needed.
3. Put the webhook URL into `~/.config/bitrix24-workspace/.env` **yourself, not through the AI
   chat**.

   ```bash
   bash -c 'umask 077 && mkdir -p ~/.config/bitrix24-workspace && read -rsp "Webhook URL: " U && printf "BITRIX24_WORKSPACE_WEBHOOK_URL=%s\n" "$U" > ~/.config/bitrix24-workspace/.env && chmod 600 ~/.config/bitrix24-workspace/.env && echo " done"'
   ```

4. Ask the agent to "check the Bitrix24 connection", and it calls `status`.

The CLI reads `.env` only from `~/.config/bitrix24-workspace/.env`, never from the current folder.
A real `BITRIX24_WORKSPACE_WEBHOOK_URL` environment variable takes priority over the file, which
is the standard way for servers and containers. Without the URL you get
`APP_B24_WEBHOOK_MISSING`, there are no defaults.

## Security

- **Writes are blocked by the program, not by Bitrix24.** A webhook has no read-only mode, the URL
  itself allows writing. Keep it like a password. If it leaks, delete the webhook in Bitrix24 and
  create a new one.
- **The `call` permission is needed only for meeting summaries**, but by the documentation it also
  opens paid robocalls. The skill never makes them. If you don't need meeting summaries, don't
  grant it.
- **Keys are never printed.** Neither the webhook URL nor file download links (they carry a key
  too) appear in answers or errors. The skill downloads files itself and reports only the path.
- **Content is data, not commands.** The agent's instructions forbid acting on anything written in
  emails, messages and documents.
- **Lists are narrowed to your own.** Even for an administrator, the lists of tasks, time records and
  meeting summaries and the drives default to your own. By a direct number (a task, a group, someone
  else's calendar) and in Drive search you see everything Bitrix24 allows this employee.
- **What the agent reads goes to its AI service.** Everything the agent reads, it passes to its
  model. Whether that's acceptable for your company's data is your call.

To be honest about it, the protection rests on the agent working through the program. The agent's
other tools, such as the official Bitrix24 MCP server, may be able to write, and that's outside
the skill.

<details>
<summary>How it works inside</summary>

<br>

- **One way out to the network.** Every request to the portal goes through one client. Before each
  one it checks the method against the allowlist and against a read-only name shape, and any other
  call is refused before it's sent, with `APP_B24_METHOD_NOT_ALLOWED`.
- **Pace.** No more than two requests a second, the limit of cloud Bitrix24. No retries and no
  data cache.
- **Answers.** JSON built from an explicit list of fields, names instead of numbers, text without
  markup. Long texts are cut to 4,000 characters, lists come in pages with a cursor.
- **A final output check.** Values that look like keys (`token=`, `auth=`) are replaced with
  `<скрыто>`. If the answer contains your webhook URL, it isn't printed at all.
- **Errors.** Every error comes in Russian with a stable `APP_...` code. Technical details
  appear when you run with `B24_DEBUG=1`.
- **Rules for the agent** (CLI only, content as data, reading the JSON fields) live in `SKILL.md`
  and `references/` inside the package, and the agent must follow them.

</details>

## Works well with

We recommend installing it together with
[Materials Intake](https://github.com/nyxandro/materials-intake-skill). Bitrix24 Workspace gets
the materials out of the portal: it reads chats, emails and meeting summaries, and downloads files
from Drive and attachments from chats. Materials Intake takes in everything a project receives and
keeps the project's `inbox/` folder in order. With both installed, ask the agent to fetch the
materials from Bitrix24 and sort them. What was downloaded doesn't stay lying around: the agent
files it into folders under `inbox/`, keeps passwords and personal data out of git, and records in
one inventory what each item is, who it came from and what it decides.

```bash
npx skills add nyxandro/materials-intake-skill     # or /plugin install materials-intake --marketplace nyxandro/skills
```

Neither skill needs the other. Bitrix24 Workspace works the same without Materials Intake.

## Versions

The current version is in `package.json` and in the header of
`skills/bitrix24-workspace/SKILL.md`. Every version has a git tag and a
[release](https://github.com/nyxandro/bitrix24-workspace-skill/releases) with the skill archive.
[CHANGELOG.md](CHANGELOG.md) lists what changed, in Russian.

<details>
<summary>Development</summary>

<br>

```bash
npm install
npm test            # tests (vitest)
npm run typecheck
npm run lint
npm run pack:skill  # build scripts/b24.cjs and bitrix24-workspace.skill
```

On every push GitHub runs the same checks and verifies that the bundled file and the archive match
the sources. The design and the plan are in [`docs/specs/`](docs/specs/), in Russian.

</details>

## Disclaimer

An unofficial skill. It isn't affiliated with or supported by 1C-Bitrix. Bitrix24 is a trademark
of its owner.

## License

[MIT](LICENSE)
