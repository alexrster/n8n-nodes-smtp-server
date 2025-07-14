import { SMTPServer } from '../nodes/SmtpServer/embedded/smtp-server';
import { EventEmitter } from 'events';

// Mock Socket for testing
class MockSocket extends EventEmitter {
	public remoteAddress = '127.0.0.1';
	public remotePort = 12345;
	public writtenData: string[] = [];
	public ended = false;

	write(data: string): boolean {
		this.writtenData.push(data);
		return true;
	}

	end(): void {
		this.ended = true;
		this.emit('close');
	}
}

describe('Embedded SMTP Server', () => {
	let server: SMTPServer;
	let mockSocket: MockSocket;

	beforeEach(() => {
		server = new SMTPServer();
		mockSocket = new MockSocket();
	});

	afterEach(() => {
		server.close();
	});

	describe('Server Initialization', () => {
		test('should create server with default options', () => {
			expect(server).toBeInstanceOf(SMTPServer);
			expect(server).toBeInstanceOf(EventEmitter);
		});

		test('should create server with custom options', () => {
			const customServer = new SMTPServer({
				secure: true,
				allowInsecureAuth: false,
				authOptional: false,
			});
			expect(customServer).toBeInstanceOf(SMTPServer);
			customServer.close();
		});
	});

	describe('SMTP Protocol - Greeting', () => {
		test('should respond to EHLO command', () => {
			// Simulate connection
			server['handleConnection'](mockSocket as any);

			// Send EHLO
			mockSocket.emit('data', Buffer.from('EHLO test.com\r\n'));

			expect(mockSocket.writtenData).toContain('220 SMTP Server Ready\r\n');
			expect(mockSocket.writtenData).toContain('250 Hello\r\n');
		});

		test('should respond to HELO command', () => {
			server['handleConnection'](mockSocket as any);
			mockSocket.emit('data', Buffer.from('HELO test.com\r\n'));

			expect(mockSocket.writtenData).toContain('250 Hello\r\n');
		});

		test('should handle QUIT command', () => {
			server['handleConnection'](mockSocket as any);
			mockSocket.emit('data', Buffer.from('QUIT\r\n'));

			expect(mockSocket.writtenData).toContain('221 Bye\r\n');
			expect(mockSocket.ended).toBe(true);
		});

		test('should handle unknown commands in greeting state', () => {
			server['handleConnection'](mockSocket as any);
			mockSocket.emit('data', Buffer.from('UNKNOWN\r\n'));

			// Should not respond to unknown commands in greeting state
			expect(mockSocket.writtenData).toContain('220 SMTP Server Ready\r\n');
			expect(mockSocket.writtenData).not.toContain('250 Hello\r\n');
		});
	});

	describe('SMTP Protocol - Authentication', () => {
		test('should handle AUTH when authOptional is true', () => {
			server['handleConnection'](mockSocket as any);
			mockSocket.emit('data', Buffer.from('EHLO test.com\r\n'));
			mockSocket.emit('data', Buffer.from('AUTH PLAIN\r\n'));

			expect(mockSocket.writtenData).toContain('235 Authentication successful\r\n');
		});

		test('should handle AUTH with custom auth handler', () => {
			let authCalled = false;
			const customServer = new SMTPServer({
				authOptional: false,
				onAuth: (auth, session, callback) => {
					authCalled = true;
					expect(auth.username).toBe('testuser');
					expect(auth.password).toBe('testpass');
					callback(null, { user: 'testuser' });
				},
			});

			const customSocket = new MockSocket();
			customServer['handleConnection'](customSocket as any);
			customSocket.emit('data', Buffer.from('EHLO test.com\r\n'));

			// Send AUTH PLAIN with base64 encoded credentials
			const authData = Buffer.from('\0testuser\0testpass').toString('base64');
			customSocket.emit('data', Buffer.from(`AUTH PLAIN ${authData}\r\n`));

			expect(authCalled).toBe(true);
			expect(customSocket.writtenData).toContain('235 Authentication successful\r\n');

			customServer.close();
		});

		test('should handle AUTH failure', () => {
			const customServer = new SMTPServer({
				authOptional: false,
				onAuth: (auth, session, callback) => {
					callback(new Error('Invalid credentials'));
				},
			});

			const customSocket = new MockSocket();
			customServer['handleConnection'](customSocket as any);
			customSocket.emit('data', Buffer.from('EHLO test.com\r\n'));

			const authData = Buffer.from('\0wronguser\0wrongpass').toString('base64');
			customSocket.emit('data', Buffer.from(`AUTH PLAIN ${authData}\r\n`));

			expect(customSocket.writtenData).toContain('535 Authentication failed\r\n');

			customServer.close();
		});
	});

	describe('SMTP Protocol - Mail Transaction', () => {
		beforeEach(() => {
			server['handleConnection'](mockSocket as any);
			mockSocket.emit('data', Buffer.from('EHLO test.com\r\n'));
		});

		test('should handle MAIL FROM command', () => {
			mockSocket.emit('data', Buffer.from('MAIL FROM:<sender@test.com>\r\n'));

			expect(mockSocket.writtenData).toContain('250 OK\r\n');
		});

		test('should handle invalid MAIL FROM command', () => {
			mockSocket.emit('data', Buffer.from('MAIL FROM:invalid\r\n'));

			expect(mockSocket.writtenData).toContain('501 Syntax error in parameters\r\n');
		});

		test('should handle RCPT TO command', () => {
			mockSocket.emit('data', Buffer.from('MAIL FROM:<sender@test.com>\r\n'));
			mockSocket.emit('data', Buffer.from('RCPT TO:<recipient@test.com>\r\n'));

			expect(mockSocket.writtenData).toContain('250 OK\r\n');
		});

		test('should handle multiple RCPT TO commands', () => {
			mockSocket.emit('data', Buffer.from('MAIL FROM:<sender@test.com>\r\n'));
			mockSocket.emit('data', Buffer.from('RCPT TO:<recipient1@test.com>\r\n'));
			mockSocket.emit('data', Buffer.from('RCPT TO:<recipient2@test.com>\r\n'));

			expect(mockSocket.writtenData.filter(data => data.includes('250 OK\r\n'))).toHaveLength(3);
		});

		test('should handle invalid RCPT TO command', () => {
			mockSocket.emit('data', Buffer.from('MAIL FROM:<sender@test.com>\r\n'));
			mockSocket.emit('data', Buffer.from('RCPT TO:invalid\r\n'));

			expect(mockSocket.writtenData).toContain('501 Syntax error in parameters\r\n');
		});

		test('should handle DATA command', () => {
			mockSocket.emit('data', Buffer.from('MAIL FROM:<sender@test.com>\r\n'));
			mockSocket.emit('data', Buffer.from('RCPT TO:<recipient@test.com>\r\n'));
			mockSocket.emit('data', Buffer.from('DATA\r\n'));

			expect(mockSocket.writtenData).toContain('354 Start mail input; end with <CRLF>.<CRLF>\r\n');
		});
	});

	describe('SMTP Protocol - Data Transfer', () => {
		beforeEach(() => {
			server['handleConnection'](mockSocket as any);
			mockSocket.emit('data', Buffer.from('EHLO test.com\r\n'));
			mockSocket.emit('data', Buffer.from('MAIL FROM:<sender@test.com>\r\n'));
			mockSocket.emit('data', Buffer.from('RCPT TO:<recipient@test.com>\r\n'));
			mockSocket.emit('data', Buffer.from('DATA\r\n'));
		});

		test('should handle email data transfer', () => {
			let dataReceived = false;
			server = new SMTPServer({
				onData: (stream, session, callback) => {
					dataReceived = true;
					expect(session.remoteAddress).toBe('127.0.0.1');
					expect(session.remotePort).toBe(12345);
					callback();
				},
			});

			const newSocket = new MockSocket();
			server['handleConnection'](newSocket as any);
			newSocket.emit('data', Buffer.from('EHLO test.com\r\n'));
			newSocket.emit('data', Buffer.from('MAIL FROM:<sender@test.com>\r\n'));
			newSocket.emit('data', Buffer.from('RCPT TO:<recipient@test.com>\r\n'));
			newSocket.emit('data', Buffer.from('DATA\r\n'));
			newSocket.emit('data', Buffer.from('Subject: Test\r\n\r\nHello World\r\n.\r\n'));

			expect(dataReceived).toBe(true);
			expect(newSocket.writtenData).toContain('250 OK\r\n');
		});

		test('should handle multiline email data', (done) => {
			let receivedData = '';
			server = new SMTPServer({
				onData: (stream, session, callback) => {
					stream.on('data', (chunk) => {
						receivedData += chunk.toString();
					});
					stream.on('end', () => {
						expect(receivedData).toContain('Subject: Test');
						expect(receivedData).toContain('Line 1');
						expect(receivedData).toContain('Line 2');
						expect(receivedData).toContain('Line 3');
						callback();
						done();
					});
				},
			});

			const newSocket = new MockSocket();
			server['handleConnection'](newSocket as any);
			newSocket.emit('data', Buffer.from('EHLO test.com\r\n'));
			newSocket.emit('data', Buffer.from('MAIL FROM:<sender@test.com>\r\n'));
			newSocket.emit('data', Buffer.from('RCPT TO:<recipient@test.com>\r\n'));
			newSocket.emit('data', Buffer.from('DATA\r\n'));
			newSocket.emit('data', Buffer.from('Subject: Test\r\n\r\nLine 1\r\nLine 2\r\nLine 3\r\n.\r\n'));
		});

		test('should handle data transfer error', () => {
			server = new SMTPServer({
				onData: (stream, session, callback) => {
					callback(new Error('Processing error'));
				},
			});

			const newSocket = new MockSocket();
			server['handleConnection'](newSocket as any);
			newSocket.emit('data', Buffer.from('EHLO test.com\r\n'));
			newSocket.emit('data', Buffer.from('MAIL FROM:<sender@test.com>\r\n'));
			newSocket.emit('data', Buffer.from('RCPT TO:<recipient@test.com>\r\n'));
			newSocket.emit('data', Buffer.from('DATA\r\n'));
			newSocket.emit('data', Buffer.from('Subject: Test\r\n\r\nHello\r\n.\r\n'));

			expect(newSocket.writtenData).toContain('550 Error processing message\r\n');
		});
	});

	describe('Server Lifecycle', () => {
		test('should listen on specified port and host', () => {
			const listenSpy = jest.spyOn(server['server'], 'listen');
			const callback = jest.fn();

			server.listen(2525, '127.0.0.1', callback);

			expect(listenSpy).toHaveBeenCalledWith(2525, '127.0.0.1', callback);
		});

		test('should close server', () => {
			const closeSpy = jest.spyOn(server['server'], 'close');
			const callback = jest.fn();

			server.close(callback);

			expect(closeSpy).toHaveBeenCalledWith(callback);
		});

		test('should emit error events', () => {
			const errorHandler = jest.fn();
			server.on('error', errorHandler);

			const testError = new Error('Test error');
			server.emit('error', testError);

			expect(errorHandler).toHaveBeenCalledWith(testError);
		});
	});

	describe('Edge Cases', () => {
		test('should handle empty data', () => {
			server['handleConnection'](mockSocket as any);
			mockSocket.emit('data', Buffer.from(''));

			expect(mockSocket.writtenData).toContain('220 SMTP Server Ready\r\n');
		});

		test('should handle malformed commands', () => {
			server['handleConnection'](mockSocket as any);
			mockSocket.emit('data', Buffer.from('EHLO test.com\r\n'));
			mockSocket.emit('data', Buffer.from('MAIL\r\n')); // Missing FROM

			expect(mockSocket.writtenData).toContain('501 Syntax error in parameters\r\n');
		});

		test('should handle connection close', () => {
			server['handleConnection'](mockSocket as any);

			// Should not throw when connection closes
			expect(() => {
				mockSocket.emit('close');
			}).not.toThrow();
		});
	});
});
