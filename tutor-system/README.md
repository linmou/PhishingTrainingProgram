# Tutor System - 1v1 Online Training Platform

A Supabase-based React application for 1v1 tutor-student training with real-time communication and role-based access control.

## 🏗️ Architecture

- **Frontend**: React.js with TypeScript
- **Backend**: Supabase (PostgreSQL)
- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage (images)
- **Real-time**: Supabase Realtime subscriptions
- **Hosting**: Vercel/Netlify (recommended)

## 📋 Features

- **Role-based Access**: Students, Tutors, and Observers
- **Capacity Management**: 1 tutor + 1 student maximum
- **Room System**: Tutors create rooms with content and images
- **Real-time Chat**: Live messaging with role permissions
- **File Downloads**: Chat history and room information export
- **Responsive Design**: Mobile and desktop support

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- Supabase account
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd tutor-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new project at https://supabase.com
   - Copy your project URL and anon key from Settings > API
   - Run the database migration (see Database Setup below)

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

5. **Database Setup**
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Run the migration file: `supabase/migrations/001_initial_schema.sql`

### Development

1. **Start the development server**
   ```bash
   npm start
   ```

2. **Build for production**
   ```bash
   npm run build
   ```

## 📁 Project Structure

```
tutor-system/
├── src/
│   ├── components/     # Reusable React components
│   ├── pages/         # Route components (Student/Tutor/Observer views)
│   ├── services/      # Supabase configuration and services
│   ├── contexts/      # React Context for state management
│   ├── hooks/         # Custom React hooks
│   ├── types/         # TypeScript type definitions
│   └── utils/         # Helper functions
├── supabase/
│   └── migrations/    # Database migration files
├── public/           # Static assets
└── package.json      # Dependencies
```

## 🗄️ Database Schema

### Tables

- **users**: User profiles and roles
- **rooms**: Tutor-created learning spaces
- **messages**: Chat messages with role-based access
- **sessions**: Active learning sessions

### Key Features

- **Row Level Security (RLS)**: Automatic access control based on user authentication
- **Real-time subscriptions**: Live updates for chat and room changes
- **Triggers**: Automatic timestamp updates
- **Enums**: Type-safe role and status management

## 🔐 Security

- **Row Level Security**: Database-level access control
- **Role-based permissions**: Enforced at the database level
- **Capacity limits**: Automatically enforced via application logic
- **Authenticated uploads**: Only tutors can upload images

## 📝 Development Roadmap

- [x] **Task 1**: Project Setup & Architecture (Supabase) ✅
- [ ] **Task 2**: Database Design & Schema (PostgreSQL)
- [ ] **Task 3**: Supabase Authentication System
- [ ] **Task 4**: Capacity Management Logic
- [ ] **Task 5**: Supabase Storage Room Management
- [ ] **Task 6**: Room Discovery & Joining
- [ ] **Task 7**: Real-time Chat System
- [ ] **Task 8**: Chat History & Room Info Download
- [ ] **Task 9**: User Interface - Student View
- [ ] **Task 10**: User Interface - Tutor View
- [ ] **Task 11**: User Interface - Observer View
- [ ] **Task 12**: Testing & Quality Assurance
- [ ] **Task 13**: Production Deployment

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Supabase Setup Checklist

1. **Database**: Run the initial migration
2. **Authentication**: Enable email/password authentication
3. **Storage**: Create bucket for room images
4. **RLS Policies**: Already included in migration
5. **Real-time**: Enable for messages table

## 🧪 Testing

### Test Coverage for Completed Tasks

We have comprehensive unit tests for completed tasks 1-3:

- **Task 1**: Supabase service configuration and helper functions
- **Task 2**: Database schema, RLS policies, and CRUD operations  
- **Task 3**: Authentication system with role management and capacity limits

See [Testing Strategy Documentation](docs/testing-strategy.md) for detailed coverage information.

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test suites
npm test src/services/__tests__/supabase.test.ts      # Task 1
npm test src/services/__tests__/database.test.ts      # Task 2  
npm test src/contexts/__tests__/AuthContext.test.tsx  # Task 3
```

### Test Files Structure

```
src/
├── services/__tests__/
│   ├── supabase.test.ts          # Task 1: Supabase configuration
│   └── database.test.ts          # Task 2: Database operations
└── contexts/__tests__/
    └── AuthContext.test.tsx      # Task 3: Authentication system
```

## 📱 Usage

1. **Sign Up/Sign In**: Create account or log in
2. **Role Selection**: Choose Student/Tutor/Observer
3. **Tutors**: Create rooms with content and images
4. **Students**: Browse and join available rooms
5. **Observers**: View rooms and chat in read-only mode
6. **Chat**: Real-time messaging between tutors and students
7. **Export**: Download chat history and room information

## 🚀 Deployment

### Recommended: Vercel

1. **Connect your repository to Vercel**
2. **Add environment variables** in Vercel dashboard
3. **Deploy** - automatic deployments on git push

### Alternative: Netlify

1. **Connect repository to Netlify**
2. **Set build command**: `npm run build`
3. **Set publish directory**: `build`
4. **Add environment variables**

## 🛠️ Migration from Firebase

If migrating from Firebase:

1. **Export data** from Firestore
2. **Transform data** to match PostgreSQL schema
3. **Import data** using Supabase client
4. **Update frontend** to use new API patterns
5. **Test thoroughly** with new authentication flow

## 🤝 Contributing

1. Follow the task-based development approach
2. Implement features according to the roadmap order
3. Update tests and documentation
4. Follow TypeScript and React best practices
5. Ensure RLS policies are properly tested

## 📄 License

This project is licensed under the MIT License. 