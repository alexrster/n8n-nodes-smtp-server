---
name: Dependency Approval Request
about: Request approval for external dependencies
title: 'Dependency Approval: smtp-server and mailparser for SMTP Server Node'
labels: 'dependency-approval'
assignees: 'alexrster'

---

## Dependency Approval Request

### Package Information
- **Package Name**: n8n-nodes-smtp-server
- **Repository**: https://github.com/alexrster/n8n-nodes-smtp-server
- **Purpose**: SMTP Server trigger node for receiving emails in n8n workflows

### Dependencies Requesting Approval

#### 1. smtp-server (v3.14.0)
- **Maintainer**: Nodemailer team
- **Downloads**: 500k+ weekly
- **Purpose**: SMTP server functionality to receive emails
- **Security**: No known critical vulnerabilities
- **License**: MIT

#### 2. mailparser (v3.7.4)
- **Maintainer**: Nodemailer team  
- **Downloads**: 1M+ weekly
- **Purpose**: Parse raw email data into structured format
- **Security**: No known critical vulnerabilities
- **License**: MIT

### Why These Dependencies Are Essential

1. **Core Functionality**: These packages provide the fundamental SMTP server and email parsing capabilities that cannot be implemented with Node.js built-ins alone.

2. **Industry Standard**: Both packages are widely used in production environments and are considered industry standards for their respective purposes.

3. **Security**: Both packages are maintained by the trusted Nodemailer team and have good security track records.

4. **No Alternatives**: There are no viable alternatives that provide the same functionality with better security or maintenance.

### Security Measures Implemented

- SMTP authentication support
- Configurable network binding (localhost for internal use)
- Input validation and error handling
- Comprehensive logging
- Regular dependency updates via automated workflows

### Documentation

See [DEPENDENCIES.md](DEPENDENCIES.md) for detailed explanation of dependencies and their necessity.

### Request

We request approval for these dependencies as they are fundamental to the node's core functionality. Without them, the SMTP Server node would not be able to fulfill its intended purpose of receiving and parsing emails in n8n workflows.

### Contact

- **Author**: Alex Yevtushenko (a@qx.zone)
- **Repository**: https://github.com/alexrster/n8n-nodes-smtp-server 
