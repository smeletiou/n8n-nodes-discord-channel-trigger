// Author: Sotiris R. Meletiou (@smeletiou) - https://github.com/smeletiou
import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class DiscordBotApi implements ICredentialType {
	name = 'discordBotApi';

	displayName = 'Discord Bot API';

	icon: Icon = 'file:../nodes/DiscordChannelTrigger/discord.svg';

	documentationUrl = 'https://discord.com/developers/docs/topics/oauth2#bots';

	properties: INodeProperties[] = [
		{
			displayName: 'Bot Token',
			name: 'botToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'The bot token from the Discord Developer Portal (Applications > your app > Bot > Token). The bot must have the "Message Content" privileged intent enabled and be invited to your server.',
		},
	];

	// Attaches the bot token to every request made with this credential,
	// including the Server/Channel dropdown lookups in the node UI.
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bot {{$credentials.botToken}}',
			},
		},
	};

	// Simple validation call: fetch the bot's own user info with the token.
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://discord.com/api/v10',
			url: '/users/@me',
		},
	};
}
