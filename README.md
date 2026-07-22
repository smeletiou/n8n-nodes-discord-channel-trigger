# n8n-nodes-discord-channel-trigger

Two custom n8n nodes for Discord automation using your own bot:

1. **Discord Channel Trigger** — starts a workflow when your bot sees a new message in a channel or DM
2. **Discord Send and Wait for Reply** — sends a message and pauses the workflow until someone actually responds in Discord itself, either by clicking a button or by using Discord's native "Reply" feature with free text

## Discord Channel Trigger

Unlike a polling or webhook-based trigger, this node keeps a persistent connection to Discord's Gateway (via [discord.js](https://discord.js.org/)) using your existing bot's token, and emits a workflow execution for every matching message in real time.

### Configuration

| Parameter | Description |
|---|---|
| Trigger On | Message in Channel, or Direct Message to Bot |
| Server / Channel | Searchable "From List" dropdowns (live from the Discord API) or manual ID entry. Channel mode only. |
| Ignore Bot Messages | Skip messages authored by bots (default: on) |
| Only With Content | Skip messages with no text content, e.g. embed/attachment-only (default: off) |

### Output

```json
{
  "messageId": "...",
  "content": "...",
  "channelId": "...",
  "guildId": "...",
  "isDirectMessage": false,
  "authorId": "...",
  "authorUsername": "...",
  "authorBot": false,
  "attachments": [{ "url": "...", "name": "...", "contentType": "..." }],
  "createdTimestamp": 1234567890
}
```

## Discord Send and Wait for Reply

Unlike n8n's built-in "Send and Wait for Response" (which generates an n8n-hosted web form link), this node waits for an actual Discord-native response -- a real `interactionCreate` button click, or a real text message sent using Discord's "Reply" feature (the reply arrow/swipe-to-reply, which attaches `message.reference` pointing back at the bot's message).

### Configuration

| Parameter | Description |
|---|---|
| Send To | Channel, or Direct Message to a specific user ID |
| Server / Channel | Same dropdown pattern as the trigger. Channel mode only. |
| User ID | Discord user ID to DM. The bot can only DM users who share a server with it. |
| Message Text | The message sent |
| Response Type | **Buttons** (up to 5, each with label/style/optional custom ID) or **Text Reply** (waits for the next matching message in the channel) |
| Require Explicit Discord Reply | Text Reply mode only. Off by default -- any next qualifying message counts, whether or not Discord's Reply feature was used. Turn on to require an actual Reply (matched via `message.reference`). |
| Restrict To User ID | Text Reply mode, Channel send-to only. Optional -- if set, only that user's message is captured. Automatic for DMs (there's only one possible sender). Leave blank in a channel to accept the next message from anyone. |
| Timeout (Minutes) | How long to wait for a response before giving up (default: 10) |
| On Timeout | Fail the node, or continue with `timedOut: true` |

Each execution opens its own Gateway connection, sends the message, waits for the response (or timeout), then closes the connection. If you're processing many items at once, this happens sequentially per item -- expect roughly 1-3 seconds of connection overhead per item in addition to however long people take to respond.

**Buttons mode** edits the message to show the selection and removes the buttons once clicked.
**Text Reply mode** reacts with ✅ on the message it captured. By default it captures the very next non-bot message posted in the channel/DM (optionally restricted to one user ID) -- it does **not** require Discord's Reply feature unless you turn "Require Explicit Discord Reply" on.

### Output

Buttons mode:

```json
{
  "messageId": "...",
  "channelId": "...",
  "timedOut": false,
  "responseType": "buttons",
  "buttonId": "btn_0",
  "buttonLabel": "Approve",
  "respondedBy": { "id": "...", "username": "..." },
  "respondedAt": 1234567890
}
```

Text Reply mode:

```json
{
  "messageId": "...",
  "channelId": "...",
  "timedOut": false,
  "responseType": "textReply",
  "replyContent": "Sounds good, let's do option 2",
  "replyMessageId": "...",
  "wasExplicitReply": false,
  "respondedBy": { "id": "...", "username": "..." },
  "respondedAt": 1234567890,
  "attachments": [{ "url": "...", "name": "...", "contentType": "..." }]
}
```

## Requirements

- A Discord bot application already created in the [Discord Developer Portal](https://discord.com/developers/applications), invited to your server
- The **Message Content** privileged intent enabled for the bot (Developer Portal → your app → Bot → Privileged Gateway Intents)
- Self-hosted n8n (this node has a runtime dependency, `discord.js`, so it is **not eligible for n8n Cloud** — Cloud only allows dependency-free community nodes)

## Install

In your n8n instance's custom extensions folder (usually `~/.n8n/custom`, or wherever `N8N_CUSTOM_EXTENSIONS` points):

```bash
npm install n8n-nodes-discord-channel-trigger
```

Then restart n8n. Both nodes appear in the node panel by their display names.

## Credentials

Create a **Discord Bot API** credential in n8n with your bot's token (Developer Portal → your app → Bot → Reset/Copy Token).

## Local development

```bash
npm install
npm run build       # compile + copy static files to dist/
```

To test against a local n8n instance:

```bash
npm link
cd ~/.n8n/custom
npm link n8n-nodes-discord-channel-trigger
n8n start
```

Or use the included `Dockerfile` / `docker-compose.yml` to build and run inside a container (see comments in those files).

## License

MIT
