import { EventEmitter } from 'events';
import { createServer, Server as NetServer, Socket } from 'net';
import { Readable } from 'stream';

export interface SMTPServerOptions {
	secure?: boolean;
	allowInsecureAuth?: boolean;
	authOptional?: boolean;
	onAuth?: (
		auth: { username: string; password: string },
		session: any,
		callback: (error: Error | null, user?: any) => void,
	) => void;
	onData?: (stream: Readable, session: any, callback: (error?: Error) => void) => void;
}

export interface SMTPServerSession {
	remoteAddress: string;
	remotePort: number;
	user?: string;
}

export class SMTPServer extends EventEmitter {
	private server: NetServer;
	private options: SMTPServerOptions;

	constructor(options: SMTPServerOptions = {}) {
		super();
		this.options = {
			secure: false,
			allowInsecureAuth: true,
			authOptional: true,
			...options,
		};

		this.server = createServer((socket: Socket) => {
			this.handleConnection(socket);
		});
	}

	private handleConnection(socket: Socket) {
		const session: SMTPServerSession = {
			remoteAddress: socket.remoteAddress || 'unknown',
			remotePort: socket.remotePort || 0,
		};

		let state = 'greeting';
		let mailData = '';
		let toAddresses: string[] = [];

		// Send greeting
		socket.write('220 SMTP Server Ready\r\n');

		socket.on('data', (data: Buffer) => {
			const lines = data.toString().split('\r\n');

			for (const line of lines) {
				if (!line) continue;

				const command = line.toUpperCase().split(' ')[0];
				const args = line.substring(command.length).trim();

				switch (state) {
					case 'greeting':
						if (command === 'EHLO' || command === 'HELO') {
							socket.write('250 Hello\r\n');
							state = 'ready';
						} else if (command === 'QUIT') {
							socket.write('221 Bye\r\n');
							socket.end();
						}
						break;

					case 'ready':
						if (command === 'AUTH') {
							if (this.options.authOptional) {
								socket.write('235 Authentication successful\r\n');
								state = 'ready';
							} else if (this.options.onAuth) {
								// Simple AUTH PLAIN implementation
								const authData = Buffer.from(args.split(' ')[1] || '', 'base64').toString();
								const [, username, password] = authData.split('\0');

								this.options.onAuth({ username, password }, session, (error, user) => {
									if (error) {
										socket.write('535 Authentication failed\r\n');
									} else {
										session.user = user?.user || username;
										socket.write('235 Authentication successful\r\n');
										state = 'ready';
									}
								});
							}
						} else if (command === 'MAIL') {
							const match = args.match(/FROM:\s*<(.+?)>/);
							if (match) {
								socket.write('250 OK\r\n');
								state = 'mail';
							} else {
								socket.write('501 Syntax error in parameters\r\n');
							}
						} else if (command === 'QUIT') {
							socket.write('221 Bye\r\n');
							socket.end();
						}
						break;

					case 'mail':
						if (command === 'RCPT') {
							const match = args.match(/TO:\s*<(.+?)>/);
							if (match) {
								toAddresses.push(match[1]);
								socket.write('250 OK\r\n');
							} else {
								socket.write('501 Syntax error in parameters\r\n');
							}
						} else if (command === 'DATA') {
							socket.write('354 Start mail input; end with <CRLF>.<CRLF>\r\n');
							state = 'data';
						} else if (command === 'QUIT') {
							socket.write('221 Bye\r\n');
							socket.end();
						}
						break;

					case 'data':
						if (line === '.') {
							// End of data
							if (this.options.onData) {
								const stream = new Readable();
								stream.push(mailData);
								stream.push(null);

								this.options.onData(stream, session, (error) => {
									if (error) {
										socket.write('550 Error processing message\r\n');
									} else {
										socket.write('250 OK\r\n');
									}
								});
							}
							state = 'ready';
							mailData = '';
							toAddresses = [];
						} else {
							mailData += line + '\r\n';
						}
						break;
				}
			}
		});

		socket.on('error', (error) => {
			this.emit('error', error);
		});

		socket.on('close', () => {
			// Connection closed
		});
	}

	listen(port: number, host: string, callback?: () => void) {
		this.server.listen(port, host, callback);
	}

	close(callback?: () => void) {
		this.server.close(callback);
	}

	on(event: 'error', listener: (error: Error) => void): this {
		return super.on(event, listener);
	}
}
