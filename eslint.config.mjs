// This node ships a runtime dependency (discord.js) and is documented as
// self-hosted only -- it is intentionally not eligible for n8n Cloud
// verification, so the Cloud-compatibility lint rules are disabled here.
import { configWithoutCloudSupport } from '@n8n/node-cli/eslint';

export default [
	...configWithoutCloudSupport,
	{
		files: ['package.json'],
		rules: {
			// discord.js is a required runtime dependency (it implements the
			// Discord Gateway/REST client this package wraps) and there is no
			// n8n-supported way to bundle it that avoids the same native
			// ws/zlib dependency chain. See README "Requirements" -- this
			// package is documented as self-hosted only for this reason.
			'@n8n/community-nodes/no-runtime-dependencies': 'off',
		},
	},
];
