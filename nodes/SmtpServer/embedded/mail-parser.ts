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
			// Normalize line endings to LF and split by lines, but preserve trailing whitespace
			const normalizedEmail = rawEmail.replace(/\r\n/g, '\n');
			const lines = normalizedEmail.split('\n');
			const headers: Record<string, string> = {};
			let bodyStart = -1;
			let boundary = '';

			// Find the end of headers (empty line)
			for (let i = 0; i < lines.length; i++) {
				if (lines[i] === '') {
					bodyStart = i + 1;
					break;
				}
			}

			// Parse headers
			const headerEnd = bodyStart > 0 ? bodyStart - 1 : lines.length;
			for (let i = 0; i < headerEnd; i++) {
				const line = lines[i];

				if (line.startsWith(' ') || line.startsWith('\t')) {
					// Continuation line: concatenate raw line as-is
					const lastHeader = Object.keys(headers).pop();
					if (lastHeader) {
						// Add a space if the previous line doesn't end with a space
						const prev = headers[lastHeader];
						const continuation = line.replace(/^\s+/, ' '); // Replace leading whitespace with a single space
						if (!prev.endsWith(' ')) {
							headers[lastHeader] = prev + ' ' + continuation;
						} else {
							headers[lastHeader] = prev + continuation;
						}
					}
				} else if (line.trim() === '') {
					// Skip empty lines in headers
					continue;
				} else {
					const colonIndex = line.indexOf(':');
					if (colonIndex > 0) {
						const key = line.substring(0, colonIndex).toLowerCase();
						const value = line.substring(colonIndex + 1).replace(/^\s+/, ''); // Trim leading spaces only
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

			// Parse body - preserve original line endings
			const body = bodyStart > 0 ? lines.slice(bodyStart).join('\r\n') : '';
			const parsed: ParsedMail = {
				subject: headers.subject || '',
				to: parseAddresses(headers.to || ''),
				from: parseAddresses(headers.from || ''),
				date: headers.date
					? (() => {
							const date = new Date(headers.date);
							return isNaN(date.getTime()) ? undefined : date;
						})()
					: undefined,
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
					const contentDisposition = part.headers['content-disposition'] || '';

					if (contentType.includes('text/plain')) {
						parsed.text = part.content.trimEnd();
					} else if (contentType.includes('text/html')) {
						parsed.html = part.content.trimEnd();
					} else if (contentDisposition.includes('attachment')) {
						parsed.attachments!.push({
							filename: extractFilename(contentDisposition),
							contentType: contentType.split(';')[0].trim(),
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

		// Handle quoted name with email: "John Doe" <john@example.com>
		const quotedMatch = trimmed.match(/"?([^"<]+)"?\s*<(.+?)>/);
		if (quotedMatch) {
			addresses.push({
				name: quotedMatch[1].trim(),
				address: quotedMatch[2].trim(),
				text: trimmed,
			});
			continue;
		}

		// Handle email without name: <john@example.com>
		const emailMatch = trimmed.match(/<(.+?)>/);
		if (emailMatch) {
			addresses.push({
				address: emailMatch[1].trim(),
				text: trimmed,
			});
			continue;
		}

		// Handle plain email: john@example.com
		if (trimmed.includes('@')) {
			addresses.push({
				address: trimmed,
				text: trimmed,
			});
			continue;
		}

		// Fallback for malformed addresses
		addresses.push({
			address: trimmed,
			text: trimmed,
		});
	}

	return addresses.length === 1 ? addresses[0] : addresses;
}

function parseMultipart(
	body: string,
	boundary: string,
): Array<{ headers: Record<string, string>; content: string }> {
	const parts: Array<{ headers: Record<string, string>; content: string }> = [];
	const boundaryLine = '--' + boundary;

	const sections = body.split(boundaryLine);

	for (let i = 0; i < sections.length; i++) {
		let section = sections[i];
		// Skip empty sections and final boundary
		if (section.trim().length === 0 || section.trim() === '--') {
			continue;
		}

		// Trim leading newlines so headers start at line 0
		section = section.replace(/^\r?\n+/, '');
		// Normalize line endings to LF for splitting
		section = section.replace(/\r\n/g, '\n');

		const lines = section.split('\n');
		const headers: Record<string, string> = {};
		let contentStart = -1;

		// Parse part headers
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			if (line === '') {
				contentStart = i + 1;
				break;
			}

			if (line.startsWith(' ') || line.startsWith('\t')) {
				// Continuation line: concatenate raw line as-is
				const lastHeader = Object.keys(headers).pop();
				if (lastHeader) {
					headers[lastHeader] += line;
				}
			} else if (line.trim() === '') {
				// Skip empty lines in headers
				continue;
			} else {
				const colonIndex = line.indexOf(':');
				if (colonIndex > 0) {
					const key = line.substring(0, colonIndex).toLowerCase();
					const value = line.substring(colonIndex + 1).trim();
					headers[key] = value;
				}
			}
		}

		if (contentStart > 0 && contentStart < lines.length) {
			let content = lines.slice(contentStart).join('\r\n');
			// Remove trailing boundary if present
			let cleanContent = content.replace(/--$/, '');
			// Remove only a single trailing \r\n or \n if present
			cleanContent = cleanContent.replace(/(\r\n|\n)$/, '');
			// For attachments, remove all \r and \n characters for size and buffer
			const isAttachment =
				headers['content-disposition'] && headers['content-disposition'].includes('attachment');
			if (isAttachment) {
				let contentNoNewlines = cleanContent.replace(/[\r\n]/g, '');
				contentNoNewlines = contentNoNewlines.trim();
				parts.push({ headers, content: contentNoNewlines });
			} else {
				parts.push({ headers, content: cleanContent });
			}
		}
	}

	return parts;
}

function extractFilename(contentDisposition: string): string {
	// Try quoted filename first: filename="document.pdf"
	let match = contentDisposition.match(/filename="([^"]+)"/);
	if (match) {
		return match[1];
	}

	// Try unquoted filename: filename=document.pdf
	match = contentDisposition.match(/filename=([^;\s]+)/);
	if (match) {
		return match[1];
	}

	return '';
}

function stripHtml(html: string): string {
	return html
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s+/g, ' ')
		.trim();
}
