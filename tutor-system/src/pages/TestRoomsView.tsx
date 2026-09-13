/**
 * Purpose: Tutor page for behavior-eval / demo rooms only.
 * These rooms are hidden from the main /tutor "Your Rooms" list.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createRoom, deleteRoom, getRoomsByTutor, getRoomTemplatesByTutor } from '../services/supabase';
import { getAIConfig, initializeAIAssistant, updateAIConfig, DEFAULT_AI_MODEL } from '../services/aiService';
import { Database } from '../types/database';
import AvatarDisplay from '../components/AvatarDisplay';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import { RoomTemplate } from '../types';
import {
  getDemoRoomTemplateSeeds,
  getMultiAgentTestRoomTemplateSeeds,
  toRoomTemplateInsertRow
} from '../services/demoRoomTemplates';
import {
  isBehaviorDemoTemplateName,
  isBehaviorTestRoom,
  markBehaviorTestDescription
} from '../utils/behaviorTestRooms';
import '../components/TutorView.css';

type Room = Database['public']['Tables']['rooms']['Row'];

/**
 * The global template rows are owned by the system user, so a browser client with no Supabase
 * session (auth.uid() is NULL) cannot read them under the table's RLS policy. These rows are the
 * shipped seeds that produced those records, used only when the database returns none.
 */
const shippedDemoTemplateRows = (): RoomTemplate[] =>
  [...getDemoRoomTemplateSeeds(), ...getMultiAgentTestRoomTemplateSeeds()].map((seed, index) => {
    const row = toRoomTemplateInsertRow(seed);
    return {
      ...row,
      id: `shipped-seed-${index}`,
      usage_count: 0,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString()
    } as RoomTemplate;
  });

const mergeShippedDemoTemplateRows = (templates: RoomTemplate[]): RoomTemplate[] => {
  const existingNames = new Set(templates.map((template) => template.template_name));
  return [
    ...templates,
    ...shippedDemoTemplateRows().filter((template) => !existingNames.has(template.template_name))
  ];
};

