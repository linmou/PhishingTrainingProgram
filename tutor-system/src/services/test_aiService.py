#!/usr/bin/env python3
"""
Unit tests for AI Service Module

This test suite covers the AI assistant functionality including:
- Dummy AI response generation
- AI configuration management  
- Conversation context handling
- Error scenarios
- Database operations

Run with: python -m unittest src/services/test_aiService.py
"""

import unittest
import json
import time
from unittest.mock import Mock, patch, MagicMock
from typing import Dict, List, Any, Optional


class MockSupabaseClient:
    """Mock Supabase client for testing"""
    
    def __init__(self):
        self.data = {
            'rooms': [],
            'messages': [],
            'ai_assistant_configs': [],
            'ai_conversation_contexts': []
        }
        self.rpc_responses = {}
    
    def from_table(self, table_name: str):
        """Mock table operations"""
        return MockTable(self.data.get(table_name, []), table_name)
    
    def rpc(self, function_name: str, params: Dict):
        """Mock RPC function calls"""
        return MockRPCResponse(self.rpc_responses.get(function_name, 'mock-uuid'))


class MockTable:
    """Mock Supabase table operations"""
    
    def __init__(self, data: List[Dict], table_name: str):
        self.data = data
        self.table_name = table_name
        self.filters: Dict[str, Any] = {}
        self.select_fields = '*'
    
    def select(self, fields: str = '*'):
        """Mock select operation"""
        self.select_fields = fields
        return self
    
    def eq(self, column: str, value: Any):
        """Mock equality filter"""
        self.filters[column] = value
        return self
    
    def insert(self, data: Dict):
        """Mock insert operation"""
        new_record = {**data, 'id': f'mock-{len(self.data)}'}
        self.data.append(new_record)
        return MockResponse([new_record])
    
    def update(self, data: Dict):
        """Mock update operation"""
        for record in self.data:
            match = all(record.get(k) == v for k, v in self.filters.items())
            if match:
                record.update(data)
                return MockResponse([record])
        return MockResponse(None, error={'message': 'Record not found'})
    
    def single(self):
        """Mock single record retrieval"""
        filtered_data = [
            record for record in self.data
            if all(record.get(k) == v for k, v in self.filters.items())
        ]
        if filtered_data:
            return MockResponse(filtered_data[0])
        return MockResponse(None, error={'code': 'PGRST116', 'message': 'No rows found'})


class MockResponse:
    """Mock Supabase response"""
    
    def __init__(self, data: Any, error: Optional[Dict[str, Any]] = None):
        self.data = data
        self.error = error


class MockRPCResponse:
    """Mock RPC response"""
    
    def __init__(self, data: Any, error: Optional[Dict[str, Any]] = None):
        self.data = data
        self.error = error


class DummyAIService:
    """Python version of the dummy AI service for testing"""
    
    DUMMY_RESPONSES = {
        'educational': [
            "That's a great question! Let me break this down for you step by step...",
            "I can help you understand this concept better. Here's how it works...",
            "This is an important topic in your studies. Let me explain the key points...",
        ],
        'encouragement': [
            "You're making excellent progress! Keep up the good work.",
            "That's exactly the right approach. You're thinking about this correctly.",
            "Great question! Asking questions like this shows you're really engaged.",
        ],
        'clarification': [
            "Let me clarify that point for you...",
            "I think there might be some confusion here. Let me explain...",
            "That's a common misconception. The actual explanation is...",
        ]
    }
    
    @classmethod
    def determine_response_category(cls, user_message: str) -> str:
        """Determine response category based on message content"""
        message = user_message.lower()
        
        if any(word in message for word in ['?', 'how', 'what', 'why']):
            return 'educational'
        
        if any(word in message for word in ['difficult', 'hard', 'confused']):
            return 'clarification'
        
        return 'educational'  # Default for testing
    
    @classmethod
    def get_random_response(cls, category: str) -> str:
        """Get a random response from category"""
        responses = cls.DUMMY_RESPONSES.get(category, cls.DUMMY_RESPONSES['educational'])
        return responses[0]  # Use first response for consistent testing
    
    @classmethod
    async def generate_response(cls, user_message: str, conversation_history: List, config: Dict) -> Dict:
        """Generate a dummy AI response"""
        # Simulate processing time
        start_time = time.time()
        
        # Simulate occasional failures (disabled for testing consistency)
        # if random.random() < 0.05:
        #     raise Exception('AI service temporarily unavailable')
        
        category = cls.determine_response_category(user_message)
        content = cls.get_random_response(category)
        
        end_time = time.time()
        response_time = int((end_time - start_time) * 1000)
        
        return {
            'content': content,
            'model_used': config.get('model_name', 'gpt-3.5-turbo'),
            'response_time_ms': response_time,
            'success': True
        }


