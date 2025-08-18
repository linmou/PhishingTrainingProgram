# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Phishing Training Program repository containing a tutor-system subdirectory. The tutor-system is a React/TypeScript application with Supabase backend for 1v1 online tutoring with role-based access control (students, tutors, observers).

## Key Commands

### Development
```bash
cd tutor-system
npm install          # Install dependencies
npm start           # Start development server (React on port 3000)
npm run build       # Build for production
```

### Testing
```bash
npm test                    # Run all tests in watch mode
npm run test:coverage       # Run tests with coverage report
npm run test:tasks          # Run all completed task tests (1-3)
npm run test:task1          # Test Supabase configuration
npm run test:task2          # Test database operations
npm run test:task3          # Test authentication system
```

### Environment Setup
1. Copy `env.example` to `.env.local`
2. Add Supabase credentials:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`

## Architecture

### Tech Stack
- **Frontend**: React 18 with TypeScript
- **Backend**: Supabase (PostgreSQL database, Auth, Storage, Realtime)
- **Testing**: Jest, React Testing Library
- **Build**: Create React App

### Key Directories
- `src/components/` - Reusable UI components (LoginForm, ChatMessage, AIAssistantSettings)
- `src/pages/` - Route components for different user views (StudentView, TutorView, ObserverView)
- `src/services/` - Supabase client configuration and service functions
- `src/services/prompts/` - **Modular AI prompt system** (see AI Prompt Architecture below)
- `src/contexts/` - React contexts for auth and room state management
- `src/types/` - TypeScript type definitions for database schema
- `supabase/migrations/` - Database schema and migration files

### Database Schema
The app uses PostgreSQL via Supabase with these main tables:
- `users` - User profiles with roles (student/tutor/observer)
- `rooms` - Learning spaces created by tutors
- `messages` - Chat messages with role-based access
- `sessions` - Active learning sessions
- `ai_assistant_configs` - AI configuration per room
- `ai_conversation_contexts` - Chat history for AI context

Row Level Security (RLS) policies enforce access control at the database level.

### Authentication and Security
- The system uses simplified auth without auth.uid()
- All RLS policies must NOT use auth.uid() - use permissive policies instead
- Database functions should be SECURITY DEFINER to bypass 

### Testing Strategy
Comprehensive unit tests exist for completed features:
- Task 1: Supabase service configuration (`src/services/__tests__/supabase.test.ts`)
- Task 2: Database operations and RLS (`src/services/__tests__/database.test.ts`)
- Task 3: Authentication with role management (`src/contexts/__tests__/AuthContext.test.tsx`)

Tests use mocked Supabase clients to avoid external dependencies. Coverage thresholds are enforced at 80% for lines/functions/statements and 75% for branches.

### Real-time Messaging Implementation
The real-time chat feature uses a hybrid approach due to Supabase replication limitations:
- **WebSocket subscription**: Set up for future real-time support when Supabase enables replication
- **Polling mechanism**: Currently polls the database every 2 seconds for new messages
- **Optimistic updates**: Messages appear immediately in the UI when sent, with automatic rollback on errors
- **Display names**: Automatically added to messages based on user roles (Student/Tutor/Observer)

**Note**: Once Supabase replication is enabled for the `messages` table, real-time events will work automatically without code changes.

### AI Assistant Module
The system includes a dummy AI assistant feature for tutors:
- Configurable per room (model, temperature, max tokens)
- Generates contextual educational responses
- Maintains conversation history
- Currently uses dummy implementation (5% simulated failure rate)
- Real AI integration possible via environment variables

### AI Prompt Architecture
The AI assistant uses a **modular prompt system** located in `src/services/prompts/`:

#### File Structure
```
src/services/prompts/
├── index.ts                      # Main generateSystemPrompt() function
├── types.ts                      # TypeScript interfaces
├── basePrompt.ts                 # Core system prompt foundation
├── presets.ts                    # Ready-made configurations (casual_peer, supportive_adult)
├── parameters/
│   ├── roleParameters.ts         # Peer vs Trusted Adult personas (low/high intensity)
│   ├── communicationStyles.ts    # Teen slang, conversational markers, uncertainty
│   ├── cognitiveParameters.ts    # Concept density, perspective taking, examples
│   └── emotionalParameters.ts    # Enthusiasm, validation, mistake normalization
└── education/
    ├── learningStages.ts         # 3-stage learning process framework
    ├── scaffoldingTechniques.ts  # Educational support methods
    └── detectionRules.ts         # Scam detection and privacy protection rules
```

#### Key Features
- **Parameter Consistency**: All parameters (roles, communication, cognitive, emotional) use the same `low`/`high` intensity structure
- **Modular Design**: Each file handles a single concern, making modifications easier
- **Backward Compatibility**: Existing imports from `systemPrompts.ts` continue to work
- **Preset Configurations**: Ready-made combinations for common scenarios
- **Educational Framework**: Built-in scaffolding techniques and learning stages

#### Usage Example
```typescript
import { generateSystemPrompt, PRESET_CONFIGS } from '../services/systemPrompts';

// Use preset configuration
const config = {
  ...PRESET_CONFIGS.casual_peer,
  detection_areas: ['Urgent language', 'Suspicious links'],
  verification_steps: ['Check sender', 'Verify URL']
};

const systemPrompt = generateSystemPrompt(config);
```

#### Customization
Tutors can modify individual parameter categories without affecting others:
- **Role intensity**: Adjust peer/adult persona strength
- **Communication style**: Control teen slang usage and uncertainty expression  
- **Cognitive approach**: Set concept density and perspective-taking frequency
- **Emotional tone**: Configure enthusiasm, validation, and confidence-building levels

### Key Implementation Patterns
- **Authentication**: Supabase Auth with role-based access control (no capacity limits)
- **Real-time**: Hybrid approach using Supabase subscriptions (ready for when replication is enabled) + polling fallback
- **State Management**: React Context API for auth and room state
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Type Safety**: Full TypeScript coverage with strict mode enabled
- **Performance**: Uses React useCallback hooks to prevent unnecessary re-renders in polling loops

## Troubleshooting

### npm Commands Not Working
If npm commands appear to fail:
1. Check npm is in PATH: `which npm`
2. Verify npm version: `npm --version`
3. Check current directory: `pwd`
4. Ensure you're in the correct subdirectory (e.g., `cd tutor-system` for this project)

Note: Conda environments (like base) don't interfere with npm/node. They manage separate package ecosystems.

## Development Workflow Recommendations

### Refactoring and Testing
- When you finish refactoring a function, try 'npm start' to see if there are any bugs as the final test

## Database Migration Guidelines
- New SQL files should be created in `tutor-system/supabase/migrations`
- Carefully consider existing table schemas when creating new migrations

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md
