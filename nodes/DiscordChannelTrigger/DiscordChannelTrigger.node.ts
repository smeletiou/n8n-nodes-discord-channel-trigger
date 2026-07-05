import type {
	ITriggerFunctions,
	INodeType,
	INodeTypeDescription,
	ITriggerResponse,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import { Client, GatewayIntentBits, Partials, Message } from 'discord.js';

export class DiscordChannelTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Discord Channel Trigger',
		name: 'discordChannelTrigger',
		icon: 'file:discord.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["channelIds"]}}',
		description: 'Starts the workflow when your bot sees a new message in specific channels',
		defaults: {
			name: 'Discord Channel Trigger',
		},
		usableAsTool: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'discordBotApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Channel IDs',
				name: 'channelIds',
				type: 'string',
				default: '',
				required: true,
				placeholder: '123456789012345678, 234567890123456789',
				description:
					'Comma-separated list of Discord channel IDs to listen to. Right-click a channel in Discord (Developer Mode on) and choose "Copy Channel ID".',
			},
			{
				displayName: 'Ignore Bot Messages',
				name: 'ignoreBots',
				type: 'boolean',
				default: true,
				description: 'Whether to skip messages sent by other bots (including this bot itself)',
			},
			{
				displayName: 'Only With Content',
				name: 'requireContent',
				type: 'boolean',
				default: false,
				description: 'Whether to skip messages that have no text content (e.g. embed-only or attachment-only messages)',
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const credentials = await this.getCredentials('discordBotApi');
		const channelIdsRaw = this.getNodeParameter('channelIds') as string;
		const ignoreBots = this.getNodeParameter('ignoreBots') as boolean;
		const requireContent = this.getNodeParameter('requireContent') as boolean;

		const channelIds = channelIdsRaw
			.split(',')
			.map((id) => id.trim())
			.filter((id) => id.length > 0);

		const client = new Client({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.MessageContent,
			],
			partials: [Partials.Channel, Partials.Message],
		});

		const messageHandler = (message: Message) => {
			try {
				if (!channelIds.includes(message.channelId)) return;
				if (ignoreBots && message.author.bot) return;
				if (requireContent && !message.content) return;

				this.emit([
					this.helpers.returnJsonArray([
						{
							messageId: message.id,
							content: message.content,
							channelId: message.channelId,
							guildId: message.guildId,
							authorId: message.author.id,
							authorUsername: message.author.username,
							authorBot: message.author.bot,
							attachments: message.attachments.map((a) => ({
								url: a.url,
								name: a.name,
								contentType: a.contentType,
							})),
							createdTimestamp: message.createdTimestamp,
						},
					]),
				]);
			} catch (error) {
				this.logger.error('Discord Channel Trigger: failed to process message', { error });
			}
		};

		client.on('messageCreate', messageHandler);
		client.on('error', (error) => {
			this.logger.error('Discord Channel Trigger: client error', { error });
		});

		await client.login(credentials.botToken as string);

		// Called by n8n when the workflow is deactivated or the node is removed.
		const closeFunction = async () => {
			client.off('messageCreate', messageHandler);
			await client.destroy();
		};

		// Called when the user clicks "Listen for test event" in the editor.
		// We just reuse the same live connection since Discord has no concept
		// of replaying a single past event on demand.
		const manualTriggerFunction = async () => {
			if (!client.isReady()) {
				await client.login(credentials.botToken as string);
			}
		};

		return {
			closeFunction,
			manualTriggerFunction,
		};
	}
}
