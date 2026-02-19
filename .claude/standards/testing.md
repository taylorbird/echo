# Testing Standards

<!-- Customize for your organization -->

## Coverage
- Aim for meaningful coverage, not arbitrary percentages
- Critical paths must be tested

## Unit Tests
- Test one thing per test
- Use descriptive test names
- Arrange-Act-Assert pattern

## Integration Tests
- Test real interactions where practical
- Use test databases, not mocks, for data layer

## File Naming
- `*.test.ts` or `*.spec.ts`
- Co-locate with source or in `__tests__/`

## Test Naming
- describe: component or function name
- it: "should {expected} when {condition}"
