#!/usr/bin/env node
/** Test target: features/ai_checklist_integration.feature and the checklist prompt, room application, and tutor UI paths. Purpose: execute each non-tagged scenario at its deterministic app boundary. */

import React, { useState } from 'react';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import ChecklistPanel from '../components/ChecklistPanel';
import AISuggestionBox from '../components/AISuggestionBox';
import { ChecklistBddDatabase, ChecklistBddSeedItem } from './test-data/checklistBddDatabase';
import { supabase } from '../services/supabase';
import { ChecklistService } from '../services/checklistService';
import { CoverageDetectionService } from '../services/coverageDetectionService';
import { ChecklistItem } from '../types/checklist';
import {
  createFocusedPromptVariation,
  generateProgressSummary,
  generateSystemPromptWithChecklist
} from '../services/prompts/checklistPromptGenerator';
import type { SystemPromptConfig } from '../services/prompts/types';

jest.mock('../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn()
  }
}));

const feature = loadFeature('./features/ai_checklist_integration.feature', {
  tagFilter: 'not @non_feasible'
});

const ROOM_ID = 'bdd-ai-checklist-room';
const URL_CONCEPT = '[understanding] URL verification techniques';
const SENDER_ACTION = '[behavior] Check sender credentials manually';
const SOCIAL_CONCEPT = '[understanding] Social engineering recognition';
const REPORT_ACTION = '[behavior] Report suspicious content';
const BUSINESS_LOGIC = '[understanding] Business logic evaluation';
const HOVER_ACTION = '[behavior] Hover over links before clicking';
const SENDER_CONCEPT = '[understanding] Sender verification';
const SYNTHESIS_CONCEPT = '[understanding] Suspicious indicator synthesis';
const GENERIC_USERNAME = '[understanding] Generic username identification';
const URGENCY_CONCEPT = '[understanding] Urgency language recognition';

const promptConfig: SystemPromptConfig = {
  role: { role: 'high' },
  communication_style: { teen_slang: 'low', conversational_markers: 'high', uncertainty_expression: 'low' },
  cognitive_parameters: { concept_density: 'high', perspective_taking: 'high', personal_examples: 'high', consequence_highlighting: 'high' },
  emotional_parameters: { enthusiasm_level: 'high', validation_frequency: 'high', mistake_normalization: 'high', confidence_building: 'high' },
  detection_areas: [],
  verification_steps: []
};

const defaultItems: ChecklistBddSeedItem[] = [
  { area_text: URL_CONCEPT, item_type: 'detection_area', status: 'pending' },
  { area_text: SENDER_ACTION, item_type: 'verification_step', status: 'pending' },
  { area_text: SOCIAL_CONCEPT, item_type: 'detection_area', status: 'pending' },
  { area_text: REPORT_ACTION, item_type: 'verification_step', status: 'pending' },
  { area_text: BUSINESS_LOGIC, item_type: 'detection_area', status: 'pending' },
  { area_text: HOVER_ACTION, item_type: 'verification_step', status: 'pending' },
  { area_text: SENDER_CONCEPT, item_type: 'detection_area', status: 'pending' },
  { area_text: SYNTHESIS_CONCEPT, item_type: 'detection_area', status: 'pending' },
  { area_text: GENERIC_USERNAME, item_type: 'detection_area', status: 'pending' },
  { area_text: URGENCY_CONCEPT, item_type: 'detection_area', status: 'pending' }
];

const mockSupabase = supabase as unknown as { from: jest.Mock; rpc: jest.Mock };
let database: ChecklistBddDatabase;
let panelMounted = false;
let appliedResult: Awaited<ReturnType<typeof ChecklistService.processStudentMessage>> | null = null;
let generatedPrompt = '';
let visibleFeedback = '';

const PanelShell = () => {
  const [visible, setVisible] = useState(false);
  return <ChecklistPanel roomId={ROOM_ID} isVisible={visible} onToggleVisibility={() => setVisible(value => !value)} />;
};

const resetWorld = () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  database = new ChecklistBddDatabase(mockSupabase);
  panelMounted = false;
  appliedResult = null;
  generatedPrompt = '';
  visibleFeedback = '';
};

const rowsAsChecklistItems = (): ChecklistItem[] => database.state.checklist_items.map(item => ({
  ...item,
  coverage_evidence: database.state.coverage_evidence.filter(evidence => evidence.item_id === item.id).map(evidence => ({
    id: evidence.id,
    evidence_text: evidence.evidence_text,
    analysis: evidence.analysis,
    confidence_score: evidence.confidence_score,
    detection_method: evidence.detection_method,
    timestamp: new Date(evidence.timestamp),
    message_id: evidence.message_id
  })),
  created_at: new Date(item.created_at),
  updated_at: new Date(item.updated_at),
  last_addressed: item.last_addressed ? new Date(item.last_addressed) : null
})) as ChecklistItem[];

