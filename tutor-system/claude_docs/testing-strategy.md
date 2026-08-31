# Testing Strategy - Tasks 1-3

This document outlines the comprehensive testing strategy for the completed tasks (1-3) of the Online Tutor System project.

## Current Test Tiers

Updated: 2026-07-18 (commit 687fc6d base; student Available Rooms hides behavior-test rooms — see doc_update_record)

The repository now uses these validation tiers:

1. Deterministic regression:
   - Command: `npm test` or `npm run test:regression`
   - Purpose: stable per-change guardrail
   - Rule: must not require live vendor credentials or local browser-driver compatibility
   - Includes offline tutor-behavior heuristics unit tests and E2E scaffold checks

2. External integration (Qwen checklist):
   - Command: `npm run test:integration:qwen`
   - Purpose: validate the real Qwen boundary for checklist extraction/coverage
   - Rule: opt-in only because vendor/network state can fail without a code regression

3. Tutor behavior live E2E:
   - Command: `npm run test:integration:tutor-behavior`
   - Purpose: exercise the **production** `generateSystemPrompt` + `QwenService.generateResponse` path against Account Security Alert cases, scored by deterministic heuristics
   - Rule: opt-in (`RUN_LIVE_QWEN_TESTS=true`); requires `REACT_APP_OAI_API_KEY`
   - Complements Promptfoo (`npm run eval:prompts`) which is the LLM-as-judge quality gate over frozen fixtures

4. Browser end-to-end integration:
   - Command: `npm run test:integration:browser`
   - Purpose: validate Selenium/browser wiring against a real local browser
   - Rule: opt-in only because Chrome/ChromeDriver version skew can fail without a product regression

5. Full external validation:
   - Command: `npm run test:integration:external`
   - Purpose: run Qwen checklist, tutor-behavior E2E, and browser tiers when preparing a release or checking environment health

6. Ecological Promptfoo + real-browser template demos (behavior feedback):
   - Layer 1: `npm run eval:prompts` (export + one Promptfoo evaluation over ecological and synthetic cases + quality gate)
   - Layer 2: `npm run test:browser:behavior-demos` (template-only rooms on **`/#/tutor/test-rooms`**, not the main room list)
   - UI: main Tutor dashboard (`/#/tutor`) lists normal rooms only; **Test Rooms** page hosts `Demo:` / `test_only` rooms
   - Student Available Rooms (`/#/student`) uses `filterRoomsForStudentList` (marker / `Demo:` titles / test-only titles + `DemoTutor_*` harness owners); real teaching rooms stay visible
   - Classic teaching templates (Account Security, Nintendo, iTunes, Phone Number, etc.) stay on the normal create form

## Overview

We have implemented unit tests for the first three completed tasks:

1. **Task 1**: Project Setup & Architecture (Supabase)
2. **Task 2**: PostgreSQL Database Design & Schema  
3. **Task 3**: Supabase Authentication System

## Test Files Structure

```
tutor-system/src/
├── services/__tests__/
│   ├── supabase.test.ts          # Task 1 tests
│   └── database.test.ts          # Task 2 tests
└── contexts/__tests__/
    └── AuthContext.test.tsx      # Task 3 tests
```

## Task 1: Project Setup & Architecture Tests

**File**: `src/services/__tests__/supabase.test.ts`

**Test Strategy**: "Verify React app builds successfully, Supabase services are properly configured, and basic Supabase connection works"

### Test Coverage:

#### Supabase Client Configuration
- ✅ Creates Supabase client with correct configuration
- ✅ Validates environment variables are required
- ✅ Verifies auth settings (autoRefreshToken, persistSession, detectSessionInUrl)
- ✅ Verifies realtime settings (eventsPerSecond: 10)

#### Helper Functions
- ✅ `getCurrentUser()` - success and error scenarios
- ✅ `signOut()` - success and error scenarios  
- ✅ `getUserProfile()` - fetch user profile with proper database queries
- ✅ `updateUserProfile()` - update user profile with proper database operations

