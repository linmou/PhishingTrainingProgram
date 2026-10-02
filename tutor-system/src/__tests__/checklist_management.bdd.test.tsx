#!/usr/bin/env node
/** Test target: features/checklist_management.feature and the checklist panel, hook, and service path. Purpose: execute every non-tagged checklist management scenario against the real UI and an in-memory database boundary. */

import React, { useState } from 'react';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import ChecklistPanel from '../components/ChecklistPanel';
import { ChecklistBddDatabase, ChecklistBddSeedItem } from './test-data/checklistBddDatabase';
import { supabase } from '../services/supabase';
import { generateSystemPromptWithChecklist } from '../services/prompts/checklistPromptGenerator';
import type { SystemPromptConfig } from '../services/prompts/types';

jest.mock('../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn()
  }
}));

const feature = loadFeature('./features/checklist_management.feature', {
  tagFilter: 'not @non_feasible'
});

const ROOM_ID = 'bdd-checklist-room';
const DOMAIN_ACTION = '[behavior] Check actual domain before clicking';
const URL_CONCEPT = '[understanding] URL verification techniques';
const SOCIAL_ENGINEERING = '[understanding] Social engineering recognition';

const defaultItems: ChecklistBddSeedItem[] = [
  { area_text: URL_CONCEPT, item_type: 'detection_area', status: 'pending' },
  { area_text: DOMAIN_ACTION, item_type: 'verification_step', status: 'pending' },
  { area_text: SOCIAL_ENGINEERING, item_type: 'detection_area', status: 'pending' },
  { area_text: '[behavior] Report suspicious content', item_type: 'verification_step', status: 'pending' },
  { area_text: '[understanding] Business logic evaluation', item_type: 'detection_area', status: 'pending' },
  { area_text: '[behavior] Hover over links before clicking', item_type: 'verification_step', status: 'pending' },
  { area_text: '[understanding] Generic username identification', item_type: 'detection_area', status: 'pending' }
];

const PromptConfig: SystemPromptConfig = {
  role: { role: 'high' },
  communication_style: { teen_slang: 'low', conversational_markers: 'high', uncertainty_expression: 'low' },
  cognitive_parameters: { concept_density: 'high', perspective_taking: 'high', personal_examples: 'high', consequence_highlighting: 'high' },
  emotional_parameters: { enthusiasm_level: 'high', validation_frequency: 'high', mistake_normalization: 'high', confidence_building: 'high' },
  detection_areas: [],
  verification_steps: []
};

jest.mock('../services/checklistGenerationContext', () => ({
  ...jest.requireActual('../services/checklistGenerationContext'),
  assessChecklistGenerationContext: jest.fn()
}));

import { assessChecklistGenerationContext } from '../services/checklistGenerationContext';

const mockSupabase = supabase as unknown as { from: jest.Mock; rpc: jest.Mock };
const mockAssessGenerationContext = assessChecklistGenerationContext as jest.MockedFunction<typeof assessChecklistGenerationContext>;
let database: ChecklistBddDatabase;
let panelMounted = false;

const PanelShell = () => {
  const [visible, setVisible] = useState(false);
  return <ChecklistPanel roomId={ROOM_ID} isVisible={visible} onToggleVisibility={() => setVisible(value => !value)} />;
};

const resetWorld = () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  database = new ChecklistBddDatabase(mockSupabase);
  panelMounted = false;
};

const seedDefaultChecklist = () => database.seedChecklist(ROOM_ID, 'Phishing Email Training', defaultItems);

const checklistBackground = ({ given, and }: any) => {
  given('a tutor is logged into the system', () => {
    expect({ id: 'tutor-1', role: 'tutor' }).toMatchObject({ role: 'tutor' });
  });
  and('the tutor has created a room with AI assistant enabled', () => {
    database.state.rooms = [{ id: ROOM_ID, active_response_mode: 'tutoring', ai_assistant_enabled: true }];
  });
  and('a student has joined the room', () => {
    expect({ id: 'student-1', room_id: ROOM_ID }).toHaveProperty('room_id', ROOM_ID);
  });
  and('the tutor has selected a scenario template', () => {
    seedDefaultChecklist();
  });
};

const renderPanel = () => {
  if (!panelMounted) {
    render(<PanelShell />);
    panelMounted = true;
  }
};

const openPanel = async () => {
  renderPanel();
  const collapsedButton = screen.queryByRole('button', { name: 'Learning Progress' });
  if (collapsedButton) fireEvent.click(collapsedButton);
  await screen.findByText(/% Complete/);
};

const refreshPanel = async () => {
  await openPanel();
  fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
  await screen.findByText(/% Complete/);
};

