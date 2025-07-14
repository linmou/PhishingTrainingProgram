// First define what we want to return
const mockRoomData = {
  id: 'room-1',
  title: 'Test Room',
  is_active: true
};

// Mock at the top level
jest.mock('../services/supabase', () => {
  const mockFrom = jest.fn((table: string) => {
    console.log(`Mock from called with: ${table}`);
    const query = {
      select: jest.fn(() => query),
      eq: jest.fn(() => query),
      single: jest.fn(() => Promise.resolve({ data: mockRoomData, error: null }))
    };
    return query;
  });

  return {
    supabase: {
      from: mockFrom
    }
  };
});

// Now import
import { supabase } from '../services/supabase';
import * as supabaseModule from '../services/supabase';

describe('Simple Mock Test', () => {
  test('should check what we actually imported', () => {
    console.log('🔍 supabase:', supabase);
    console.log('🔍 supabase type:', typeof supabase);
    console.log('🔍 supabase.from:', supabase?.from);
    console.log('🔍 entire module:', supabaseModule);
    console.log('🔍 module keys:', Object.keys(supabaseModule));
    
    expect(supabase).toBeDefined();
  });
});