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

### Testing Strategy
Comprehensive unit tests exist for completed features:
- Task 1: Supabase service configuration (`src/services/__tests__/supabase.test.ts`)
- Task 2: Database operations and RLS (`src/services/__tests__/database.test.ts`)
- Task 3: Authentication with role management (`src/contexts/__tests__/AuthContext.test.tsx`)

Tests use mocked Supabase clients to avoid external dependencies. Coverage thresholds are enforced at 80% for lines/functions/statements and 75% for branches.

### AI Assistant Module
The system includes a dummy AI assistant feature for tutors:
- Configurable per room (model, temperature, max tokens)
- Generates contextual educational responses
- Maintains conversation history
- Currently uses dummy implementation (5% simulated failure rate)
- Real AI integration possible via environment variables

### Key Implementation Patterns
- **Authentication**: Supabase Auth with role-based access control and capacity limits (1 tutor + 1 student max)
- **Real-time**: Supabase subscriptions for live chat and room updates
- **State Management**: React Context API for auth and room state
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Type Safety**: Full TypeScript coverage with strict mode enabled