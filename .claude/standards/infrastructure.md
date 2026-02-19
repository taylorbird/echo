# Infrastructure Standards

<!-- Customize for your organization -->

## General
- Infrastructure as code (always)
- Document manual steps if unavoidable
- Use consistent naming conventions

## AWS
- Tag all resources
- Use least-privilege IAM
- Enable CloudTrail

## Pulumi/IaC
- Stack naming: {env}-{service}-{region}
- Use typed configuration
- Keep stacks focused (don't monolith)

## Logging & Observability
- Structured logging (JSON)
- Include correlation IDs
- Log at appropriate levels
