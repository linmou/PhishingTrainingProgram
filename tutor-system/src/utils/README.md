# Utils Directory

This directory contains utility functions and helpers for the Online Tutor System project.

## Testing with Jest Coverage

This project uses **Jest's built-in coverage analysis** to provide real code coverage metrics.

### Available Test Scripts

```bash
# Run all tests
npm test

# Run tests with real coverage analysis  
npm run test:coverage

# Run task-specific tests
npm run test:task1  # Supabase configuration tests
npm run test:task2  # Database schema tests  
npm run test:task3  # Authentication tests

# Run all task tests together
npm run test:tasks
```

### Real Coverage Metrics

Jest provides **actual code coverage** including:

- **Line Coverage** - Percentage of code lines executed during tests
- **Function Coverage** - Percentage of functions called during tests  
- **Branch Coverage** - Percentage of code branches taken during tests
- **Statement Coverage** - Percentage of statements executed during tests

### Coverage Reports

When you run `npm run test:coverage`, Jest generates:

- **Console Summary** - Displayed immediately after test completion
- **HTML Report** - Interactive detailed report in `coverage/lcov-report/index.html`
- **LCOV File** - Machine-readable format in `coverage/lcov.info`

### Current Test Files

Our **real test suites** include:

#### Task 1: Supabase Service Tests
- **File**: `src/services/__tests__/supabase.test.ts`
- **Coverage**: Tests 4 exported functions from `supabase.ts`
- **Test Cases**: 12 real test cases
- **Functions Tested**: `getCurrentUser`, `signOut`, `getUserProfile`, `updateUserProfile`

#### Task 2: Database Schema Tests  
- **File**: `src/services/__tests__/database.test.ts`
- **Coverage**: Tests database operations and RLS policies
- **Test Cases**: 17 real test cases
- **Focus**: CRUD operations, security policies, constraints

#### Task 3: Authentication Context Tests
- **File**: `src/contexts/__tests__/AuthContext.test.tsx`
- **Coverage**: Tests React authentication context
- **Test Cases**: Multiple real test cases
- **Focus**: Auth flows, role management, state persistence

### Jest Configuration

Coverage thresholds are configured in `package.json`:

```json
{
  "jest": {
    "collectCoverageFrom": [
      "src/**/*.{js,jsx,ts,tsx}",
      "!src/index.tsx",
      "!src/reportWebVitals.ts",
      "!src/**/*.d.ts",
      "!src/**/__tests__/**",
      "!src/**/node_modules/**"
    ],
    "coverageThreshold": {
      "global": {
        "branches": 75,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

### Viewing Coverage Reports

After running `npm run test:coverage`:

1. **Console Output** - Shows immediate summary
2. **Open HTML Report** - Navigate to `coverage/lcov-report/index.html`
3. **Interactive Analysis** - Click through files to see line-by-line coverage

### Best Practices

- **Write tests first** - Use test-driven development
- **Test edge cases** - Include error scenarios and boundary conditions  
- **Mock external dependencies** - Use Jest mocks for Supabase, APIs, etc.
- **Test user interactions** - Use React Testing Library for component tests
- **Maintain high coverage** - Aim for 80%+ on all metrics

### Adding New Tests

When adding new functionality:

1. **Create test file** - Follow naming convention `*.test.{ts,tsx}`
2. **Write comprehensive tests** - Cover happy path, errors, edge cases
3. **Run coverage** - Check `npm run test:coverage` to verify coverage
4. **Update documentation** - Document new test patterns or utilities

## Links

- [Testing Strategy Documentation](../../docs/testing-strategy.md)
- [Project Documentation Index](../../docs/README.md)  
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) 