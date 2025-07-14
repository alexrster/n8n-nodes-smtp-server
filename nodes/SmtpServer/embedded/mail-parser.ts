export interface ParsedMail {
	subject?: string;
	to?: AddressObject | AddressObject[];
	from?: AddressObject | AddressObject[];
	text?: string;
	html?: string;
	date?: Date;
	messageId?: string;
	attachments?: Attachment[];
	headers: Record<string, string>;
}

export interface AddressObject {
	text: string;
	address: string;
	name?: string;
}

export interface Attachment {
	filename?: string;
	contentType?: string;
	size?: number;
	content?: Buffer;
}

export function simpleParser(rawEmail: string): Promise<ParsedMail> {
	return new Promise((resolve, reject) => {
		try {
			const lines = rawEmail.split('\r\n');
			const headers: Record<string, string> = {};
			let bodyStart = -1;
			let boundary = '';

			// Parse headers
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];

				if (line === '') {
					bodyStart = i + 1;
					break;
				}

				if (line.startsWith(' ') || line.startsWith('\t')) {
					// Continuation line
					const lastHeader = Object.keys(headers).pop();
					if (lastHeader) {
						headers[lastHeader] += ' ' + line.trim();
					}
				} else {
					const colonIndex = line.indexOf(':');
					if (colonIndex > 0) {
						const key = line.substring(0, colonIndex).toLowerCase();
						const value = line.substring(colonIndex + 1).trim();
						headers[key] = value;

						// Extract boundary for multipart
						if (key === 'content-type' && value.includes('boundary=')) {
							const match = value.match(/boundary="?([^";\s]+)"?/);
							if (match) {
								boundary = match[1];
							}
						}
					}
				}
			}

			// Parse body
			const body = lines.slice(bodyStart).join('\r\n');
			const parsed: ParsedMail = {
				subject: headers.subject || '',
				to: parseAddresses(headers.to || ''),
				from: parseAddresses(headers.from || ''),
				date: headers.date ? new Date(headers.date) : undefined,
				messageId: headers['message-id'] || '',
				headers,
				text: '',
				html: '',
				attachments: [],
			};

			// Parse content based on type
			if (boundary) {
				// Multipart message
				const parts = parseMultipart(body, boundary);
				for (const part of parts) {
					const contentType = part.headers['content-type'] || '';

					if (contentType.includes('text/plain')) {
						parsed.text = part.content;
					} else if (contentType.includes('text/html')) {
						parsed.html = part.content;
					} else if (contentType.includes('attachment') || part.headers['content-disposition']?.includes('attachment')) {
						parsed.attachments!.push({
							filename: extractFilename(part.headers['content-disposition'] || ''),
							contentType,
							size: part.content.length,
							content: Buffer.from(part.content, 'utf8'),
						});
					}
				}
			} else {
				// Simple text message
				const contentType = headers['content-type'] || '';
				if (contentType.includes('text/html')) {
					parsed.html = body;
				} else {
					parsed.text = body;
				}
			}

			// Ensure we have text content
			if (!parsed.text && parsed.html) {
				parsed.text = stripHtml(parsed.html);
			}

			resolve(parsed);
		} catch (error) {
			reject(error);
		}
	});
}

function parseAddresses(addressString: string): AddressObject | AddressObject[] {
	if (!addressString) return { text: '', address: '' };

	const addresses: AddressObject[] = [];
	const parts = addressString.split(',');

	for (const part of parts) {
		const trimmed = part.trim();
		const match = trimmed.match(/"?([^"<]+)"?\s*<(.+?)>/);

		if (match) {
			addresses.push({
				name: match[1].trim(),
				address: match[2].trim(),
				text: trimmed,
			});
		} else {
			addresses.push({
				address: trimmed,
				text: trimmed,
			});
		}
	}

	return addresses.length === 1 ? addresses[0] : addresses;
}

function parseMultipart(body: string, boundary: string): Array<{ headers: Record<string, string>; content: string }> {
	const parts: Array<{ headers: Record<string, string>; content: string }> = [];
	const boundaryLine = '--' + boundary;
	const sections = body.split(boundaryLine);

	for (const section of sections) {
		if (!section.trim() || section.includes('--')) continue;

		const lines = section.split('\r\n');
		const headers: Record<string, string> = {};
		let contentStart = -1;

		// Parse part headers
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			if (line === '') {
				contentStart = i + 1;
				break;
			}

			const colonIndex = line.indexOf(':');
			if (colonIndex > 0) {
				const key = line.substring(0, colonIndex).toLowerCase();
				const value = line.substring(colonIndex + 1).trim();
				headers[key] = value;
			}
		}

		if (contentStart > 0) {
			const content = lines.slice(contentStart).join('\r\n');
			parts.push({ headers, content });
		}
	}

	return parts;
}

function extractFilename(contentDisposition: string): string {
	const match = contentDisposition.match(/filename="?([^";\s]+)"?/);
	return match ? match[1] : '';
}

function stripHtml(html: string): string {
	return html
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.trim();
}
