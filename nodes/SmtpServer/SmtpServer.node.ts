import type {
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ITriggerFunctions,
	ITriggerResponse,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';
import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import type { SMTPServerDataStream, SMTPServerSession } from 'smtp-server';
import type { ParsedMail } from 'mailparser';

export class SmtpServer implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SMTP Server Trigger',
		name: 'smtpServer',
		icon: 'file:icons/smtp-server.svg',
		group: ['trigger'],
		version: 1,
		description: 'Exposes an SMTP server endpoint and triggers on sending email',
		defaults: {
			name: 'SMTP Server Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionType.Main],
		properties: [
			{
				displayName: 'Port',
				name: 'port',
				type: 'number',
				default: 2525,
				description: 'Port to listen on for SMTP connections',
				required: true,
			},
			{
				displayName: 'Host',
				name: 'host',
				type: 'string',
				default: '0.0.0.0',
				description: 'Host to bind the SMTP server to',
				required: true,
			},
			{
				displayName: 'Enable Authentication',
				name: 'enableAuth',
				type: 'boolean',
				default: false,
				description: 'Whether to enable SMTP authentication',
			},
			{
				displayName: 'Username',
				name: 'username',
				type: 'string',
				default: '',
				description: 'Username for SMTP authentication',
				displayOptions: {
					show: {
						enableAuth: [true],
					},
				},
			},
			{
				displayName: 'Password',
				name: 'password',
				type: 'string',
				typeOptions: {
					password: true,
				},
				default: '',
				description: 'Password for SMTP authentication',
				displayOptions: {
					show: {
						enableAuth: [true],
					},
				},
			},
			{
				displayName: 'Allow Insecure',
				name: 'allowInsecure',
				type: 'boolean',
				default: true,
				description: 'Whether to allow insecure connections (no TLS)',
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const port = this.getNodeParameter('port', 0) as number;
		const host = this.getNodeParameter('host', 0) as string;
		const enableAuth = this.getNodeParameter('enableAuth', 0) as boolean;
		const username = this.getNodeParameter('username', 0) as string;
		const password = this.getNodeParameter('password', 0) as string;
		const allowInsecure = this.getNodeParameter('allowInsecure', 0) as boolean;

		// Store the trigger context for use in callbacks
		const triggerContext = this;

		const server = new SMTPServer({
			secure: false, // We'll handle TLS separately if needed
			allowInsecureAuth: allowInsecure,
			authOptional: !enableAuth,
			onAuth(auth, session, callback) {
				if (!enableAuth) {
					callback(null, { user: 'anonymous' });
					return;
				}

				if (auth.username === username && auth.password === password) {
					callback(null, { user: auth.username });
				} else {
					callback(new Error('Invalid username or password'));
				}
			},
			onData(stream: SMTPServerDataStream, session: SMTPServerSession, callback) {
				let mailData = '';

				stream.on('data', (chunk) => {
					mailData += chunk.toString();
				});

				stream.on('end', async () => {
					try {
						// Parse the email using mailparser
						const parsed: ParsedMail = await simpleParser(mailData);

						// Extract the required properties
						const emailData = {
							subject: parsed.subject || '',
							to: Array.isArray(parsed.to)
								? parsed.to.map((addr) => addr.text).join(', ')
								: parsed.to?.text || '',
							from: Array.isArray(parsed.from)
								? parsed.from.map((addr) => addr.text).join(', ')
								: parsed.from?.text || '',
							body: parsed.text || parsed.html || '',
							html: parsed.html || '',
							text: parsed.text || '',
							date: parsed.date,
							messageId: parsed.messageId,
							attachments:
								parsed.attachments?.map((attachment) => ({
									filename: attachment.filename,
									contentType: attachment.contentType,
									size: attachment.size,
								})) || [],
							headers: parsed.headers,
							raw: mailData,
						};

						// Trigger the workflow with the email data
						triggerContext.emit([[{ json: emailData } as INodeExecutionData]]);
					} catch (error) {
						console.error('Error parsing email:', error);
					}

					callback();
				});

				stream.on('error', (error) => {
					console.error('Stream error:', error);
					callback(error);
				});
			},
		});

		// Start the server
		server.listen(port, host, () => {
			console.log(`SMTP Server listening on ${host}:${port}`);
		});

		// Handle server errors
		server.on('error', (error) => {
			console.error('SMTP Server error:', error);
		});

		// Store server reference for cleanup (unused but kept for potential future use)
		// const serverData: ISmtpServerData = {
		// 	server,
		// 	port,
		// 	host,
		// };

		// Return cleanup function
		const closeServer = async () => {
			return new Promise<void>((resolve) => {
				server.close(() => {
					console.log(`SMTP Server on ${host}:${port} stopped`);
					resolve();
				});
			});
		};

		return {
			closeFunction: closeServer,
		};
	}
}
