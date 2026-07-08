import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	Client,
	ComponentType,
	GatewayIntentBits,
	Partials,
	TextChannel,
	DMChannel,
	Message,
} from 'discord.js';

interface DiscordGuild {
	id: string;
	name: string;
}

interface DiscordChannel {
	id: string;
	name: string;
	type: number;
}

interface ButtonDefinition {
	label: string;
	style: 'Primary' | 'Secondary' | 'Success' | 'Danger';
	customId?: string;
}

const TEXT_CHANNEL_TYPES = [0, 5, 15];
const MAX_BUTTONS = 5; // Discord's per-row limit

export class DiscordSendAndWaitForReply implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Discord Send and Wait for Reply',
		name: 'discordSendAndWaitForReply',
		icon: 'file:discord.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["responseType"]}}',
		description:
			'Sends a Discord message and pauses until someone actually responds in Discord itself -- by clicking a button, or by replying with text',
		defaults: {
			name: 'Discord Send and Wait for Reply',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'discordBotApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Send To',
				name: 'sendTo',
				type: 'options',
				options: [
					{ name: 'Channel', value: 'channel' },
					{ name: 'Direct Message to User', value: 'directMessage' },
				],
				default: 'channel',
			},
			{
				displayName: 'Server',
				name: 'server',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				displayOptions: { show: { sendTo: ['channel'] } },
				description: 'The Discord server (guild) the channel belongs to',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'e.g. my-server',
						typeOptions: { searchListMethod: 'getGuilds', searchable: true },
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. 123456789012345678',
						validation: [
							{
								type: 'regex',
								properties: { regex: '^[0-9]+$', errorMessage: 'Not a valid Discord server ID' },
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
				displayOptions: { show: { sendTo: ['channel'] } },
				description: 'The channel to send the message to. Pick a server above first.',
				typeOptions: { loadOptionsDependsOn: ['server.value'] },
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'e.g. my-channel',
						typeOptions: { searchListMethod: 'getChannels', searchable: true },
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. 123456789012345678',
						validation: [
							{
								type: 'regex',
								properties: { regex: '^[0-9]+$', errorMessage: 'Not a valid Discord channel ID' },
							},
						],
					},
				],
			},
			{
				displayName: 'User ID',
				name: 'userId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { sendTo: ['directMessage'] } },
				placeholder: 'e.g. 123456789012345678',
				description:
					'Discord user ID to DM. The bot can only DM users who share a server with it.',
			},
			{
				displayName: 'Message Text',
				name: 'messageText',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				description: 'The message to send',
			},
			{
				displayName: 'Response Type',
				name: 'responseType',
				type: 'options',
				options: [
					{
						name: 'Buttons (Fixed Choices)',
						value: 'buttons',
						description: 'Attach up to 5 buttons; waits for a click',
					},
					{
						name: 'Text Reply',
						value: 'textReply',
						description:
							'Waits for someone to use Discord\'s "Reply" on this message with free-form text',
					},
				],
				default: 'buttons',
			},
			{
				displayName: 'Buttons',
				name: 'buttons',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				placeholder: 'Add Button',
				displayOptions: { show: { responseType: ['buttons'] } },
				default: {
					button: [
						{ label: 'Approve', style: 'Success', customId: '' },
						{ label: 'Reject', style: 'Danger', customId: '' },
					],
				},
				description: `Up to ${MAX_BUTTONS} buttons attached to the message`,
				options: [
					{
						displayName: 'Button',
						name: 'button',
						values: [
							{
								displayName: 'Label',
								name: 'label',
								type: 'string',
								default: '',
								required: true,
							},
							{
								displayName: 'Style',
								name: 'style',
								type: 'options',
								options: [
									{ name: 'Primary', value: 'Primary' },
									{ name: 'Secondary', value: 'Secondary' },
									{ name: 'Success', value: 'Success' },
									{ name: 'Danger', value: 'Danger' },
								],
								default: 'Primary',
							},
							{
								displayName: 'Custom ID',
								name: 'customId',
								type: 'string',
								default: '',
								description:
									'Optional. Used to identify which button was clicked in the output. Auto-generated if left blank.',
							},
						],
					},
				],
			},
			{
				displayName: 'Require Explicit Discord Reply',
				name: 'requireExplicitReply',
				type: 'boolean',
				default: false,
				displayOptions: { show: { responseType: ['textReply'] } },
				description:
					'Whether the response must use Discord\'s "Reply" feature on this exact message. If off (default), the next matching message anywhere in the channel counts, whether or not Reply was used.',
			},
			{
				displayName: 'Restrict To User ID',
				name: 'expectedUserId',
				type: 'string',
				default: '',
				displayOptions: { show: { responseType: ['textReply'], sendTo: ['channel'] } },
				placeholder: 'e.g. 123456789012345678',
				description:
					'Optional. If set, only a message from this Discord user ID will be captured. Leave blank to accept the next message from anyone in the channel (recommended for DMs, this is automatic).',
			},
			{
				displayName: 'Timeout (Minutes)',
				name: 'timeoutMinutes',
				type: 'number',
				default: 10,
				description: 'How long to wait for a response before giving up',
			},
			{
				displayName: 'On Timeout',
				name: 'onTimeout',
				type: 'options',
				options: [
					{ name: 'Fail the Node', value: 'fail' },
					{ name: 'Continue, Marking No Response', value: 'continue' },
				],
				default: 'continue',
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('discordBotApi');

		for (let i = 0; i < items.length; i++) {
			const sendTo = this.getNodeParameter('sendTo', i) as 'channel' | 'directMessage';
			const messageText = this.getNodeParameter('messageText', i) as string;
			const responseType = this.getNodeParameter('responseType', i) as 'buttons' | 'textReply';
			const timeoutMinutes = this.getNodeParameter('timeoutMinutes', i) as number;
			const onTimeout = this.getNodeParameter('onTimeout', i) as 'fail' | 'continue';

			let buttonDefs: ButtonDefinition[] = [];
			let requireExplicitReply = false;
			let expectedUserId = '';
			if (responseType === 'buttons') {
				buttonDefs = (
					(this.getNodeParameter('buttons', i, {}) as { button?: ButtonDefinition[] }).button ?? []
				).slice(0, MAX_BUTTONS);

				if (buttonDefs.length === 0) {
					throw new NodeOperationError(this.getNode(), 'Add at least one button', { itemIndex: i });
				}
			} else {
				requireExplicitReply = this.getNodeParameter('requireExplicitReply', i, false) as boolean;
			}

			let channelId = '';
			let userId = '';
			if (sendTo === 'channel') {
				channelId = this.getNodeParameter('channel', i, undefined, { extractValue: true }) as string;
				if (responseType === 'textReply') {
					expectedUserId = this.getNodeParameter('expectedUserId', i, '') as string;
				}
			} else {
				userId = this.getNodeParameter('userId', i) as string;
				if (responseType === 'textReply') {
					expectedUserId = userId; // DMs are inherently 1:1 with this user
				}
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

			try {
				await client.login(credentials.botToken as string);
				await new Promise<void>((resolve) => {
					if (client.isReady()) return resolve();
					client.once('ready', () => resolve());
				});

				let targetChannel: TextChannel | DMChannel;
				if (sendTo === 'channel') {
					targetChannel = (await client.channels.fetch(channelId)) as TextChannel;
				} else {
					const user = await client.users.fetch(userId);
					targetChannel = await user.createDM();
				}

				const idFor = (b: ButtonDefinition, idx: number) => b.customId || `btn_${idx}`;

				const components =
					responseType === 'buttons'
						? [
								new ActionRowBuilder<ButtonBuilder>().addComponents(
									buttonDefs.map((b, idx) =>
										new ButtonBuilder()
											.setCustomId(idFor(b, idx))
											.setLabel(b.label)
											.setStyle(ButtonStyle[b.style]),
									),
								),
							]
						: [];

				const sentMessage = await targetChannel.send({ content: messageText, components });

				let resultJson: Record<string, unknown>;

				if (responseType === 'buttons') {
					try {
						const interaction = await sentMessage.awaitMessageComponent({
							componentType: ComponentType.Button,
							time: timeoutMinutes * 60 * 1000,
						});

						const clickedButton = buttonDefs.find(
							(b, idx) => idFor(b, idx) === interaction.customId,
						);

						await interaction.update({
							content: `${messageText}\n\n_Selected: **${clickedButton?.label ?? interaction.customId}**_`,
							components: [],
						});

						resultJson = {
							timedOut: false,
							responseType: 'buttons',
							buttonId: interaction.customId,
							buttonLabel: clickedButton?.label,
							respondedBy: {
								id: interaction.user.id,
								username: interaction.user.username,
							},
							respondedAt: Date.now(),
						};
					} catch {
						if (onTimeout === 'fail') {
							throw new NodeOperationError(
								this.getNode(),
								'Timed out waiting for a button response',
								{ itemIndex: i },
							);
						}
						resultJson = { timedOut: true, responseType: 'buttons' };
						await sentMessage
							.edit({ content: `${messageText}\n\n_No response received in time._`, components: [] })
							.catch(() => {});
					}
				} else {
					try {
						const collected = await targetChannel.awaitMessages({
							filter: (m: Message) => {
								if (m.author.bot) return false;
								if (expectedUserId && m.author.id !== expectedUserId) return false;
								if (requireExplicitReply && m.reference?.messageId !== sentMessage.id) return false;
								return true;
							},
							max: 1,
							time: timeoutMinutes * 60 * 1000,
							errors: ['time'],
						});
						const replyMessage = collected.first()!;

						resultJson = {
							timedOut: false,
							responseType: 'textReply',
							replyContent: replyMessage.content,
							replyMessageId: replyMessage.id,
							wasExplicitReply: replyMessage.reference?.messageId === sentMessage.id,
							respondedBy: {
								id: replyMessage.author.id,
								username: replyMessage.author.username,
							},
							respondedAt: replyMessage.createdTimestamp,
							attachments: replyMessage.attachments.map((a) => ({
								url: a.url,
								name: a.name,
								contentType: a.contentType,
							})),
						};

						await replyMessage.react('✅').catch(() => {});
					} catch {
						if (onTimeout === 'fail') {
							throw new NodeOperationError(
								this.getNode(),
								'Timed out waiting for a text reply',
								{ itemIndex: i },
							);
						}
						resultJson = { timedOut: true, responseType: 'textReply' };
						await sentMessage
							.edit({ content: `${messageText}\n\n_No reply received in time._` })
							.catch(() => {});
					}
				}

				returnData.push({
					json: {
						messageId: sentMessage.id,
						channelId: sentMessage.channelId,
						...resultJson,
					},
				});
			} finally {
				await client.destroy();
			}
		}

		return [returnData];
	}
}
