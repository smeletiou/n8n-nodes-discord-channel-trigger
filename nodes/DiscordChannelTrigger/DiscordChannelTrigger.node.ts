import type {
	ITriggerFunctions,
	ILoadOptionsFunctions,
	INodeType,
	INodeTypeDescription,
	INodeListSearchResult,
	ITriggerResponse,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { Client, GatewayIntentBits, Partials, Message } from 'discord.js';

interface DiscordGuild {
	id: string;
	name: string;
}

interface DiscordChannel {
	id: string;
	name: string;
	type: number;
}

// Discord channel types that can actually receive text messages a trigger
// would care about: 0 = GUILD_TEXT, 5 = GUILD_ANNOUNCEMENT, 15 = GUILD_FORUM.
const TEXT_CHANNEL_TYPES = [0, 5, 15];

export class DiscordChannelTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Discord Channel Trigger',
		name: 'discordChannelTrigger',
		icon: 'file:discord.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["triggerOn"] === "directMessage" ? "Direct Message" : $parameter["channel"]}}',
		description: 'Starts the workflow when your bot sees a new message in a channel or DM',
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
				displayName: 'Trigger On',
				name: 'triggerOn',
				type: 'options',
				options: [
					{ name: 'Message in Channel', value: 'channelMessage' },
					{ name: 'Direct Message to Bot', value: 'directMessage' },
				],
				default: 'channelMessage',
				description:
					'Whether to listen for messages posted in a server channel, or direct messages sent to the bot',
			},
			{
				displayName: 'Server',
				name: 'server',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				displayOptions: {
					show: { triggerOn: ['channelMessage'] },
				},
				description: 'The Discord server (guild) the channel belongs to',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'e.g. my-server',
						typeOptions: {
							searchListMethod: 'getGuilds',
							searchable: true,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. 123456789012345678',
						validation: [
							{
								type: 'regex',
								properties: {
									regex: '^[0-9]+$',
									errorMessage: 'Not a valid Discord server ID',
								},
							},
						],
					},
				],
			},
			{
				displayName: 'Channel',
				name: 'channel',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				displayOptions: {
					show: { triggerOn: ['channelMessage'] },
				},
				description: 'The channel to listen to. Pick a server above first.',
				typeOptions: {
					loadOptionsDependsOn: ['server.value'],
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'e.g. my-channel',
						typeOptions: {
							searchListMethod: 'getChannels',
							searchable: true,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. 123456789012345678',
						validation: [
							{
								type: 'regex',
								properties: {
									regex: '^[0-9]+$',
									errorMessage: 'Not a valid Discord channel ID',
								},
							},
						],
					},
				],
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
				description:
					'Whether to skip messages that have no text content (e.g. embed-only or attachment-only messages)',
			},
		],
	};

	methods = {
		listSearch: {
			async getGuilds(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
				const guilds = (await this.helpers.httpRequestWithAuthentication.call(this, 'discordBotApi', {
					method: 'GET',
					url: 'https://discord.com/api/v10/users/@me/guilds',
					json: true,
				})) as DiscordGuild[];

				let results = guilds.map((guild) => ({ name: guild.name, value: guild.id }));

				if (filter) {
					const lowerFilter = filter.toLowerCase();
					results = results.filter((r) => r.name.toLowerCase().includes(lowerFilter));
				}

				results.sort((a, b) => a.name.localeCompare(b.name));

				return { results };
			},

			async getChannels(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
				const guildId = this.getNodeParameter('server', undefined, {
					extractValue: true,
				}) as string;

				if (!guildId) {
					throw new NodeOperationError(this.getNode(), 'Select a server first');
				}

				const channels = (await this.helpers.httpRequestWithAuthentication.call(this, 'discordBotApi', {
					method: 'GET',
					url: `https://discord.com/api/v10/guilds/${guildId}/channels`,
					json: true,
				})) as DiscordChannel[];

				let results = channels
					.filter((channel) => TEXT_CHANNEL_TYPES.includes(channel.type))
					.map((channel) => ({ name: `#${channel.name}`, value: channel.id }));

				if (filter) {
					const lowerFilter = filter.toLowerCase();
					results = results.filter((r) => r.name.toLowerCase().includes(lowerFilter));
				}

				results.sort((a, b) => a.name.localeCompare(b.name));

				return { results };
			},
		},
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const credentials = await this.getCredentials('discordBotApi');
		const triggerOn = this.getNodeParameter('triggerOn') as 'channelMessage' | 'directMessage';
		const ignoreBots = this.getNodeParameter('ignoreBots') as boolean;
		const requireContent = this.getNodeParameter('requireContent') as boolean;

		let channelId: string | undefined;
		if (triggerOn === 'channelMessage') {
			channelId = this.getNodeParameter('channel', undefined, { extractValue: true }) as string;
		}

		const client = new Client({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.DirectMessages,
				GatewayIntentBits.MessageContent,
			],
			partials: [Partials.Channel, Partials.Message],
		});

		const messageHandler = (message: Message) => {
			try {
				if (triggerOn === 'channelMessage') {
					if (message.channelId !== channelId) return;
				} else {
					// Direct Message mode: only messages with no guild (i.e. DMs).
					if (message.guildId) return;
				}

				if (ignoreBots && message.author.bot) return;
				if (requireContent && !message.content) return;

				this.emit([
					this.helpers.returnJsonArray([
						{
							messageId: message.id,
							content: message.content,
							channelId: message.channelId,
							guildId: message.guildId,
							isDirectMessage: !message.guildId,
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