#### Basic Supabase Connection
- ✅ Validates proper client initialization
- ✅ Confirms configuration parameters are correctly set

### Running Task 1 Tests:
```bash
npm test src/services/__tests__/supabase.test.ts
```

## Task 2: Database Schema & Operations Tests

**File**: `src/services/__tests__/database.test.ts`

**Test Strategy**: "Test database schema creation, RLS policies, and basic CRUD operations with proper access control"

### Test Coverage:

#### Users Table Operations
- ✅ Create user successfully
- ✅ Read user profile successfully
- ✅ Update user profile successfully
- ✅ Enforce user role validation (student, tutor, observer)

#### Rooms Table Operations  
- ✅ Create room successfully by tutor
- ✅ Read active rooms successfully
- ✅ Update room by tutor successfully

#### Messages Table Operations
- ✅ Create message successfully
- ✅ Read messages from active room successfully  
- ✅ Validate message user role

#### Sessions Table Operations
- ✅ Create session successfully
- ✅ Update session status successfully

#### Row Level Security (RLS) Policies
- ✅ Users can view all profiles policy
- ✅ Users can only update own profile policy
- ✅ Only tutors can create rooms policy
- ✅ Only tutors and students can send messages policy

#### Database Constraints and Validation
- ✅ Enforce required fields for all tables
- ✅ Enforce enum constraints (user_role, user_status, session_status)
- ✅ Enforce foreign key relationships

#### Database Performance
- ✅ Verify indexed queries for common operations
- ✅ Support efficient message ordering by timestamp

### Running Task 2 Tests:
```bash
npm test src/services/__tests__/database.test.ts
```

## Task 3: Authentication System Tests

**File**: `src/contexts/__tests__/AuthContext.test.tsx`

**Test Strategy**: "Test Supabase Auth login/logout, role selection updates database, auth state persistence across page refresh"

### Test Coverage:

#### AuthProvider Initialization
- ✅ Initialize with loading state
- ✅ Load user profile when session exists
- ✅ Setup auth state change listener
- ✅ Cleanup subscription on unmount

#### Sign In Functionality
- ✅ Sign in user successfully
- ✅ Handle sign in errors
- ✅ Handle SIGNED_IN auth state change

#### Sign Up Functionality
- ✅ Sign up user successfully and create profile
- ✅ Handle sign up auth errors
- ✅ Handle profile creation errors

#### Sign Out Functionality
- ✅ Sign out user successfully
- ✅ Handle sign out errors
- ✅ Handle SIGNED_OUT auth state change

#### Role Selection and Capacity Management
- ✅ Set tutor role when capacity allows (max 1 tutor)
- ✅ Prevent setting tutor role when capacity reached
- ✅ Set student role when capacity allows (max 1 student)  
- ✅ Prevent setting student role when capacity reached
- ✅ Allow unlimited observers
- ✅ Handle role selection errors
- ✅ Throw error when no user is logged in

#### Auth State Persistence
- ✅ Restore user session on page refresh
- ✅ Handle session restoration errors gracefully
- ✅ Handle user profile loading errors during restoration

#### Context Error Handling
- ✅ Throw error when useAuth is used outside AuthProvider

### Running Task 3 Tests:
```bash
npm test src/contexts/__tests__/AuthContext.test.tsx
```

## Test Execution

### Run All Tests
```bash
# Run the default deterministic regression suite
npm test

# Equivalent explicit deterministic regression command
npm run test:regression

# Run tests with Jest coverage
npm run test:coverage

# Run live Qwen integration suites
npm run test:integration:qwen

# Run browser-backed external integration suites
npm run test:integration:browser

# Run all external integration suites
npm run test:integration:external

# Run comprehensive coverage report (Jest + custom analysis)
npm run test:coverage-report

# Run tests in watch mode
npm test -- --watch
```

### Task-Specific Testing
```bash
# Run individual task tests
npm run test:task1      # Task 1: Supabase tests
npm run test:task2      # Task 2: Database tests
npm run test:task3      # Task 3: Auth tests

# Run all completed task tests
npm run test:tasks

# Run coverage analysis only
npm run test:coverage-analysis
```

