import { simpleParser, AddressObject } from '../nodes/SmtpServer/embedded/mail-parser';

describe('Embedded Mail Parser', () => {
	describe('Header Parsing', () => {
		test('should parse basic headers', async () => {
			const rawEmail = `From: "John Doe" <john@example.com>
To: "Jane Smith" <jane@example.com>
Subject: Test Email
Date: Mon, 15 Jan 2024 10:30:00 +0000
Message-ID: <test123@example.com>

Hello World`;

			const result = await simpleParser(rawEmail);

			expect(result.subject).toBe('Test Email');
			expect(result.date).toEqual(new Date('Mon, 15 Jan 2024 10:30:00 +0000'));
			expect(result.messageId).toBe('<test123@example.com>');
			expect(result.headers['from']).toBe('"John Doe" <john@example.com>');
			expect(result.headers['to']).toBe('"Jane Smith" <jane@example.com>');
		});

		test('should parse headers with continuation lines', async () => {
			const rawEmail = `From: "John Doe"
 <john@example.com>
Subject: Long Subject Line That
 Continues on Multiple Lines
Date: Mon, 15 Jan 2024 10:30:00 +0000

Hello World`;

			const result = await simpleParser(rawEmail);

			expect(result.headers['from']).toBe('"John Doe"  <john@example.com>');
			expect(result.headers['subject']).toBe('Long Subject Line That  Continues on Multiple Lines');
		});

		test('should handle missing headers gracefully', async () => {
			const rawEmail = `From: john@example.com

Hello World`;

			const result = await simpleParser(rawEmail);

			expect(result.subject).toBe('');
			expect(result.to).toEqual({ text: '', address: '' });
			expect(result.date).toBeUndefined();
			expect(result.messageId).toBe('');
		});

		test('should parse headers with special characters', async () => {
			const rawEmail = `From: "José María" <jose@example.com>
Subject: Test with special chars: áéíóú
Content-Type: text/plain; charset=utf-8

Hello World`;

			const result = await simpleParser(rawEmail);

			expect(result.headers['from']).toBe('"José María" <jose@example.com>');
			expect(result.subject).toBe('Test with special chars: áéíóú');
		});
	});

	describe('Address Parsing', () => {
		test('should parse single address with name', async () => {
			const rawEmail = `From: "John Doe" <john@example.com>
To: "Jane Smith" <jane@example.com>

Hello`;

			const result = await simpleParser(rawEmail);

			expect(result.from).toEqual({
				text: '"John Doe" <john@example.com>',
				address: 'john@example.com',
				name: 'John Doe',
			});

			expect(result.to).toEqual({
				text: '"Jane Smith" <jane@example.com>',
				address: 'jane@example.com',
				name: 'Jane Smith',
			});
		});

		test('should parse single address without name', async () => {
			const rawEmail = `From: <john@example.com>
To: jane@example.com

Hello`;

			const result = await simpleParser(rawEmail);

			expect(result.from).toEqual({
				text: '<john@example.com>',
				address: 'john@example.com',
			});

			expect(result.to).toEqual({
				text: 'jane@example.com',
				address: 'jane@example.com',
			});
		});

		test('should parse multiple addresses', async () => {
			const rawEmail = `From: "John Doe" <john@example.com>
To: "Jane Smith" <jane@example.com>, "Bob Wilson" <bob@example.com>

Hello`;

			const result = await simpleParser(rawEmail);

			expect(Array.isArray(result.to)).toBe(true);
			expect(result.to).toHaveLength(2);
			expect((result.to as AddressObject[])[0]).toEqual({
				text: '"Jane Smith" <jane@example.com>',
				address: 'jane@example.com',
				name: 'Jane Smith',
			});
			expect((result.to as AddressObject[])[1]).toEqual({
				text: '"Bob Wilson" <bob@example.com>',
				address: 'bob@example.com',
				name: 'Bob Wilson',
			});
		});

		test('should handle malformed addresses', async () => {
			const rawEmail = `From: invalid-address
To: <incomplete

Hello`;

			const result = await simpleParser(rawEmail);

			expect(result.from).toEqual({
				text: 'invalid-address',
				address: 'invalid-address',
			});

			expect(result.to).toEqual({
				text: '<incomplete',
				address: '<incomplete',
			});
		});
	});

	describe('Content Parsing', () => {
		test('should parse plain text email', async () => {
			const rawEmail = `From: john@example.com
To: jane@example.com
Subject: Test

This is a plain text email.
It has multiple lines.
And some formatting.`;

			const result = await simpleParser(rawEmail);

			expect(result.text).toBe('This is a plain text email.\r\nIt has multiple lines.\r\nAnd some formatting.');
			expect(result.html).toBe('');
		});

		test('should parse HTML email', async () => {
			const rawEmail = `From: john@example.com
To: jane@example.com
Content-Type: text/html

<html><body><h1>Hello</h1><p>This is HTML content.</p></body></html>`;

			const result = await simpleParser(rawEmail);

			expect(result.html).toBe('<html><body><h1>Hello</h1><p>This is HTML content.</p></body></html>');
			expect(result.text).toBe('Hello This is HTML content.');
		});

		test('should parse multipart email with text and HTML', async () => {
			const rawEmail = `From: john@example.com
To: jane@example.com
Subject: Multipart Test
Content-Type: multipart/alternative; boundary="boundary123"

--boundary123
Content-Type: text/plain

This is the plain text version.

--boundary123
Content-Type: text/html

<html><body><h1>This is the HTML version.</h1></body></html>

--boundary123--`;

			const result = await simpleParser(rawEmail);

			expect(result.text).toBe('This is the plain text version.');
			expect(result.html).toBe('<html><body><h1>This is the HTML version.</h1></body></html>');
		});

		test('should handle multipart with mixed content', async () => {
			const rawEmail = `From: john@example.com
To: jane@example.com
Subject: Mixed Content
Content-Type: multipart/mixed; boundary="mixed123"

--mixed123
Content-Type: text/plain

Hello World

--mixed123
Content-Type: application/pdf; name="document.pdf"
Content-Disposition: attachment; filename="document.pdf"

PDF_CONTENT_HERE

--mixed123--`;

			const result = await simpleParser(rawEmail);

			expect(result.text).toBe('Hello World');
			expect(result.attachments).toHaveLength(1);
			expect(result.attachments![0].filename).toBe('document.pdf');
			expect(result.attachments![0].contentType).toBe('application/pdf');
		});
	});

	describe('Attachment Parsing', () => {
		test('should parse attachments with filename', async () => {
			const rawEmail = `From: john@example.com
To: jane@example.com
Content-Type: multipart/mixed; boundary="boundary123"

--boundary123
Content-Type: text/plain

Hello

--boundary123
Content-Type: application/pdf; name="document.pdf"
Content-Disposition: attachment; filename="document.pdf"

PDF_CONTENT

--boundary123--`;

			const result = await simpleParser(rawEmail);

			expect(result.attachments).toHaveLength(1);
			expect(result.attachments![0].filename).toBe('document.pdf');
			expect(result.attachments![0].contentType).toBe('application/pdf');
			expect(result.attachments![0].size).toBe(11); // "PDF_CONTENT" length
		});

		test('should parse multiple attachments', async () => {
			const rawEmail = `From: john@example.com
To: jane@example.com
Content-Type: multipart/mixed; boundary="boundary123"

--boundary123
Content-Type: text/plain

Hello

--boundary123
Content-Type: application/pdf; name="doc1.pdf"
Content-Disposition: attachment; filename="doc1.pdf"

PDF1

--boundary123
Content-Type: image/jpeg; name="image.jpg"
Content-Disposition: attachment; filename="image.jpg"

IMAGE

--boundary123--`;

			const result = await simpleParser(rawEmail);

			expect(result.attachments).toHaveLength(2);
			expect(result.attachments![0].filename).toBe('doc1.pdf');
			expect(result.attachments![0].contentType).toBe('application/pdf');
			expect(result.attachments![1].filename).toBe('image.jpg');
			expect(result.attachments![1].contentType).toBe('image/jpeg');
		});

		test('should handle attachments without filename', async () => {
			const rawEmail = `From: john@example.com
To: jane@example.com
Content-Type: multipart/mixed; boundary="boundary123"

--boundary123
Content-Type: text/plain

Hello

--boundary123
Content-Type: application/octet-stream
Content-Disposition: attachment

BINARY_DATA

--boundary123--`;

			const result = await simpleParser(rawEmail);

			expect(result.attachments).toHaveLength(1);
			expect(result.attachments![0].filename).toBe('');
			expect(result.attachments![0].contentType).toBe('application/octet-stream');
		});

		test('should handle inline attachments', async () => {
			const rawEmail = `From: john@example.com
To: jane@example.com
Content-Type: multipart/mixed; boundary="boundary123"

--boundary123
Content-Type: text/html

<html><body><img src="cid:image.jpg"></body></html>

--boundary123
Content-Type: image/jpeg; name="image.jpg"
Content-Disposition: inline; filename="image.jpg"

IMAGE_DATA

--boundary123--`;

			const result = await simpleParser(rawEmail);

			// Inline attachments should not be included in attachments array
			expect(result.attachments).toHaveLength(0);
			expect(result.html).toBe('<html><body><img src="cid:image.jpg"></body></html>');
		});
	});

	describe('HTML Stripping', () => {
		test('should strip HTML tags from text content', async () => {
			const rawEmail = `From: john@example.com
To: jane@example.com
Content-Type: text/html

<html><body><h1>Title</h1><p>This is <strong>bold</strong> text.</p></body></html>`;

			const result = await simpleParser(rawEmail);

			expect(result.text).toBe('Title This is bold text.');
		});

		test('should handle HTML entities', async () => {
			const rawEmail = `From: john@example.com
To: jane@example.com
Content-Type: text/html

<html><body><p>This &amp; that &lt; 10 &gt; 5</p></body></html>`;

			const result = await simpleParser(rawEmail);

			expect(result.text).toBe('This & that < 10 > 5');
		});

		test('should remove script and style tags', async () => {
			const rawEmail = `From: john@example.com
To: jane@example.com
Content-Type: text/html

<html><head><style>body { color: red; }</style></head><body><script>alert('test');</script><p>Content</p></body></html>`;

			const result = await simpleParser(rawEmail);

			expect(result.text).toBe('Content');
		});
	});

	describe('Error Handling', () => {
		test('should handle empty email', async () => {
			const result = await simpleParser('');

			expect(result.subject).toBe('');
			expect(result.text).toBe('');
			expect(result.html).toBe('');
			expect(result.attachments).toEqual([]);
		});

		test('should handle malformed multipart boundary', async () => {
			const rawEmail = `From: john@example.com
To: jane@example.com
Content-Type: multipart/mixed; boundary="boundary123"

--boundary123
Content-Type: text/plain

Hello

--boundary123
Content-Type: application/pdf

PDF_CONTENT

--boundary123--`;

			const result = await simpleParser(rawEmail);

			// Should still parse the text content
			expect(result.text).toBe('Hello');
		});

		test('should handle invalid date headers', async () => {
			const rawEmail = `From: john@example.com
To: jane@example.com
Date: Invalid Date String

Hello`;

			const result = await simpleParser(rawEmail);

			expect(result.date).toBeUndefined();
		});
	});

	describe('Edge Cases', () => {
		test('should handle very long headers', async () => {
			const longSubject = 'A'.repeat(1000);
			const rawEmail = `From: john@example.com
To: jane@example.com
Subject: ${longSubject}

Hello`;

			const result = await simpleParser(rawEmail);

			expect(result.subject).toBe(longSubject);
		});

		test('should handle emails with no body', async () => {
			const rawEmail = `From: john@example.com
To: jane@example.com
Subject: No Body

`;

			const result = await simpleParser(rawEmail);

			expect(result.text).toBe('');
			expect(result.html).toBe('');
		});

		test('should handle emails with only headers', async () => {
			const rawEmail = `From: john@example.com
To: jane@example.com
Subject: Headers Only`;

			const result = await simpleParser(rawEmail);

			expect(result.subject).toBe('Headers Only');
			expect(result.text).toBe('');
		});
	});
});
