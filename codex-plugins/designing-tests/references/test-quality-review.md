# Test Quality Review

## Review Workflow

For each existing test:

1. identify the production boundary it claims to validate
2. label it `real`, `shallow`, or `fake`
3. state why
4. state which regression could still slip through
5. recommend the smallest rewrite or addition that would make protection real

## Common Reasons

### Shallow

- only checks `200`, `ok`, or non-null
- asserts a large object shape without asserting the important contract
- verifies setup details more than behavior
- duplicates lower-level coverage without adding a new failure mode

### Fake

- reimplements the business rule in the test itself
- mocks the unit under test
- mocks internal collaborators so heavily that the risky path is skipped
- proves only language or framework behavior

## Good Review Output

Report:

1. which tests are real, shallow, or fake
2. which critical branches, side effects, or seams are still uncovered
3. the next highest-value tests to add