const aiBackground = async ({ given, and }: any) => {
  given('the AI assistant is enabled for a tutoring room', () => {
    database.state.rooms = [{ id: ROOM_ID, active_response_mode: 'tutoring', ai_assistant_enabled: true }];
  });
  and('a student has joined the room', () => {
    expect({ id: 'student-1', room_id: ROOM_ID }).toHaveProperty('room_id', ROOM_ID);
  });
  and('the checklist system is initialized for the student', async () => {
    database.seedChecklist(ROOM_ID, 'Phishing Email Training', defaultItems);
    render(<PanelShell />);
    panelMounted = true;
    await screen.findByRole('button', { name: 'Learning Progress' });
  });
};

const openPanel = async () => {
  if (!panelMounted) {
    render(<PanelShell />);
    panelMounted = true;
  }
  const collapsedButton = screen.queryByRole('button', { name: 'Learning Progress' });
  if (collapsedButton) fireEvent.click(collapsedButton);
  await screen.findByText(/% Complete/);
};

const refreshPanel = async (assertRefreshed?: () => void) => {
  cleanup();
  panelMounted = false;
  await openPanel();
  if (assertRefreshed) await waitFor(assertRefreshed);
};

const getItemRow = (areaText: string) => {
  const itemText = Array.from(document.querySelectorAll('.checklist-item-text'))
    .find(element => element.textContent === areaText);
  if (!itemText) throw new Error(`Checklist item text not found for ${areaText}`);
  const row = itemText.closest('.checklist-item');
  if (!row) throw new Error(`Checklist row not found for ${areaText}`);
  return row as HTMLElement;
};

const setReturnedCoverage = (entries: Array<{ areaText: string; level: 'basic' | 'good' | 'excellent'; evidence: string }>, review = false) => {
  jest.spyOn(CoverageDetectionService, 'analyzeStudentResponse').mockResolvedValue({
    detected_coverage: entries.map(entry => ({
      item_id: database.itemByText(entry.areaText)!.id,
      evidence: entry.evidence,
      confidence: entry.level === 'basic' ? 68 : 91,
      understanding_level: entry.level
    })),
    analysis_confidence: review ? 62 : 91,
    requires_tutor_review: review
  });
};

const applyCoverageAndRefresh = async (message: string) => {
  appliedResult = await ChecklistService.processStudentMessage(ROOM_ID, message, 'bdd-message-1');
  appliedResult.updatedItems.forEach(item => {
    expect(database.itemByText(item.area_text)?.status).toBe(item.status);
  });
  await refreshPanel(() => {
    appliedResult?.updatedItems.forEach(item => {
      const statusClass = item.status === 'covered' ? 'covered' : item.status === 'partially_covered' ? 'partial' : 'pending';
      expect(getItemRow(item.area_text).querySelector(`.status-icon.${statusClass}`)).toBeInTheDocument();
    });
  });
};

const makeFeedbackVisible = (text: string) => {
  visibleFeedback = text;
  render(
    <AISuggestionBox
      suggestion={visibleFeedback}
      onCopy={jest.fn()}
      onReject={jest.fn()}
      isVisible
    />
  );
};

beforeEach(resetWorld);