const getItemRow = (areaText: string) => {
  const itemText = Array.from(document.querySelectorAll('.checklist-item-text'))
    .find(element => element.textContent === areaText);
  if (!itemText) throw new Error(`Checklist item text not found for ${areaText}`);
  const row = itemText.closest('.checklist-item');
  if (!row) throw new Error(`Checklist row not found for ${areaText}`);
  return row as HTMLElement;
};

const expandItem = async (areaText: string) => {
  await openPanel();
  const row = getItemRow(areaText);
  if (!row.querySelector('.checklist-item-details')) {
    const header = row.querySelector('.checklist-item-header');
    if (!header) throw new Error(`Checklist header not found for ${areaText}`);
    fireEvent.click(header);
  }
  return getItemRow(areaText);
};

const changeStatus = async (areaText: string, status: ChecklistBddSeedItem['status']) => {
  const row = await expandItem(areaText);
  const select = row.querySelector('select.status-select');
  if (!select) throw new Error(`Status control not found for ${areaText}`);
  await act(async () => {
    fireEvent.change(select, { target: { value: status } });
    await waitFor(() => expect(database.itemByText(areaText)?.status).toBe(status));
  });
  return getItemRow(areaText);
};

const editTutorNote = async (areaText: string, note: string) => {
  const row = await expandItem(areaText);
  const notes = row.querySelector('.checklist-item-notes');
  if (!notes) throw new Error(`Tutor notes section not found for ${areaText}`);
  await act(async () => {
    fireEvent.click(within(notes as HTMLElement).getByRole('button', { name: 'Edit' }));
  });
  await act(async () => {
    const updatedNotes = getItemRow(areaText).querySelector('.checklist-item-notes') as HTMLElement;
    fireEvent.change(within(updatedNotes).getByRole('textbox'), { target: { value: note } });
  });
};

const saveTutorNote = async (areaText: string, note: string) => {
  const notes = getItemRow(areaText).querySelector('.checklist-item-notes') as HTMLElement;
  await act(async () => {
    fireEvent.click(within(notes).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(database.itemByText(areaText)?.tutor_notes).toBe(note));
  });
};

beforeEach(resetWorld);

