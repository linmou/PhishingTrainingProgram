## Intent
Document the current tutor-system architecture and highlight behavior that affects deployment and tutor workflows, including SPA routing, learning progress export, and room data export behavior.

## Metadata
- Updated: 2026-09-07
- Commit ID: `ba95540` (pre-change baseline; the commit containing this update is recorded by this file's Git history)

# Tutor-System Documentation Hub

This directory contains comprehensive architectural and implementation documentation for the tutor-system codebase - a React/TypeScript application designed for 1-to-1 online tutoring with a focus on phishing and cybersecurity education.

## 🏗️ **Architecture Documentation**

### Core System Architecture
- **[AuthContext.md](./AuthContext.md)** - Simplified authentication system with deterministic user IDs
- **[RoomContext.md](./RoomContext.md)** - Real-time messaging with WebSocket + polling hybrid approach  
- **[supabase-service.md](./supabase-service.md)** - Database service layer with type-safe operations
- **[database-schema.md](./database-schema.md)** - Complete schema with 15+ tables for educational features
- **[aiService.md](./aiService.md)** - AI assistant with modular prompt system and parameter overrides

### Architecture Summary
**Tech Stack**: React 18 + TypeScript + Supabase (PostgreSQL + Real-time + Auth + Storage)  
**Domain**: Educational cybersecurity training with AI-assisted tutoring  
**Key Features**: Real-time messaging, AI assistant integration, educational progress tracking, role-based access control

## 📚 **Implementation Documentation**

### AI Assistant System
- **[AI tutoring constitution](./ai-behaviors/constitution.md)** - Human-approved tutoring principles, P3 subprinciples, conditional priorities, and pending behavior-spec alignment
- **[Tutor behavior specification](./ai-behaviors/tutor-behavior-specification.md)** - Authoritative requirements with constitutional grounding on each item
- **[Tutor response contract](./ai-behaviors/tutor-response-contract.md)** - Deployed object and designed reasoning/instructional-decision extension; production migration pending
- **[Tutor behavior evaluation plan](./ai-behaviors/tutor-behavior-evaluation-plan.md)** - v0/v1 mappings, independent deterministic and semantic checks, and remaining readiness gates; no current performance claim
- **[Versioned tutor evaluators](../../evals/promptfoo/rubrics/README.md)** - Exact legacy v0 snapshots, clean LLM-facing v1 rubrics, metadata manifests, and locally validated decision checks
- **[Behavior evaluator documentation update](./doc_update_record/documentation_update_record_v2026_09_07_behavior_evaluator_versions.md)** - Commit scope, preserved evidence, and validation boundary
- **[Historical case audit](./ai-behaviors/tutor-behavior-case-audit.md)** - Preserved applicability and coverage findings for the audited cases
- **[Historical evaluation evidence](./ai-behaviors/tutor-behavior-evaluation-record.md)** - Saved-run findings, metric-interaction limitations, and review evidence
- **[ai-assistant-module.md](./ai-assistant-module.md)** - Comprehensive guide to the AI assistant functionality including configuration, integration, and testing
- **[ai-suggestion-tracking.md](./ai-suggestion-tracking.md)** - AI suggestion tracking implementation with tutor feedback collection
- **[simplified-authentication.md](./simplified-authentication.md)** - Simplified auth system without traditional signup/login

### Testing & Quality Assurance
- **[testing-strategy.md](./testing-strategy.md)** - Complete testing documentation for Tasks 1-3, including test coverage, execution instructions, and maintenance guidelines
- **[test-coverage-gap-analysis.md](./test-coverage-gap-analysis.md)** - Comprehensive analysis and implementation of missing test coverage for RoomContext and RoomPage components  
- **[test-fixes-summary.md](./test-fixes-summary.md)** - Technical details of test implementation fixes and patterns

## 🔧 **Quick Reference**

### Key Components Overview
- **🔐 Authentication**: Simplified auth model with deterministic user IDs, no traditional signup required
- **💬 Real-time Messaging**: Hybrid WebSocket + polling approach with optimistic updates
- **🤖 AI Integration**: Modular prompt system with real-time parameter overrides
- **📊 Progress Tracking**: Educational checklists with evidence collection and understanding levels
- **🗄️ Database**: PostgreSQL with comprehensive schema for educational applications

### Test Coverage
- **Task 1**: Supabase configuration and service tests (`src/services/__tests__/supabase.test.ts`)
- **Task 2**: Database schema and operations tests (`src/services/__tests__/database.test.ts`)
- **Task 3**: Authentication system tests (`src/contexts/__tests__/AuthContext.test.tsx`)
- **RoomContext**: Complete provider functionality tests (117 test cases)
- **RoomPage**: UI component behavior tests (89 test cases)

## 🚀 **Development Commands**

### Environment Setup
```bash
cd tutor-system
npm install                    # Install dependencies
cp env.example .env.local      # Setup environment variables
```

### Development Server
```bash
npm start                      # Start React dev server (port 3000)
npm run build                  # Production build
```

### Testing
```bash
npm test                       # Run tests in watch mode
npm run test:coverage          # Run tests with coverage report
npm run test:tasks             # Run all completed task tests (1-3)
npm run test:task1             # Test Supabase configuration  
npm run test:task2             # Test database operations
npm run test:task3             # Test authentication system
```

### Specific Test Suites
```bash
npm test src/contexts/__tests__/RoomContext.test.tsx
npm test src/pages/__tests__/RoomPage.test.tsx
npm test src/services/__tests__/supabase.test.ts
npm test src/services/__tests__/database.test.ts
```

## 🎯 **Key Architectural Patterns**

### 1. Simplified Authentication Model
- **Deterministic user IDs**: Same name + role = same user across sessions
- **No traditional signup**: Users join with display name and role selection
- **Permissive security**: Database RLS policies designed for educational use
- **Offline capability**: Functions without server connectivity

### 2. Hybrid Real-time Strategy
- **Primary**: Supabase WebSocket subscriptions for instant delivery
- **Fallback**: 2-second polling when replication unavailable
- **Optimistic updates**: Messages appear immediately, rollback on errors
- **Message enrichment**: Automatic display name and avatar resolution

### 3. Modular AI Architecture
- **Pluggable prompts**: Educational framework with parameter overrides
- **Service abstraction**: OpenAI API with dummy service fallback
- **Configuration evolution**: Legacy config upgrade system
- **Educational safety**: Age-appropriate, learning-focused responses

### 4. Educational Progress Tracking
- **Checklist system**: Learning objectives with understanding levels
- **Evidence collection**: AI/tutor assessment of student understanding
- **Template library**: Reusable educational scenarios
- **Analytics foundation**: Complete audit trails for learning effectiveness
- **Tutor export**: Learning Progress can be exported as JSON from the checklist panel, including summary counts and serialized checklist items

### 5. Context + Service Layer Pattern
- **React Context**: Global state management for auth and room state
- **Service abstraction**: Database operations isolated from UI logic
- **Type safety**: Full TypeScript coverage with strict mode
- **Error boundaries**: Comprehensive error handling with user feedback

### 6. Router and Deployment
- **Hash-based routing**: The app now uses `HashRouter` at the shell level so deep links survive refresh on static hosting without server-side SPA rewrites
- **Render compatibility**: This avoids `not found` responses on refresh for routes such as room detail pages when deployed behind static hosting defaults

## 📊 **Test Coverage Metrics**

### Current Coverage Status
- **RoomContext**: ~95% coverage (117 test cases)
- **RoomPage**: ~90% coverage (89 test cases)
- **AuthContext**: 92% coverage (24 test cases)
- **Database Operations**: 87% coverage (20 test cases)
- **Supabase Services**: 83% coverage (12 test cases)

### Coverage Thresholds
- **Lines**: 80%
- **Functions**: 80% 
- **Branches**: 75%
- **Statements**: 80%

### Quality Gates
- **Task Coverage Score**: 75% minimum per task
- **Scenario Distribution**: Balanced coverage across test categories
- **Test Case Density**: Minimum 3 tests per function/feature

## 🛠️ **Development Workflow**

### Implementation Process
1. **Implementation** - Follow task requirements and architectural patterns
2. **Testing** - Write comprehensive unit tests following established patterns
3. **Documentation** - Update relevant documentation files
4. **Verification** - Run tests and validate functionality

### Code Standards
- **KISS principle**: Keep implementations simple and understandable
- **Type safety**: Full TypeScript usage with strict mode
- **Error handling**: Graceful degradation with user feedback
- **Educational focus**: Optimize for learning scenarios over production constraints

## 🔒 **Security Model**

### Educational Security Philosophy
- **Permissive by design**: Optimized for learning scenarios, not production security
- **No capacity limits**: Users can join as any role without restrictions
- **Simplified workflows**: Reduced friction for educational activities
- **Transparent operations**: Extensive logging for educational debugging

### Production Considerations
**Current limitations**:
- Simplified authentication not suitable for production
- Permissive RLS policies need tightening
- Limited audit logging for compliance
- No rate limiting on operations

## 🚧 **Extension Points**

### Adding New Features
1. **Authentication**: Extend `AuthContext` for new user properties
2. **Real-time**: Add new WebSocket event handlers in `RoomContext`
3. **AI capabilities**: Extend `aiService` with new prompt configurations
4. **Database**: Add migrations in `supabase/migrations/` directory
5. **UI components**: Follow existing patterns in `components/` directory

### AI System Extensions
- **New models**: Add entries to `AI_MODELS` constant in `aiService.ts`
- **Educational scenarios**: Add templates to `detectionTemplates.ts`
- **Parameter systems**: Extend prompt configuration in `systemPrompts.ts`
- **Assessment methods**: Enhance checklist system for new learning objectives

## 🐛 **Troubleshooting**

### Common Issues
- **Real-time not working**: Check Supabase replication settings, polling should work as fallback
- **AI suggestions failing**: Verify `REACT_APP_OAI_API_KEY` environment variable
- **Authentication issues**: Check deterministic user ID generation in `AuthContext`
- **Database errors**: Verify RLS policies are permissive for educational use
- **Test failures**: Ensure proper context setup flow (joinRoom → action → assert)

### Debug Tools
- **Browser console**: Extensive logging with emoji prefixes for easy filtering
- **React DevTools**: Inspect Context state and component renders
- **Supabase dashboard**: Monitor real-time connections and database operations
- **Network tab**: Verify API calls and WebSocket connections

### Test Debugging
- **Context state issues**: Always call `joinRoom()` before testing functions requiring room state
- **React act() warnings**: Wrap async operations in `act()` 
- **Mocking issues**: Use complete Supabase query chain mocks with `mockReturnValueOnce()`

## 📈 **Performance Characteristics**

### Optimizations
- **Message polling**: 2-second intervals for real-time fallback
- **Context limiting**: AI uses last 10 messages for token efficiency
- **Optimistic updates**: Zero perceived latency for user actions
- **Connection pooling**: Supabase handles database connection management

### Scalability Considerations
- **Real-time connections**: Limited by Supabase concurrent connections
- **AI token usage**: Conservative limits (100-150 tokens) for cost control
- **Database queries**: Indexed for common access patterns
- **File storage**: Automatic cleanup prevents unlimited growth

## 📝 **Maintenance Guidelines**

### Documentation Updates
Documentation should be updated whenever:
- New features are implemented
- Test coverage is extended
- Architecture changes are made
- New integration patterns are established

### Contributing Guidelines
When adding new documentation:
1. Follow the established file structure
2. Include clear examples and code snippets
3. Maintain links between related documents
4. Update this index file with new documentation
5. Ensure tests follow the established patterns for context setup

## 🔗 **Related Resources**

### External Documentation
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Supabase Testing Guide](https://supabase.com/docs/guides/getting-started/testing)
- [Supabase Documentation](https://supabase.com/docs)

### Project Files
- `src/utils/README.md` - Testing documentation and Jest coverage guide
- `package.json` - NPM scripts and dependencies
- `tsconfig.json` - TypeScript configuration
- `.env.example` - Environment variable template

---

This documentation hub provides comprehensive guidance for understanding, developing, testing, and maintaining the tutor-system codebase. The architecture documentation provides deep technical insights, while the implementation guides offer practical development workflows and testing strategies.
