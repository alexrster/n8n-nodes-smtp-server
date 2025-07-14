# CI/CD Pipeline Documentation

This repository uses GitHub Actions for continuous integration and deployment. The pipeline includes several workflows to ensure code quality, security, and automated releases.

## Workflows

### 1. CI (`ci.yml`)
**Triggers:** Push to `main`/`develop` branches, Pull Requests to `main`

**What it does:**
- Runs on Node.js 20.x and 22.x
- Installs dependencies
- Runs linting and formatting checks
- Builds the project
- Verifies build output
- Tests n8n integration
- Runs security audit
- Uploads build artifacts

### 2. Release (`release.yml`)
**Triggers:** Push of version tags (e.g., `v1.0.0`)

**What it does:**
- Builds the project
- Publishes to npm
- Creates GitHub release

### 3. Dependency Update (`dependency-update.yml`)
**Triggers:** Weekly (Mondays at 9 AM UTC), Manual dispatch

**What it does:**
- Checks for outdated dependencies
- Updates dependencies if available
- Creates PR with updates

### 4. Test n8n Integration (`test-n8n-integration.yml`)
**Triggers:** Push to `main`/`develop`, Pull Requests, Manual dispatch

**What it does:**
- Tests node loading in n8n
- Verifies node instantiation
- Ensures compatibility

## Setup Requirements

### Required Secrets

1. **NPM_TOKEN** - For publishing to npm
   - Generate at: https://www.npmjs.com/settings/tokens
   - Add to repository secrets

2. **GITHUB_TOKEN** - Automatically provided by GitHub Actions

### Branch Protection Rules

Recommended branch protection for `main`:
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Require pull request reviews before merging
- Include administrators in restrictions

## Release Process

1. **Development:**
   - Work on feature branches
   - Create PRs to `main`
   - CI runs automatically on PRs

2. **Release:**
   ```bash
   # Update version in package.json
   npm version patch|minor|major
   
   # Push the tag
   git push origin v1.0.1
   ```
   
   The release workflow will automatically:
   - Build the project
   - Publish to npm
   - Create GitHub release

## Local Development

Before pushing, ensure:
```bash
npm run lint
npm run build
npm test  # if tests are added
```

## Troubleshooting

### Build Failures
- Check Node.js version compatibility
- Verify all dependencies are installed
- Check for TypeScript compilation errors

### Release Failures
- Ensure NPM_TOKEN is set correctly
- Verify package.json version is updated
- Check npm registry permissions

### Security Issues
- Run `npm audit` locally
- Update vulnerable dependencies
- Check for known vulnerabilities in dependencies

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure CI passes
5. Create a pull request

The CI pipeline will automatically run on your PR and provide feedback. 