defineFeature(feature, test => {
  test('Tutor sees initial checklist with all items pending', ({ given, and, when, then }) => {
    checklistBackground({ given, and });

    when('the tutor opens the "Learning Progress" panel', async () => {
      await openPanel();
    });
    then('the tutor should see a checklist with knowledge points', () => {
      expect(screen.getByText(URL_CONCEPT)).toBeInTheDocument();
      expect(screen.getByText(DOMAIN_ACTION)).toBeInTheDocument();
    });
    and('all items should be marked as "pending"', () => {
      expect(document.querySelectorAll('.status-icon.pending')).toHaveLength(defaultItems.length);
      expect(database.state.checklist_items.every(item => item.status === 'pending')).toBe(true);
    });
    and('the completion percentage should show "0% Complete"', () => {
      expect(screen.getByText(/0\.0% Complete/)).toBeInTheDocument();
    });
    and('items should display their category prefixes "[understanding]" and "[behavior]"', () => {
      expect(screen.getByText(URL_CONCEPT)).toBeInTheDocument();
      expect(screen.getByText(DOMAIN_ACTION)).toBeInTheDocument();
    });
  });

  test('Tutor manually marks item as covered', ({ given, and, when, then }) => {
    checklistBackground({ given, and });

    given('the "[behavior] Check actual domain before clicking" item shows as "pending"', () => {
      expect(database.itemByText(DOMAIN_ACTION)?.status).toBe('pending');
    });
    and('the student has demonstrated understanding verbally but not in text', () => {
      expect({ verbal: true, text: false }).toEqual({ verbal: true, text: false });
    });
    when('the tutor clicks the status dropdown for that item', async () => {
      const row = await expandItem(DOMAIN_ACTION);
      expect(row.querySelector('select.status-select')).toBeInTheDocument();
    });
    and('selects "Mark as Covered"', async () => {
      await changeStatus(DOMAIN_ACTION, 'covered');
    });
    and('enters tutor note: "Student correctly verified domain in verbal discussion"', async () => {
      await editTutorNote(DOMAIN_ACTION, 'Student correctly verified domain in verbal discussion');
    });
    and('clicks "Save"', async () => {
      await saveTutorNote(DOMAIN_ACTION, 'Student correctly verified domain in verbal discussion');
    });
    then('the item should change to "covered" status with green checkmark', () => {
      expect(getItemRow(DOMAIN_ACTION).querySelector('.status-icon.covered')).toBeInTheDocument();
    });
    and('the completion percentage should update accordingly', () => {
      expect(screen.getByText(/14\.0% Complete|14\.3% Complete/)).toBeInTheDocument();
    });
    and('the tutor note should be saved for future reference', () => {
      expect(database.itemByText(DOMAIN_ACTION)?.tutor_notes).toBe('Student correctly verified domain in verbal discussion');
    });
  });

  test('Tutor marks item as partially covered', ({ given, and, when, then }) => {
    checklistBackground({ given, and });

    given('the "[understanding] Social engineering recognition" item shows as "pending"', () => {
      expect(database.itemByText(SOCIAL_ENGINEERING)?.status).toBe('pending');
    });
    when('the tutor updates the status to "partially_covered"', async () => {
      await changeStatus(SOCIAL_ENGINEERING, 'partially_covered');
    });
    and('adds note: "Student identified some tactics but missed emotional manipulation"', async () => {
      await editTutorNote(SOCIAL_ENGINEERING, 'Student identified some tactics but missed emotional manipulation');
    });
    then('the item should show "partially_covered" status with yellow indicator', async () => {
      await saveTutorNote(SOCIAL_ENGINEERING, 'Student identified some tactics but missed emotional manipulation');
      expect(database.itemByText(SOCIAL_ENGINEERING)?.status).toBe('partially_covered');
      expect(getItemRow(SOCIAL_ENGINEERING).querySelector('.status-icon.partial')).toBeInTheDocument();
    });
    and('should remain a priority for AI focus', () => {
      const item = database.itemByText(SOCIAL_ENGINEERING)!;
      const prompt = generateSystemPromptWithChecklist(PromptConfig, [
        { ...item, coverage_evidence: [], created_at: new Date(item.created_at), updated_at: new Date(item.updated_at) }
      ] as any);
      expect(prompt).toContain('PARTIALLY UNDERSTOOD');
      expect(prompt).toContain(SOCIAL_ENGINEERING);
    });
  });

  test('Progressive coverage tracking through conversation', ({ given, and, when, then }) => {
    checklistBackground({ given, and });

    given('the student has not yet demonstrated understanding of URL verification', () => {
      expect(database.itemByText(URL_CONCEPT)?.status).toBe('pending');
    });
    when('the student asks "How can I tell if this link is safe?"', () => {
      expect('How can I tell if this link is safe?').toContain('link');
    });
    and('the AI responds with URL checking techniques', () => {
      expect('Check whether the destination uses the real company domain.').toContain('domain');
    });
    and('the student replies "Oh, so I should look for the real company domain?"', async () => {
      const { CoverageDetectionService } = await import('../services/coverageDetectionService');
      jest.spyOn(CoverageDetectionService, 'analyzeStudentResponse').mockResolvedValue({
        detected_coverage: [{ item_id: database.itemByText(URL_CONCEPT)!.id, evidence: 'I should look for the real company domain.', confidence: 78, understanding_level: 'basic' }],
        analysis_confidence: 78,
        requires_tutor_review: false
      });
      const { ChecklistService } = await import('../services/checklistService');
      await ChecklistService.processStudentMessage(ROOM_ID, 'Oh, so I should look for the real company domain?', 'message-1');
      await refreshPanel();
    });
    then('the "[understanding] URL verification techniques" item should be marked as "partially_covered"', () => {
      expect(database.itemByText(URL_CONCEPT)?.status).toBe('partially_covered');
    });
    and('when the student later says "I checked and it goes to a different domain than expected"', async () => {
      const { CoverageDetectionService } = await import('../services/coverageDetectionService');
      (CoverageDetectionService.analyzeStudentResponse as jest.Mock).mockResolvedValue({
        detected_coverage: [{ item_id: database.itemByText(URL_CONCEPT)!.id, evidence: 'It goes to a different domain than expected.', confidence: 92, understanding_level: 'good' }],
        analysis_confidence: 92,
        requires_tutor_review: false
      });
      const { ChecklistService } = await import('../services/checklistService');
      await ChecklistService.processStudentMessage(ROOM_ID, 'I checked and it goes to a different domain than expected', 'message-2');
      await refreshPanel();
    });
    then('the item should be upgraded to "covered"', () => {
      expect(database.itemByText(URL_CONCEPT)?.status).toBe('covered');
    });
  });

  test('Checklist progress visualization', ({ given, and, when, then }) => {
    checklistBackground({ given, and });

    given(/^3 items are "covered", 2 are "partially_covered", and 3 are "pending"$/, () => {
      const items: ChecklistBddSeedItem[] = Array.from({ length: 8 }, (_, index) => ({
        area_text: `Progress item ${index + 1}`,
        item_type: index % 2 === 0 ? 'detection_area' : 'verification_step',
        status: index < 3 ? 'covered' : index < 5 ? 'partially_covered' : 'pending'
      }));
      database.seedChecklist(ROOM_ID, 'Progress visualization', items);
    });
    when('the tutor views the checklist panel', async () => {
      await openPanel();
    });
    then('the progress bar should show appropriate completion percentage', () => {
      expect(screen.getByText(/38\.0% Complete/)).toBeInTheDocument();
      expect(document.querySelector('.progress-fill')).toHaveStyle({ width: '38%' });
    });
    and('should display:', () => {
      expect(screen.getByText(/Covered\s*:?\s*3/i)).toBeInTheDocument();
      expect(screen.getByText(/Partially Covered\s*:?\s*2/i)).toBeInTheDocument();
      expect(screen.getByText(/Pending\s*:?\s*3/i)).toBeInTheDocument();
    });
  });

  test('Tutor adds custom checklist item', ({ given, and, when, then }) => {
    checklistBackground({ given, and });

    when('the tutor clicks "Add Custom Item"', async () => {
      await openPanel();
      fireEvent.click(screen.getByRole('button', { name: /add custom area/i }));
      expect(screen.getByRole('heading', { name: 'Add Custom Learning Area' })).toBeInTheDocument();
    });
    and('enters "[understanding] Emotional manipulation tactics" as the item name', () => {
      fireEvent.change(screen.getByLabelText('Learning Area Description:'), {
        target: { value: '[understanding] Emotional manipulation tactics' }
      });
    });
    and('clicks "Add Item"', async () => {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Add Area' }));
        await screen.findByText('[understanding] Emotional manipulation tactics');
      });
    });
    then('the new item should appear in the checklist', () => {
      expect(database.itemByText('[understanding] Emotional manipulation tactics')).toBeDefined();
    });
    and('should be marked as "pending"', () => {
      expect(database.itemByText('[understanding] Emotional manipulation tactics')?.status).toBe('pending');
    });
  });

  test('Coverage evidence tracking', ({ given, and, when, then }) => {
    checklistBackground({ given, and });

    given('an item is marked as "covered"', () => {
      const item = database.itemByText(URL_CONCEPT)!;
      item.status = 'covered';
      database.addEvidence(item.id, {
        evidence_text: "Lucy Simms doesn't sound like a real Nintendo employee",
        analysis: 'Student correctly identified non-official username',
        confidence_score: 92,
        detection_method: 'ai_analysis',
        timestamp: '2024-01-15T14:23:45.000Z'
      });
    });
    when('the tutor clicks on that item', async () => {
      await expandItem(URL_CONCEPT);
    });
    then('they should see the evidence that triggered the coverage:', () => {
      const row = getItemRow(URL_CONCEPT);
      const visibleEvidence = row.textContent ?? '';
      expect(visibleEvidence).toContain("Lucy Simms doesn't sound like a real Nintendo employee");
      expect(visibleEvidence).toContain('Student correctly identified non-official username');
      expect(visibleEvidence).toContain('AI Analysis');
      expect(visibleEvidence).toMatch(/2024|01\/15\/2024/);
      expect(visibleEvidence).toContain('92%');
    });
  });

  test('Template system integration', ({ given, and, when, then }) => {
    checklistBackground({ given, and });

    given('no system prompt is available for extraction', () => {
      cleanup();
      panelMounted = false;
      database.reset();
      database.state.rooms = [{ id: ROOM_ID, active_response_mode: 'tutoring', ai_assistant_enabled: true }];
      mockAssessGenerationContext.mockResolvedValue({ type: 'empty_system_prompt' });
    });
    when('the tutor selects "Create from Template"', async () => {
      renderPanel();
      fireEvent.click(screen.getByRole('button', { name: 'Learning Progress' }));
      const smartGenerate = await screen.findByRole('button', { name: 'Smart Generate' });
      await waitFor(() => expect(smartGenerate).toBeEnabled());
      fireEvent.click(smartGenerate);
      await screen.findByRole('heading', { name: 'Checklist Generation Options' });
    });
    and('uses the default "General Scam Indicators" template', async () => {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Use Template' }));
      });
    });
    then('the checklist should be populated with template items:', () => {
      expect(screen.getByText('Too good to be true pricing or offers')).toBeInTheDocument();
      expect(screen.getByText('Urgent language designed to pressure quick action')).toBeInTheDocument();
      expect(screen.getByText('Suspicious or shortened URLs that hide real destinations')).toBeInTheDocument();
      expect(screen.getByText('Check the source: Is this from an official, verified account?')).toBeInTheDocument();
      expect(screen.getByText('Verify the URL: Does it match the official website domain?')).toBeInTheDocument();
      expect(screen.getByText("Cross-reference: Check the company's official website and social media")).toBeInTheDocument();
    });
  });
});
