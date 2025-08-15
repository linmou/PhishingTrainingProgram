/**
 * Test database connection and RLS policies
 */

import { supabase } from '../services/supabase';

describe('Database Connection Test', () => {
  const testRoomId = 'cc187010-f419-45e5-969e-9c4750399877';

  test('check multiple active checklists for same room', async () => {
    console.log('🔍 Checking for multiple active checklists per room...');
    
    // Get all active checklists for the test room
    const { data: roomChecklists, error } = await supabase
      .from('session_checklists')
      .select('*')
      .eq('room_id', testRoomId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    console.log('📊 Active checklists for room', testRoomId, ':', {
      count: roomChecklists?.length || 0,
      error: error?.message || 'none'
    });
    
    if (roomChecklists && roomChecklists.length > 0) {
      console.log('🚨 FOUND MULTIPLE ACTIVE CHECKLISTS! This is the problem!');
      roomChecklists.forEach((checklist, index) => {
        console.log(`  ${index + 1}. Checklist:`, {
          id: checklist.id,
          template_name: checklist.template_name,
          created_at: checklist.created_at
        });
      });
    }
    
    expect(error).toBeNull();
  }, 30000);

  test('check is_active values in database', async () => {
    console.log('🔍 Checking is_active values in session_checklists...');
    
    // Get all session_checklists
    const { data: allChecklists, error: allError } = await supabase
      .from('session_checklists')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    console.log('📊 All checklists (last 10):', {
      count: allChecklists?.length || 0,
      error: allError?.message || 'none'
    });
    
    if (allChecklists) {
      allChecklists.forEach(checklist => {
        console.log('  Checklist:', {
          id: checklist.id,
          room_id: checklist.room_id,
          is_active: checklist.is_active,
          is_active_type: typeof checklist.is_active,
          is_active_value: checklist.is_active === true ? 'TRUE' : checklist.is_active === false ? 'FALSE' : `OTHER: ${checklist.is_active}`,
          template_name: checklist.template_name,
          created_at: checklist.created_at
        });
      });
    }
    
    // Check for NULL is_active values
    const { data: nullActiveChecklists, error: nullError } = await supabase
      .from('session_checklists')
      .select('*')
      .is('is_active', null);
    
    console.log('🔍 Checklists with NULL is_active:', {
      count: nullActiveChecklists?.length || 0,
      error: nullError?.message || 'none'
    });
    
    // Check for false is_active values
    const { data: falseActiveChecklists, error: falseError } = await supabase
      .from('session_checklists')
      .select('*')
      .eq('is_active', false);
    
    console.log('🔍 Checklists with is_active = false:', {
      count: falseActiveChecklists?.length || 0,
      error: falseError?.message || 'none'
    });
    
    // Check for true is_active values
    const { data: trueActiveChecklists, error: trueError } = await supabase
      .from('session_checklists')
      .select('*')
      .eq('is_active', true);
    
    console.log('✅ Checklists with is_active = true:', {
      count: trueActiveChecklists?.length || 0,
      error: trueError?.message || 'none'
    });
    
    expect(allError).toBeNull();
  }, 30000);

  test('can connect to Supabase', async () => {
    console.log('🔌 Testing Supabase connection...');
    
    // Test basic connection
    const { data, error } = await supabase
      .from('rooms')
      .select('id')
      .limit(1);
    
    console.log('🏠 Rooms query result:', { found: !!data, error: error?.message });
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  test('can read session_checklists table', async () => {
    console.log('📋 Testing session_checklists table access...');
    
    const { data, error } = await supabase
      .from('session_checklists')
      .select('*')
      .limit(5);
    
    console.log('📊 session_checklists query result:', { 
      found: !!data, 
      count: data?.length || 0,
      error: error?.message,
      errorCode: error?.code,
      errorDetails: error?.details
    });
    
    if (error) {
      console.error('❌ Full error object:', error);
    }
    
    // This should not error even if no rows
    expect(error).toBeNull();
  });

  test('can read checklist for specific room', async () => {
    console.log('🎯 Testing specific room checklist access...');
    
    const { data, error } = await supabase
      .from('session_checklists')
      .select('*')
      .eq('room_id', testRoomId)
      .eq('is_active', true);
    
    console.log('🎯 Room-specific query result:', { 
      found: !!data, 
      count: data?.length || 0,
      error: error?.message,
      errorCode: error?.code
    });
    
    if (data && data.length > 0) {
      console.log('📋 Found checklist:', data[0]);
    }
    
    expect(error).toBeNull();
  });

  test('can create and read checklist', async () => {
    console.log('✍️ Testing checklist creation and read...');
    
    // Try to create a test checklist
    const testChecklist = {
      room_id: testRoomId,
      template_name: 'Test Template',
      session_start: new Date().toISOString(),
      is_active: true
    };
    
    const { data: created, error: createError } = await supabase
      .from('session_checklists')
      .insert(testChecklist)
      .select()
      .single();
    
    console.log('✍️ Create result:', { 
      success: !!created, 
      error: createError?.message,
      id: created?.id
    });
    
    if (createError) {
      console.error('❌ Create error:', createError);
      // If create fails, that's the issue
      expect(createError).toBeNull();
      return;
    }
    
    // Try to read it back
    const { data: readBack, error: readError } = await supabase
      .from('session_checklists')
      .select('*')
      .eq('id', created.id)
      .single();
    
    console.log('📖 Read result:', { 
      success: !!readBack, 
      error: readError?.message
    });
    
    expect(readError).toBeNull();
    expect(readBack).toBeDefined();
    expect(readBack.id).toBe(created.id);
    
    // Clean up
    await supabase
      .from('session_checklists')
      .delete()
      .eq('id', created.id);
  });
});