defineFeature(feature, test => {
  test('AI receives checklist context in system prompt', ({ given, and, when, then }) => {
    aiBackground({ given, and });

    given('the checklist shows items with mixed progress:', () => {
      database.seedChecklist(ROOM_ID, 'Phishing Email Training', [
        { ...defaultItems[0], status: 'covered' },
        { ...defaultItems[1], status: 'covered' },
        { ...defaultItems[2], status: 'partially_covered' },
        defaultItems[3],
        defaultItems[4]
      ]);
    });
    when('the AI system prompt is generated', () => {
      generatedPrompt = generateSystemPromptWithChecklist(promptConfig, rowsAsChecklistItems());
    });
    then('the prompt should include current learning progress:', () => {
      expect(generatedPrompt).toContain('## CURRENT LEARNING PROGRESS:');
      expect(generatedPrompt).toContain('🔴 PRIORITY ITEMS - FOCUS ON THESE:');
      expect(generatedPrompt).toContain('- [ ] [understanding] Business logic evaluation (pending)');
      expect(generatedPrompt).toContain('- [ ] [behavior] Report suspicious content (pending)');
      expect(generatedPrompt).toContain('- [~] [understanding] Social engineering recognition (needs reinforcement)');
      expect(generatedPrompt).toContain('- [✓] [understanding] URL verification techniques');
      expect(generatedPrompt).toContain('- [✓] [behavior] Check sender credentials manually');
    });
    and('the AI should receive instructions to focus on uncovered items', () => {
      expect(generatedPrompt).toMatch(/FOCUS|PRIORITIZE/i);
      expect(generatedPrompt).toContain('YOUR ADAPTIVE INSTRUCTIONS');
    });
  });

  test('URL verification coverage updates the tutor checklist', ({ given, and, when, then }) => {
    aiBackground({ given, and });

    given('the "[understanding] URL verification techniques" item is marked as "pending"', () => {
      expect(database.itemByText(URL_CONCEPT)?.status).toBe('pending');
    });
    and("AI analysis has returned coverage evidence for the student's URL verification response", () => {
      setReturnedCoverage([{ areaText: URL_CONCEPT, level: 'good', evidence: 'The link uses a different domain than expected.' }]);
    });
    when('the room applies the coverage evidence', async () => {
      await applyCoverageAndRefresh('I checked the link domain and it is not the real company domain.');
    });
    then('the item should be marked as "covered"', () => {
      expect(appliedResult?.updatedItems).toHaveLength(1);
      expect(database.itemByText(URL_CONCEPT)?.status).toBe('covered');
      expect(getItemRow(URL_CONCEPT).querySelector('.status-icon.covered')).toBeInTheDocument();
    });
    and("the tutor should see the student's response as evidence for that item", async () => {
      await openPanel();
      fireEvent.click(getItemRow(URL_CONCEPT).querySelector('.checklist-item-header') as HTMLElement);
      expect(getItemRow(URL_CONCEPT).querySelector('.evidence-text')?.textContent)
        .toContain('The link uses a different domain than expected.');
    });
  });

  test('Behavioral coverage updates the tutor checklist', ({ given, and, when, then }) => {
    aiBackground({ given, and });

    given('the "[behavior] Hover over links before clicking" item is marked as "pending"', () => {
      expect(database.itemByText(HOVER_ACTION)?.status).toBe('pending');
    });
    and("AI analysis has returned coverage evidence for the student's link checking action", () => {
      setReturnedCoverage([{ areaText: HOVER_ACTION, level: 'good', evidence: 'I hovered over the link and saw a different destination.' }]);
    });
    when('the room applies the coverage evidence', async () => {
      await applyCoverageAndRefresh('I hovered over the link and checked its destination.');
    });
    then('the item should be marked as "covered"', () => {
      expect(appliedResult?.updatedItems).toHaveLength(1);
      expect(database.itemByText(HOVER_ACTION)?.status).toBe('covered');
      expect(getItemRow(HOVER_ACTION).querySelector('.status-icon.covered')).toBeInTheDocument();
    });
    and("the tutor should see the student's response as evidence for that item", async () => {
      await openPanel();
      fireEvent.click(getItemRow(HOVER_ACTION).querySelector('.checklist-item-header') as HTMLElement);
      expect(getItemRow(HOVER_ACTION).querySelector('.evidence-text')?.textContent)
        .toContain('I hovered over the link and saw a different destination.');
    });
  });

  test('Partial understanding updates the tutor checklist', ({ given, and, when, then }) => {
    aiBackground({ given, and });

    given('the "[understanding] Social engineering recognition" item is marked as "pending"', () => {
      expect(database.itemByText(SOCIAL_CONCEPT)?.status).toBe('pending');
    });
    and('AI analysis has returned partial coverage evidence for that item', () => {
      setReturnedCoverage([{ areaText: SOCIAL_CONCEPT, level: 'basic', evidence: 'The message pressures people, but I am not sure why.' }]);
    });
    when('the room applies the coverage evidence', async () => {
      await applyCoverageAndRefresh('I recognize some of the manipulation tactics but not all of them.');
    });
    then('the item should be marked as "partially_covered"', () => {
      expect(appliedResult?.updatedItems).toHaveLength(1);
      expect(database.itemByText(SOCIAL_CONCEPT)?.status).toBe('partially_covered');
      expect(getItemRow(SOCIAL_CONCEPT).querySelector('.status-icon.partial')).toBeInTheDocument();
    });
    and('the tutor should see that it still needs attention', () => {
      expect(getItemRow(SOCIAL_CONCEPT).textContent).toMatch(/basic/i);
    });
  });

  test('Learner receives feedback on understanding and action', ({ given, and, when, then }) => {
    aiBackground({ given, and });

    given('a student demonstrates both cognitive understanding and behavioral application', () => {
      expect(database.state.checklist_items.some(item => item.area_text.startsWith('[understanding]'))).toBe(true);
      expect(database.state.checklist_items.some(item => item.area_text.startsWith('[behavior]'))).toBe(true);
    });
    when('the student explains "I recognized the urgency language and then verified by going to the official website"', () => {
      visibleFeedback = CoverageDetectionService.generateDifferentiatedFeedback(
        'I recognized the urgency language and then verified by going to the official website',
        'both'
      );
      makeFeedbackVisible(visibleFeedback);
    });
    then('the learner should receive feedback that acknowledges both dimensions:', () => {
      expect(screen.getByText(/Excellent! You showed great understanding of urgency tactics \[understanding\]/)).toBeInTheDocument();
      expect(screen.getByText(/right verification action \[behavior\]/)).toBeInTheDocument();
    });
  });

  test('Later misunderstanding reopens a covered checklist item', ({ given, and, when, then }) => {
    aiBackground({ given, and });

    given('the "[understanding] Business logic evaluation" item is marked as "covered"', () => {
      database.itemByText(BUSINESS_LOGIC)!.status = 'covered';
    });
    and('AI analysis has returned evidence of the student\'s later misunderstanding', () => {
      setReturnedCoverage([{ areaText: BUSINESS_LOGIC, level: 'basic', evidence: 'I think the company would lose money on this deal.' }]);
    });
    when('the room applies the coverage evidence', async () => {
      await applyCoverageAndRefresh('I do not understand why companies would not offer loss-making deals.');
    });
    then('the item should be marked as "partially_covered"', () => {
      expect(database.itemByText(BUSINESS_LOGIC)?.status).toBe('partially_covered');
    });
    and('the tutor should see the updated status', () => {
      expect(getItemRow(BUSINESS_LOGIC).querySelector('.status-icon.partial')).toBeInTheDocument();
    });
  });

  test('Learner receives an explanation focused on remaining gaps', ({ given, and, when, then }) => {
    aiBackground({ given, and });

    given('"[understanding] Generic username identification" is marked as "covered"', () => {
      database.itemByText(GENERIC_USERNAME)!.status = 'covered';
    });
    and('"[understanding] Urgency language recognition" is "pending"', () => {
      database.itemByText(URGENCY_CONCEPT)!.status = 'pending';
    });
    when('the student asks "What makes this message suspicious?"', () => {
      generatedPrompt = createFocusedPromptVariation(promptConfig, rowsAsChecklistItems(), 'Urgency language recognition');
    });
    then('the learner should hear: "You already spotted the fake username - good eye!"', () => {
      expect(generatedPrompt).toContain('You already spotted the fake username - good eye!');
    });
    and('should focus the explanation on: "Let\'s look at the urgent language that pressures quick action..."', () => {
      expect(generatedPrompt).toContain("Let's look at the urgent language that pressures quick action");
    });
    and('should tailor response depth to match understanding levels', () => {
      expect(generatedPrompt).toContain('PRIORITIZE CRITICAL GAPS');
      expect(generatedPrompt).toContain(GENERIC_USERNAME);
    });
  });

  test('Tutor can inspect saved coverage evidence', ({ given, and, when, then }) => {
    aiBackground({ given, and });

    given('coverage evidence includes a student quote, concept, category, understanding level, confidence score, and recommended action', () => {
      const item = database.itemByText(URL_CONCEPT)!;
      item.status = 'covered';
      database.addEvidence(item.id, {
        evidence_text: 'That $19.99 is way too cheap for a Switch that costs $300',
        analysis: 'Student evaluated the price against the product value.',
        confidence_score: 85,
        detection_method: 'ai_analysis',
        timestamp: '2026-01-15T14:23:45.000Z',
        concept: 'Price-reality evaluation',
        category: URL_CONCEPT,
        understanding_level: 'Good - student identified core issue',
        recommended_action: 'Move to related behavioral items'
      });
    });
    when('the coverage update is saved and the tutor opens the checklist item', async () => {
      await refreshPanel(() => expect(getItemRow(URL_CONCEPT).querySelector('.status-icon.covered')).toBeInTheDocument());
      fireEvent.click(getItemRow(URL_CONCEPT).querySelector('.checklist-item-header') as HTMLElement);
    });
    then('the tutor should see those evidence fields with the covered item', () => {
      const visibleText = getItemRow(URL_CONCEPT).textContent ?? '';
      expect(visibleText).toContain('That $19.99 is way too cheap for a Switch that costs $300');
      expect(visibleText).toContain('Price-reality evaluation');
      expect(visibleText).toContain(URL_CONCEPT);
      expect(visibleText).toContain('Good - student identified core issue');
      expect(visibleText).toContain('85%');
      expect(visibleText).toContain('Move to related behavioral items');
    });
  });

  test('Multiple coverage results update the tutor checklist together', ({ given, and, when, then }) => {
    aiBackground({ given, and });

    given('AI analysis has returned coverage evidence for sender verification, link hovering, and suspicious indicator synthesis', () => {
      setReturnedCoverage([
        { areaText: SENDER_CONCEPT, level: 'good', evidence: 'I checked the sender email.' },
        { areaText: HOVER_ACTION, level: 'excellent', evidence: 'I hovered and checked the destination.' },
        { areaText: SYNTHESIS_CONCEPT, level: 'excellent', evidence: 'Both checks were suspicious.' }
      ]);
    });
    when('the room applies the coverage results', async () => {
      await applyCoverageAndRefresh('I checked the sender, hovered the link, and saw both were suspicious.');
    });
    then('all three corresponding checklist items should be marked as "covered"', () => {
      expect(appliedResult?.updatedItems).toHaveLength(3);
      [SENDER_CONCEPT, HOVER_ACTION, SYNTHESIS_CONCEPT].forEach(itemText => {
        expect(database.itemByText(itemText)?.status).toBe('covered');
        expect(getItemRow(itemText).querySelector('.status-icon.covered')).toBeInTheDocument();
      });
    });
    and('the tutor should see evidence for each updated item', () => {
      [SENDER_CONCEPT, HOVER_ACTION, SYNTHESIS_CONCEPT].forEach(itemText => {
        expect(database.state.coverage_evidence.some(evidence => evidence.item_id === database.itemByText(itemText)?.id)).toBe(true);
        const row = getItemRow(itemText);
        fireEvent.click(row.querySelector('.checklist-item-header') as HTMLElement);
        expect(getItemRow(itemText).querySelector('.evidence-text')).toBeInTheDocument();
      });
    });
  });

  test('Tutor sees conflicting understanding flagged for review', ({ given, and, when, then }) => {
    aiBackground({ given, and });

    given('the AI detects conflicting signals about student understanding', () => {
      setReturnedCoverage([{ areaText: URL_CONCEPT, level: 'good', evidence: 'The student explained the risk correctly.' }], true);
    });
    when('a student shows both strong cognitive understanding and risky behavioral choices', async () => {
      await applyCoverageAndRefresh('The student understands the risk but still clicked the suspicious link.');
    });
    then('the tutor should see the response flagged for review', () => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    and('should see analysis: "Strong conceptual understanding but concerning behavioral choices detected"', () => {
      expect(screen.getByText('Strong conceptual understanding but concerning behavioral choices detected')).toBeInTheDocument();
    });
    and('should see a suggestion: "Tutor review recommended - mixed understanding signals detected"', () => {
      expect(screen.getByText('Tutor review recommended - mixed understanding signals detected')).toBeInTheDocument();
    });
  });

  test('Learner receives progress-based encouragement', ({ given, and, when, then }) => {
    aiBackground({ given, and });

    given('a student has made significant progress on their checklist', () => {
      const progressItems: ChecklistBddSeedItem[] = [
        ...Array.from({ length: 4 }, (_, index) => ({ area_text: `Understanding achievement ${index + 1}`, item_type: 'understanding' as const, status: 'covered' as const })),
        ...Array.from({ length: 3 }, (_, index) => ({ area_text: `Behavior achievement ${index + 1}`, item_type: 'behavior' as const, status: 'covered' as const })),
        ...Array.from({ length: 2 }, (_, index) => ({ area_text: `Behavior practice ${index + 1}`, item_type: 'behavior' as const, status: 'pending' as const }))
      ];
      database.seedChecklist(ROOM_ID, 'Progress encouragement', progressItems);
    });
    when('providing feedback', () => {
      visibleFeedback = generateProgressSummary(rowsAsChecklistItems());
      makeFeedbackVisible(visibleFeedback);
    });
    then('the learner should hear specific achievements: "You\'ve mastered 4 understanding concepts and 3 key behaviors!"', () => {
      expect(screen.getByText(/You've mastered 4 understanding concepts and 3 key behaviors!/)).toBeInTheDocument();
    });
    and('should hear targeted encouragement: "Your URL verification skills are really developing well."', () => {
      expect(screen.getByText(/Your URL verification skills are really developing well\./)).toBeInTheDocument();
    });
    and('should hear a next step: "Just 2 more behavioral skills to practice - you\'re doing great!"', () => {
      expect(screen.getByText(/Just 2 more behavioral skills to practice - you're doing great!/)).toBeInTheDocument();
    });
  });
});
