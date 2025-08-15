import { supabase } from '../services/supabase';
import { ChecklistService } from '../services/checklistService';

describe('Checklist Stability Test', () => {
  const testRoomId = 'cc187010-f419-45e5-969e-9c4750399877';
  
  beforeEach(async () => {
    // Clean up any existing checklists
    await supabase
      .from('session_checklists')
      .update({ is_active: false })
      .eq('room_id', testRoomId);
  });

  test('should consistently create checklists', async () => {
    const results = [];
    
    for (let i = 0; i < 5; i++) {
      console.log(`\n🔄 Attempt ${i + 1}/5`);
      
      try {
        // Test RPC function
        console.log('  Testing RPC function...');
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('initialize_checklist_from_template', {
            p_room_id: testRoomId,
            p_template_name: 'Test Template'
          });
        
        if (rpcError) {
          console.log('  ❌ RPC failed:', rpcError.message);
          results.push({ attempt: i + 1, method: 'rpc', success: false, error: rpcError.message });
        } else {
          console.log('  ✅ RPC succeeded, checklist ID:', rpcData);
          
          // Try to read it back
          const { data: readData, error: readError } = await supabase
            .from('session_checklists')
            .select('*')
            .eq('room_id', testRoomId)
            .eq('is_active', true)
            .single();
          
          if (readError) {
            console.log('  ❌ Read failed:', readError.message, readError.code);
            results.push({ attempt: i + 1, method: 'rpc', success: false, error: `Read: ${readError.message}` });
          } else {
            console.log('  ✅ Read succeeded');
            results.push({ attempt: i + 1, method: 'rpc', success: true });
          }
        }
        
        // Clean up
        await supabase
          .from('session_checklists')
          .update({ is_active: false })
          .eq('room_id', testRoomId);
        
        // Test createManual
        console.log('  Testing createManual...');
        const checklist = await ChecklistService.createManual(
          testRoomId,
          ['Test area 1', 'Test area 2'],
          ['Test step 1', 'Test step 2']
        );
        
        console.log('  ✅ createManual succeeded');
        results.push({ attempt: i + 1, method: 'createManual', success: true });
        
      } catch (error: any) {
        console.log('  ❌ Error:', error.message);
        results.push({ attempt: i + 1, method: 'unknown', success: false, error: error.message });
      }
      
      // Clean up between attempts
      await supabase
        .from('session_checklists')
        .update({ is_active: false })
        .eq('room_id', testRoomId);
      
      // Small delay between attempts
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Summary
    console.log('\n📊 Summary:');
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    console.log(`  Success: ${successCount}/${results.length}`);
    console.log(`  Failure: ${failureCount}/${results.length}`);
    
    results.filter(r => !r.success).forEach(r => {
      console.log(`  Failed attempt ${r.attempt} (${r.method}): ${r.error}`);
    });
    
    // We expect at least 80% success rate
    expect(successCount).toBeGreaterThanOrEqual(results.length * 0.8);
  }, 60000);
});