### Run Specific Test Suites
```bash
# Task 1 tests only
npm test src/services/__tests__/supabase.test.ts

# Task 2 tests only  
npm test src/services/__tests__/database.test.ts

# Task 3 tests only
npm test src/contexts/__tests__/AuthContext.test.tsx

# Run with verbose output
npm test -- --verbose
```

## Test Coverage Analysis

### Coverage Utility

We have implemented a comprehensive test coverage analysis utility that provides:

- **Task-Specific Metrics**: Coverage analysis for each completed task
- **Scenario Categorization**: Tests grouped by Happy Path, Error Handling, Security, and Edge Cases  
- **Coverage Scoring**: Weighted scores based on test completeness and scenario diversity
- **Quality Gates**: Automated validation of minimum coverage thresholds

### Coverage Reports

The coverage analysis generates detailed reports showing:

```
============================================================
                 TEST COVERAGE REPORT
============================================================

📋 Task 1: Project Setup & Architecture (Supabase)
   Test File: src/services/__tests__/supabase.test.ts
   Test Cases: 12
   Coverage Score: 83%
   Scenarios: Happy(5) Error(5) Security(0) Edge(2)

📋 Task 2: PostgreSQL Database Design & Schema
   Test File: src/services/__tests__/database.test.ts
   Test Cases: 20
   Coverage Score: 87%
   Scenarios: Happy(8) Error(4) Security(8) Edge(0)

📋 Task 3: Supabase Authentication System
   Test File: src/contexts/__tests__/AuthContext.test.tsx
   Test Cases: 24
   Coverage Score: 92%
   Scenarios: Happy(10) Error(9) Security(3) Edge(2)

📊 OVERALL SUMMARY
------------------------------
Total Test Cases: 56
Average Coverage: 87%
Tasks Covered: 3/3 (100%)

✅ EXCELLENT COVERAGE - Well tested codebase
============================================================
```

### Running Coverage Analysis

```bash
# Complete coverage report (Jest + custom analysis)
npm run test:coverage-report

# Just the custom task-based analysis
npm run test:coverage-analysis

# Standard Jest coverage only
npm run test:coverage
```

### Coverage Thresholds

Jest is configured with minimum coverage thresholds:

- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 75%
- **Statements**: 80%

Our custom analysis enforces additional quality gates:

- **Task Coverage Score**: 75% minimum per task
- **Scenario Distribution**: Balanced coverage across test categories
- **Test Case Density**: Minimum 3 tests per function/feature

## Test Technologies Used

- **Jest**: Testing framework (included with React scripts)
- **React Testing Library**: For React component testing
- **TypeScript**: Type-safe test development
- **Mocking**: Comprehensive mocking of Supabase client and services

## Test Environment Setup

The tests use mocked Supabase clients to avoid requiring actual database connections during testing. This ensures:

- ✅ Fast test execution
- ✅ Isolated test environment
- ✅ No external dependencies
- ✅ Predictable test results

## Coverage Goals

Each test file aims for comprehensive coverage of:

- ✅ **Happy path scenarios** - Normal successful operations
- ✅ **Error scenarios** - Various failure modes and edge cases
- ✅ **Edge cases** - Boundary conditions and unusual inputs
- ✅ **Integration scenarios** - How components work together
- ✅ **Security scenarios** - Access control and validation

## Next Steps

As development continues on tasks 4-13, additional test files should be created following the same patterns:

1. **Unit tests** for new service functions
2. **Component tests** for React components
3. **Integration tests** for complex workflows
4. **E2E tests** for complete user scenarios (planned for Task 12)

## Maintenance

- Tests should be updated whenever the corresponding implementation changes
- New features should include corresponding test coverage
- Test documentation should be kept current with implementation
- Regular test reviews should ensure coverage remains comprehensive

## Links

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Supabase Testing Guide](https://supabase.com/docs/guides/getting-started/testing) 
