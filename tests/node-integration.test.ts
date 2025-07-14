import { SmtpServer } from '../nodes/SmtpServer/SmtpServer.node';
import { INodeTypeDescription } from 'n8n-workflow';

describe('SMTP Server Node Integration', () => {
	let node: SmtpServer;

	beforeEach(() => {
		node = new SmtpServer();
	});

	describe('Node Description', () => {
		test('should have correct node description', () => {
			const description: INodeTypeDescription = node.description;

			expect(description.displayName).toBe('SMTP Server Trigger');
			expect(description.name).toBe('smtpServer');
			expect(description.group).toEqual(['trigger']);
			expect(description.version).toBe(1);
			expect(description.description).toBe('Exposes an SMTP server endpoint and triggers on sending email');
		});

		test('should have correct defaults', () => {
			const description: INodeTypeDescription = node.description;

			expect(description.defaults).toEqual({
				name: 'SMTP Server Trigger',
			});
		});

		test('should have correct inputs and outputs', () => {
			const description: INodeTypeDescription = node.description;

			expect(description.inputs).toEqual([]);
			expect(description.outputs).toHaveLength(1);
		});

		test('should have required properties', () => {
			const description: INodeTypeDescription = node.description;
			const properties = description.properties;

			expect(properties).toHaveLength(6);

			// Check port property
			const portProperty = properties.find(p => p.name === 'port');
			expect(portProperty).toBeDefined();
			expect(portProperty!.type).toBe('number');
			expect(portProperty!.default).toBe(2525);
			expect(portProperty!.required).toBe(true);

			// Check host property
			const hostProperty = properties.find(p => p.name === 'host');
			expect(hostProperty).toBeDefined();
			expect(hostProperty!.type).toBe('string');
			expect(hostProperty!.default).toBe('0.0.0.0');
			expect(hostProperty!.required).toBe(true);

			// Check enableAuth property
			const authProperty = properties.find(p => p.name === 'enableAuth');
			expect(authProperty).toBeDefined();
			expect(authProperty!.type).toBe('boolean');
			expect(authProperty!.default).toBe(false);

			// Check username property
			const usernameProperty = properties.find(p => p.name === 'username');
			expect(usernameProperty).toBeDefined();
			expect(usernameProperty!.type).toBe('string');
			expect(usernameProperty!.default).toBe('');

			// Check password property
			const passwordProperty = properties.find(p => p.name === 'password');
			expect(passwordProperty).toBeDefined();
			expect(passwordProperty!.type).toBe('string');
			expect(passwordProperty!.typeOptions).toEqual({ password: true });
			expect(passwordProperty!.default).toBe('');

			// Check allowInsecure property
			const insecureProperty = properties.find(p => p.name === 'allowInsecure');
			expect(insecureProperty).toBeDefined();
			expect(insecureProperty!.type).toBe('boolean');
			expect(insecureProperty!.default).toBe(true);
		});

		test('should have conditional display options', () => {
			const description: INodeTypeDescription = node.description;
			const properties = description.properties;
			const usernameProperty = properties.find((p: any) => p.name === 'username');
			const passwordProperty = properties.find((p: any) => p.name === 'password');

			expect(usernameProperty!.displayOptions).toEqual({
				show: {
					enableAuth: [true],
				},
			});

			expect(passwordProperty!.displayOptions).toEqual({
				show: {
					enableAuth: [true],
				},
			});
		});
	});

	describe('Node Instantiation', () => {
		test('should create node instance', () => {
			expect(node).toBeInstanceOf(SmtpServer);
			expect(node.description).toBeDefined();
		});

		test('should have trigger method', () => {
			expect(typeof node.trigger).toBe('function');
		});
	});

	describe('Parameter Validation', () => {
		test('should validate port parameter', () => {
			const description: INodeTypeDescription = node.description;
			const properties = description.properties;
			const portProperty = properties.find((p: any) => p.name === 'port');

			expect(portProperty!.required).toBe(true);
			expect(portProperty!.type).toBe('number');
		});

		test('should validate host parameter', () => {
			const description: INodeTypeDescription = node.description;
			const properties = description.properties;
			const hostProperty = properties.find((p: any) => p.name === 'host');

			expect(hostProperty!.required).toBe(true);
			expect(hostProperty!.type).toBe('string');
		});

		test('should have optional authentication parameters', () => {
			const description: INodeTypeDescription = node.description;
			const properties = description.properties;
			const authProperty = properties.find((p: any) => p.name === 'enableAuth');
			const usernameProperty = properties.find((p: any) => p.name === 'username');
			const passwordProperty = properties.find((p: any) => p.name === 'password');

			expect(authProperty!.required).toBeUndefined();
			expect(usernameProperty!.required).toBeUndefined();
			expect(passwordProperty!.required).toBeUndefined();
		});
	});

	describe('Icon and Visual Elements', () => {
		test('should have icon defined', () => {
			const description: INodeTypeDescription = node.description;

			expect(description.icon).toBe('file:icons/smtp-server.svg');
		});
	});

	describe('Node Type Compliance', () => {
		test('should implement INodeType interface', () => {
			expect(node).toHaveProperty('description');
			expect(node).toHaveProperty('trigger');
		});

		test('should be a trigger node', () => {
			const description: INodeTypeDescription = node.description;

			expect(description.group).toContain('trigger');
			expect(description.inputs).toHaveLength(0);
			expect(description.outputs).toHaveLength(1);
		});
	});
});
