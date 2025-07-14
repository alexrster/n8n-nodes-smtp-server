# Dependencies Explanation

This document explains the external dependencies used in the n8n SMTP Server node and why they are necessary.

## Core Dependencies

### 1. `smtp-server` (v3.14.0)
**Purpose**: Provides SMTP server functionality to receive emails
**Why it's needed**: 
- Node.js doesn't have built-in SMTP server capabilities
- This package is the most widely used and maintained SMTP server for Node.js
- It handles all the complex SMTP protocol details (authentication, data streaming, etc.)
- Used by many production applications and is well-tested

**Security**: 
- Maintained by the Nodemailer team (trusted email library maintainers)
- Regular security updates
- No known critical vulnerabilities
- Used by thousands of applications

### 2. `mailparser` (v3.7.4)
**Purpose**: Parses raw email data into structured format
**Why it's needed**:
- Raw email data is in MIME format and needs parsing
- Handles complex email structures (multipart, attachments, headers)
- Extracts text, HTML, attachments, and metadata
- Node.js built-in modules cannot handle this complexity

**Security**:
- Maintained by the Nodemailer team
- Regular security updates
- No known critical vulnerabilities
- Industry standard for email parsing

## Type Definitions

### 3. `@types/smtp-server` (v3.5.10)
**Purpose**: TypeScript type definitions for smtp-server
**Why it's needed**: Provides proper TypeScript support

### 4. `@types/mailparser` (v3.4.6)
**Purpose**: TypeScript type definitions for mailparser
**Why it's needed**: Provides proper TypeScript support

## Alternative Approaches Considered

### 1. Built-in Node.js modules only
**Why not used**: Node.js doesn't have built-in SMTP server or email parsing capabilities

### 2. Custom SMTP implementation
**Why not used**: 
- Would require thousands of lines of code
- Would need extensive testing for SMTP protocol compliance
- High risk of security vulnerabilities
- Would not be maintainable

### 3. Other SMTP libraries
**Why not used**:
- `smtp-server` is the most mature and widely used
- Other libraries are either abandoned or have fewer features

## Security Considerations

1. **Authentication**: The node supports SMTP authentication to prevent unauthorized access
2. **Network Security**: Users can bind to localhost for internal use only
3. **Input Validation**: All email data is properly parsed and validated
4. **Error Handling**: Comprehensive error handling prevents crashes
5. **Logging**: Proper logging for debugging and monitoring

## Maintenance

- Dependencies are regularly updated via automated workflows
- Security audits are run on every build
- Dependencies are pinned to specific versions for stability
- Overrides are used to ensure consistent type definitions

## Request for Approval

These dependencies are essential for the core functionality of the SMTP Server node. Without them, it would be impossible to:

1. Receive emails via SMTP protocol
2. Parse email content and attachments
3. Provide structured data to n8n workflows

The packages chosen are:
- Well-maintained and actively developed
- Widely used in production environments
- Have good security track records
- Provide the necessary functionality with minimal overhead

We request approval for these dependencies as they are fundamental to the node's purpose and there are no viable alternatives. 
