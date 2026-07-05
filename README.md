# n8n-nodes-discord-channel-trigger

A custom n8n trigger node that starts a workflow whenever your Discord bot sees a **new message in one or more specific channels**.

Unlike a polling or webhook-based trigger, this node keeps a persistent connection to Discord's Gateway (via [discord.js](https://discord.js.org/)) using your existing bot's token, and emits a workflow execution for every matching message in real time.

## Requirements

- A Discord bot application already created in the [Discord Developer Portal](https://discord.com/developers/applications), invited to your server
- The **Message Content** privileged intent enabled for the bot (Developer Portal → your app → Bot → Privileged Gateway Intents)
- Self-hosted n8n (this node has a runtime dependency, `discord.js`, so it is **not eligible for n8n Cloud** — Cloud only allows dependency-free community nodes)

## Install

In your n8n instance's custom extensions folder (usually `~/.n8n/custom`, or wherever `N8N_CUSTOM_EXTENSIONS` points):

```bash
npm install n8n-nodes-discord-channel-trigger
```

Then restart n8n. The node appears in the node panel as **Discord Channel Trigger**.

## Credentials

Create a **Discord Bot API** credential in n8n with your bot's token (Developer Portal → your app → Bot → Reset/Copy Token).

## Node configuration

| Parameter | Description |
|---|---|
| Channel IDs | Comma-separated Discord channel IDs to listen to. Enable Developer Mode in Discord, right-click a channel, "Copy Channel ID". |
| Ignore Bot Messages | Skip messages authored by bots (default: on) |
| Only With Content | Skip messages with no text content, e.g. embed/attachment-only (default: off) |

## Output

Each matching message emits one item shaped like:

```json
{
  "messageId": "...",
  "content": "...",
  "channelId": "...",
  "guildId": "...",
  "authorId": "...",
  "authorUsername": "...",
  "authorBot": false,
  "attachments": [{ "url": "...", "name": "...", "contentType": "..." }],
  "createdTimestamp": 1234567890
}
```

## Local development

```bash
npm install --legacy-peer-deps
npm run build       # compile + copy static files to dist/
npm run lint         # check n8n community node conventions
```

To test against a local n8n instance:

```bash
npm link
cd ~/.n8n/custom
npm link n8n-nodes-discord-channel-trigger
n8n start
```

## Before publishing

- [ ] Update `author.name` / `author.email` in `package.json`
- [ ] Update the `repository.url` in `package.json` to your actual GitHub repo
- [ ] Bump `version` following semver on each release

## License

MIT