const TestRoomsView: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [templates, setTemplates] = useState<RoomTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);

  const behaviorTemplates = useMemo(
    () => templates.filter((t) => isBehaviorDemoTemplateName(t.template_name)),
    [templates]
  );

  const testRooms = useMemo(() => rooms.filter((r) => isBehaviorTestRoom(r)), [rooms]);

  const loadRooms = useCallback(async () => {
    if (!user?.id) return;
    try {
      const userRooms = await getRoomsByTutor(user.id);
      setRooms(userRooms);
    } catch (err) {
      console.error('Error loading rooms:', err);
    }
  }, [user?.id]);

  const loadTemplates = useCallback(async () => {
    if (!user?.id) return;
    try {
      const all = await getRoomTemplatesByTutor(user.id);
      if (all.length > 0) {
        setTemplates(mergeShippedDemoTemplateRows(all));
        return;
      }
      console.warn('⚠️ No room templates readable; using the shipped demo template seeds');
      setTemplates(shippedDemoTemplateRows());
    } catch (err) {
      console.error('Error loading templates:', err);
      setTemplates(shippedDemoTemplateRows());
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      loadRooms();
      loadTemplates();
    }
  }, [user, loadRooms, loadTemplates]);

  const handleTemplateSelect = (templateId: string) => {
    if (!templateId) {
      setSelectedTemplateId(null);
      return;
    }
    setSelectedTemplateId(templateId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }
    if (!selectedTemplateId) {
      setError('Pick a behavior demo template (test rooms are template-only).');
      return;
    }

    const selectedTemplate = behaviorTemplates.find((t) => t.id === selectedTemplateId);
    if (!selectedTemplate || !isBehaviorDemoTemplateName(selectedTemplate.template_name)) {
      setError('Only behavior demo templates can create test rooms.');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const roomData = {
        title: selectedTemplate.title_template,
        description: markBehaviorTestDescription(selectedTemplate.description_template || ''),
        tutor_id: user.id,
        image_url: selectedTemplate.image_url || '/images/room-presets/phishing_2.png',
        pre_populated_dialogue: selectedTemplate.pre_populated_dialogue || null,
        op_id: user.id,
        op_display_name: user.display_name,
        op_avatar_url: user.avatar_url,
        password: null as string | null
      };

      const newRoom = await createRoom(roomData);

      const aiTemplate = selectedTemplate.ai_config_template;
      if (aiTemplate?.enabled) {
        const modelName = DEFAULT_AI_MODEL;
        const promptConfig = aiTemplate.prompt_config
          ? {
              role: (aiTemplate.preset === 'casual_peer' ||
              aiTemplate.prompt_config?.role?.role === 'low'
                ? 'peer'
                : 'trusted_adult') as 'peer' | 'trusted_adult',
              scenario: aiTemplate.scenario,
              communication_style: aiTemplate.prompt_config.communication_style,
              cognitive_parameters: aiTemplate.prompt_config.cognitive_parameters,
              emotional_parameters: aiTemplate.prompt_config.emotional_parameters,
              custom_detection_areas: aiTemplate.prompt_config.detection_areas,
              custom_verification_steps: aiTemplate.prompt_config.verification_steps,
              prompt_comparison: aiTemplate.prompt_config.prompt_comparison,
              interaction_mode: aiTemplate.prompt_config.interaction_mode
            }
          : undefined;

        await initializeAIAssistant(
          newRoom.id,
          modelName,
          aiTemplate.system_prompt || undefined,
          user.id,
          promptConfig
        );

        const current = await getAIConfig(newRoom.id);
        await updateAIConfig(
          newRoom.id,
          {
            model_name: DEFAULT_AI_MODEL,
            system_prompt: current?.system_prompt ?? null,
            prompt_config: current?.prompt_config ?? null,
            temperature: aiTemplate.temperature ?? 0.3,
            max_tokens: aiTemplate.max_tokens ?? 100,
            is_active: true
          },
          user.id,
          'test_room_template_create'
        );
      }

      setSuccessMessage('Test room created from the selected AI tutor template');
      setShowCreateForm(false);
      setSelectedTemplateId(null);
      await loadRooms();
      setTimeout(() => navigate(`/room/${newRoom.id}`), 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to create test room');
    } finally {
      setIsCreating(false);
    }
  };

  const confirmDeleteRoom = async () => {
    if (!roomToDelete) return;
    setDeletingRoomId(roomToDelete.id);
    try {
      const result = await deleteRoom(roomToDelete.id, user?.id);
      if (result.success) {
        setSuccessMessage(`Deleted test room "${result.title}"`);
        setShowDeleteConfirm(false);
        setRoomToDelete(null);
        await loadRooms();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete room');
    } finally {
      setDeletingRoomId(null);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">🧪 Test Rooms</h1>
            <p className="dashboard-subtitle">
              Behavior-eval rooms from demo templates only. Hidden from the main Tutor room list.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Link to="/tutor" className="dashboard-profile-link" data-testid="back-to-tutor">
              <span>← Tutor Dashboard</span>
            </Link>
            <Link to="/profile" className="dashboard-profile-link">
              <AvatarDisplay
                avatarUrl={user?.avatar_url}
                displayName={user?.display_name || 'User'}
                size="small"
                className="nav-avatar"
              />
              <span>Profile</span>
            </Link>
          </div>
        </div>

        {successMessage && <div className="success-banner">{successMessage}</div>}
        {error && <div className="error-banner">{error}</div>}

        {!showCreateForm && (
          <button
            className="enhanced-button primary"
            data-testid="create-test-room"
            onClick={() => {
              setShowCreateForm(true);
              setSuccessMessage(null);
              setError(null);
            }}
          >
            ➕ Create a new Room
          </button>
        )}

        {showCreateForm && (
          <div className="form-section">
            <h2 className="form-section-title">Create Test Room From Template</h2>
            <form aria-label="Create test room form" onSubmit={handleSubmit}>
              <div className="form-group template-selection-section">
                <label htmlFor="template-select" className="enhanced-label">
                  Use Template
                </label>
                <select
                  id="template-select"
                  className="enhanced-input"
                  value={selectedTemplateId || ''}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  disabled={isCreating}
                  required
                >
                  <option value="">Select a behavior demo template…</option>
                  {behaviorTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.template_name}
                    </option>
                  ))}
                </select>
                <div className="form-helper-text">
                  Only seeded behavior-demo templates. Creates a tagged test room with AI enabled.
                </div>
              </div>

              <div className="form-row">
                <button
                  type="submit"
                  className={`enhanced-button success ${isCreating ? 'loading' : ''}`}
                  disabled={isCreating || !selectedTemplateId}
                >
                  {isCreating ? 'Creating Room...' : '🚀 Create Room'}
                </button>
                <button
                  type="button"
                  className="enhanced-button secondary"
                  onClick={() => setShowCreateForm(false)}
                  disabled={isCreating}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="form-section">
          <h2 className="form-section-title">🧪 Your Test Rooms</h2>
          {testRooms.length > 0 ? (
            <div className="rooms-grid">
              {testRooms.map((room) => (
                <div key={room.id} className="room-card" data-testid="test-room-item">
                  {room.image_url && (
                    <img src={room.image_url} alt={room.title} className="room-card-image" />
                  )}
                  <div className="room-card-content">
                    <h3 className="room-card-title">{room.title}</h3>
                    {room.description && (
                      <p className="room-card-description">{room.description}</p>
                    )}
                    <div className="room-card-actions">
                      <Link to={`/room/${room.id}`} className="room-card-button">
                        🚪 Enter Room
                      </Link>
                      <button
                        className="enhanced-button danger"
                        onClick={() => {
                          setRoomToDelete(room);
                          setShowDeleteConfirm(true);
                        }}
                        disabled={deletingRoomId === room.id}
                      >
                        {deletingRoomId === room.id ? 'Deleting...' : '🗑️ Delete Room'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rooms-empty-state">
              <div className="rooms-empty-state-icon">🧪</div>
              <h3 className="rooms-empty-state-title">No test rooms yet</h3>
              <p className="rooms-empty-state-description">
                Create one from a behavior demo template to run AI tutor checks.
              </p>
            </div>
          )}
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        room={roomToDelete}
        onConfirm={confirmDeleteRoom}
        onCancel={() => {
          if (!deletingRoomId) {
            setShowDeleteConfirm(false);
            setRoomToDelete(null);
          }
        }}
        isDeleting={Boolean(deletingRoomId)}
      />
    </div>
  );
};

export default TestRoomsView;