class TestAIService(unittest.TestCase):
    """Test cases for AI Service functionality"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.mock_supabase = MockSupabaseClient()
        self.room_id = 'test-room-123'
        self.user_id = 'test-user-456'
        self.tutor_id = 'test-tutor-789'
        
        # Sample AI configuration
        self.ai_config = {
            'id': 'config-1',
            'room_id': self.room_id,
            'model_name': 'gpt-3.5-turbo',
            'system_prompt': 'You are a helpful tutor.',
            'temperature': 0.7,
            'max_tokens': 150,
            'is_active': True,
            'created_at': '2024-01-01T00:00:00Z',
            'updated_at': '2024-01-01T00:00:00Z'
        }
        
        # Sample conversation message
        self.conversation_message = {
            'role': 'user',
            'content': 'What is photosynthesis?',
            'timestamp': 1704067200
        }
    
    def test_dummy_ai_response_generation(self):
        """Test dummy AI response generation with different message types"""
        
        # Test educational question
        response = DummyAIService.generate_response(
            "What is photosynthesis?",
            [],
            {'model_name': 'gpt-3.5-turbo'}
        )
        
        self.assertTrue(response['success'])
        self.assertEqual(response['model_used'], 'gpt-3.5-turbo')
        self.assertIn('question', response['content'])
        self.assertIsInstance(response['response_time_ms'], int)
        self.assertGreater(response['response_time_ms'], 0)
    
    def test_response_category_determination(self):
        """Test that different message types get appropriate response categories"""
        
        # Educational questions
        category = DummyAIService.determine_response_category("What is the capital of France?")
        self.assertEqual(category, 'educational')
        
        category = DummyAIService.determine_response_category("How does this work?")
        self.assertEqual(category, 'educational')
        
        # Confusion/clarification
        category = DummyAIService.determine_response_category("This is difficult to understand")
        self.assertEqual(category, 'clarification')
        
        category = DummyAIService.determine_response_category("I'm confused about this")
        self.assertEqual(category, 'clarification')
    
    def test_ai_config_initialization(self):
        """Test AI assistant configuration initialization"""
        
        # Mock successful initialization
        self.mock_supabase.rpc_responses['initialize_ai_assistant'] = 'config-123'
        
        # Simulate initialization
        config_id = self.mock_supabase.rpc('initialize_ai_assistant', {
            'p_room_id': self.room_id,
            'p_model_name': 'gpt-4',
            'p_system_prompt': 'Custom prompt'
        })
        
        self.assertEqual(config_id.data, 'config-123')
        self.assertIsNone(config_id.error)
    
    def test_ai_config_retrieval(self):
        """Test retrieving AI configuration for a room"""
        
        # Add config to mock data
        self.mock_supabase.data['ai_assistant_configs'].append(self.ai_config)
        
        # Test retrieval
        table = self.mock_supabase.from_table('ai_assistant_configs')
        response = table.select('*').eq('room_id', self.room_id).eq('is_active', True).single()
        
        self.assertIsNotNone(response.data)
        self.assertEqual(response.data['room_id'], self.room_id)
        self.assertEqual(response.data['model_name'], 'gpt-3.5-turbo')
        self.assertIsNone(response.error)
    
    def test_ai_config_not_found(self):
        """Test handling when AI config doesn't exist"""
        
        # Test retrieval for non-existent config
        table = self.mock_supabase.from_table('ai_assistant_configs')
        response = table.select('*').eq('room_id', 'non-existent').eq('is_active', True).single()
        
        self.assertIsNone(response.data)
        self.assertIsNotNone(response.error)
        self.assertEqual(response.error['code'], 'PGRST116')
    
    def test_ai_config_update(self):
        """Test updating AI configuration"""
        
        # Add existing config
        self.mock_supabase.data['ai_assistant_configs'].append(self.ai_config.copy())
        
        # Test update
        table = self.mock_supabase.from_table('ai_assistant_configs')
        response = table.update({
            'temperature': 0.9,
            'max_tokens': 200
        }).eq('room_id', self.room_id).single()
        
        self.assertIsNotNone(response.data)
        self.assertEqual(response.data['temperature'], 0.9)
        self.assertEqual(response.data['max_tokens'], 200)
        self.assertIsNone(response.error)
    
    def test_conversation_context_management(self):
        """Test conversation context storage and retrieval"""
        
        # Sample conversation context
        context_data = {
            'id': 'context-1',
            'room_id': self.room_id,
            'conversation_history': [self.conversation_message],
            'last_updated': '2024-01-01T00:00:00Z'
        }
        
        # Add to mock data
        self.mock_supabase.data['ai_conversation_contexts'].append(context_data)
        
        # Test retrieval
        table = self.mock_supabase.from_table('ai_conversation_contexts')
        response = table.select('conversation_history').eq('room_id', self.room_id).single()
        
        self.assertIsNotNone(response.data)
        self.assertEqual(len(response.data['conversation_history']), 1)
        self.assertEqual(response.data['conversation_history'][0]['content'], 'What is photosynthesis?')
    
    def test_conversation_context_addition(self):
        """Test adding messages to conversation context"""
        
        # Mock RPC function for adding context
        self.mock_supabase.rpc_responses['add_conversation_context'] = None
        
        # Test adding context
        response = self.mock_supabase.rpc('add_conversation_context', {
            'p_room_id': self.room_id,
            'p_role': 'user',
            'p_content': 'What is photosynthesis?'
        })
        
        self.assertIsNone(response.error)
    
    def test_message_creation_with_ai_metadata(self):
        """Test creating messages with AI metadata"""
        
        # Test AI message creation
        table = self.mock_supabase.from_table('messages')
        response = table.insert({
            'room_id': self.room_id,
            'user_id': self.tutor_id,
            'content': 'Photosynthesis is the process...',
            'user_role': 'tutor',
            'response_mode': 'tutoring',
            'ai_model_used': 'gpt-3.5-turbo',
            'ai_response_time_ms': 1500,
            'parent_message_id': 'parent-msg-123'
        })
        
        self.assertIsNotNone(response.data)
        self.assertEqual(len(response.data), 1)
        
        message = response.data[0]
        self.assertEqual(message['response_mode'], 'tutoring')
        self.assertNotIn('is_ai_generated', message)
        self.assertEqual(message['ai_model_used'], 'gpt-3.5-turbo')
        self.assertEqual(message['ai_response_time_ms'], 1500)
        self.assertEqual(message['parent_message_id'], 'parent-msg-123')
    
    def test_ai_response_generation_workflow(self):
        """Test complete AI response generation workflow"""
        
        # Setup: Add AI config and context
        self.mock_supabase.data['ai_assistant_configs'].append(self.ai_config)
        self.mock_supabase.data['ai_conversation_contexts'].append({
            'id': 'context-1',
            'room_id': self.room_id,
            'conversation_history': [self.conversation_message],
            'last_updated': '2024-01-01T00:00:00Z'
        })
        
        # Step 1: Get AI config
        config_table = self.mock_supabase.from_table('ai_assistant_configs')
        config_response = config_table.select('*').eq('room_id', self.room_id).single()
        
        self.assertIsNotNone(config_response.data)
        
        # Step 2: Get conversation context
        context_table = self.mock_supabase.from_table('ai_conversation_contexts')
        context_response = context_table.select('conversation_history').eq('room_id', self.room_id).single()
        
        self.assertIsNotNone(context_response.data)
        
        # Step 3: Generate AI response
        ai_response = DummyAIService.generate_response(
            "What is photosynthesis?",
            context_response.data['conversation_history'],
            config_response.data
        )
        
        self.assertTrue(ai_response['success'])
        self.assertIsNotNone(ai_response['content'])
        
        # Step 4: Save AI message
        message_table = self.mock_supabase.from_table('messages')
        message_response = message_table.insert({
            'room_id': self.room_id,
            'user_id': self.tutor_id,
            'content': ai_response['content'],
            'user_role': 'tutor',
            'response_mode': 'tutoring',
            'ai_model_used': ai_response['model_used'],
            'ai_response_time_ms': ai_response['response_time_ms']
        })
        
        self.assertIsNotNone(message_response.data)
    
    def test_error_handling_scenarios(self):
        """Test various error scenarios"""
        
        # Test AI config not found
        table = self.mock_supabase.from_table('ai_assistant_configs')
        response = table.select('*').eq('room_id', 'invalid-room').single()
        
        self.assertIsNone(response.data)
        self.assertIsNotNone(response.error)
        self.assertEqual(response.error['code'], 'PGRST116')
        
        # Test update non-existent record
        update_response = table.update({'temperature': 0.8}).eq('room_id', 'invalid-room').single()
        
        self.assertIsNone(update_response.data)
        self.assertIsNotNone(update_response.error)
    
    def test_ai_models_configuration(self):
        """Test different AI model configurations"""
        
        models = {
            'gpt-4': {
                'name': 'GPT-4',
                'max_tokens': 4000,
                'temperature': 0.7
            },
            'gpt-3.5-turbo': {
                'name': 'GPT-3.5 Turbo',
                'max_tokens': 2000,
                'temperature': 0.7
            },
            'claude-3': {
                'name': 'Claude 3',
                'max_tokens': 3000,
                'temperature': 0.6
            }
        }
        
        for model_id, model_config in models.items():
            # Test response generation with different models
            response = DummyAIService.generate_response(
                "Test question",
                [],
                {'model_name': model_id}
            )
            
            self.assertTrue(response['success'])
            self.assertEqual(response['model_used'], model_id)
    
    def test_conversation_context_persistence(self):
        """Test that conversation context maintains proper structure"""
        
        # Test multiple messages in context
        context = [
            {'role': 'user', 'content': 'What is photosynthesis?', 'timestamp': 1704067200},
            {'role': 'assistant', 'content': 'Photosynthesis is...', 'timestamp': 1704067260},
            {'role': 'user', 'content': 'Can you explain more?', 'timestamp': 1704067320}
        ]
        
        context_data = {
            'id': 'context-1',
            'room_id': self.room_id,
            'conversation_history': context,
            'last_updated': '2024-01-01T00:00:00Z'
        }
        
        self.mock_supabase.data['ai_conversation_contexts'].append(context_data)
        
        # Retrieve and verify context structure
        table = self.mock_supabase.from_table('ai_conversation_contexts')
        response = table.select('conversation_history').eq('room_id', self.room_id).single()
        
        self.assertIsNotNone(response.data)
        history = response.data['conversation_history']
        
        self.assertEqual(len(history), 3)
        self.assertEqual(history[0]['role'], 'user')
        self.assertEqual(history[1]['role'], 'assistant')
        self.assertEqual(history[2]['role'], 'user')
    
    def test_response_time_tracking(self):
        """Test that response times are properly tracked"""
        
        start_time = time.time()
        
        response = DummyAIService.generate_response(
            "Test message",
            [],
            {'model_name': 'gpt-3.5-turbo'}
        )
        
        end_time = time.time()
        actual_time = int((end_time - start_time) * 1000)
        
        self.assertTrue(response['success'])
        self.assertIsInstance(response['response_time_ms'], int)
        self.assertGreaterEqual(response['response_time_ms'], 0)
        # Response time should be roughly in the same range as actual processing time
        self.assertLessEqual(abs(response['response_time_ms'] - actual_time), 100)


def run_tests():
    """Run all tests"""
    unittest.main(verbosity=2)


if __name__ == '__main__':
    run_tests() 
