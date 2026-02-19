# Security Standards

<!-- Customize for your organization -->

## Secrets Management
- Never commit secrets
- Use environment variables or secret managers
- Never log sensitive data
- Rotate credentials regularly

## Input Validation
- Validate all external input
- Use schema validation (Zod, Joi)
- Sanitize before database operations

## Authentication
- Use established libraries (don't roll your own)
- Implement proper session management
- Use secure token storage

## Dependencies
- Review new dependencies before adding
- Keep dependencies updated
- Monitor for vulnerabilities
