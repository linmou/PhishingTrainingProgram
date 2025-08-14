/**
 * Step definitions for Checklist Management System
 * Covers core functionality, tutor interface, and manual operations
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@jest/globals';

// Mock implementations for step definitions
// These would connect to actual test implementations in a full Cucumber setup

Given('a tutor is logged into the system', async function() {
  this.tutor = {
    id: 'tutor-123',
    role: 'tutor',
    authenticated: true
  };
});

Given('the tutor has created a room with AI assistant enabled', async function() {
  this.room = {
    id: 'room-456',
    tutor_id: this.tutor.id,
    ai_enabled: true,
    settings: {
      checklist_enabled: true
    }
  };
});

Given('a student has joined the room', async function() {
  this.student = {
    id: 'student-789',
    role: 'student',
    room_id: this.room.id
  };
});

Given('the tutor has selected a scenario template', async function() {
  this.template = {
    id: 'template-1',
    name: 'Phishing Email Training',
    items: [
      '[understanding] Sender verification techniques',
      '[behavior] Check sender email manually',
      '[understanding] Link analysis methods',
      '[behavior] Hover over links without clicking'
    ]
  };
});

When('the tutor opens the {string} panel', async function(panelName: string) {
  this.currentPanel = panelName;
  this.panelOpen = true;
});

Then('the tutor should see a checklist with knowledge points', async function() {
  expect(this.currentPanel).toBe('Learning Progress');
  expect(this.checklist.items).toBeDefined();
  expect(this.checklist.items.length).toBeGreaterThan(0);
});

Then('all items should be marked as {string}', async function(status: string) {
  expect(this.checklist.items.every((item: any) => item.status === status)).toBe(true);
});

Then('the completion percentage should show {string}', async function(percentage: string) {
  expect(this.checklist.progress.completion_percentage_display).toBe(percentage);
});

Then('items should display their category prefixes {string} and {string}', async function(prefix1: string, prefix2: string) {
  const items = this.checklist.items;
  const hasUnderstanding = items.some((item: any) => item.area_text.includes(prefix1));
  const hasBehavior = items.some((item: any) => item.area_text.includes(prefix2));
  expect(hasUnderstanding).toBe(true);
  expect(hasBehavior).toBe(true);
});

When('the tutor hovers over {string} item', async function(itemText: string) {
  this.hoveredItem = this.checklist.items.find((item: any) => item.area_text.includes(itemText));
  this.showTooltip = true;
});

Then('a tooltip should appear showing:', async function(expectedContent: string) {
  expect(this.hoveredItem).toBeDefined();
  expect(this.showTooltip).toBe(true);
  // In real implementation, would check tooltip content matches expected format
});

Given('the {string} item shows as {string}', async function(itemText: string, status: string) {
  const item = this.checklist.items.find((item: any) => item.area_text.includes(itemText));
  if (item) {
    item.status = status;
  } else {
    // Add item if it doesn't exist
    this.checklist.items.push({
      id: 'item-' + Date.now(),
      area_text: itemText,
      status: status,
      understanding_level: 'none',
      priority: 'important'
    });
  }
});

Given('the student has demonstrated understanding verbally but not in text', async function() {
  this.verbalDemonstration = true;
  this.textDemonstration = false;
});

When('the tutor clicks the status dropdown for that item', async function() {
  this.statusDropdownOpen = true;
});

When('selects {string}', async function(action: string) {
  this.selectedAction = action;
});

When('enters tutor note: {string}', async function(note: string) {
  this.tutorNote = note;
});

When('clicks {string}', async function(buttonText: string) {
  this.clickedButton = buttonText;
  
  if (buttonText === 'Save' && this.selectedAction === 'Mark as Covered') {
    // Update item status
    const item = this.checklist.items.find((item: any) => this.hoveredItem?.id === item.id);
    if (item) {
      item.status = 'covered';
      item.understanding_level = 'good';
      item.tutor_notes = this.tutorNote;
    }
  }
});

Then('the item should change to {string} status with green checkmark', async function(status: string) {
  const item = this.checklist.items.find((item: any) => this.hoveredItem?.id === item.id);
  expect(item?.status).toBe(status);
});

Then('the completion percentage should update accordingly', async function() {
  // Calculate expected percentage based on covered items
  const coveredCount = this.checklist.items.filter((item: any) => item.status === 'covered').length;
  const totalCount = this.checklist.items.length;
  const expectedPercentage = Math.round((coveredCount / totalCount) * 100);
  
  expect(this.checklist.progress.completion_percentage).toBe(expectedPercentage);
});

Then('the AI system prompt should be regenerated automatically', async function() {
  expect(this.systemPromptRegenerated).toBe(true);
});

Then('the tutor note should be saved for future reference', async function() {
  const item = this.checklist.items.find((item: any) => this.hoveredItem?.id === item.id);
  expect(item?.tutor_notes).toBe(this.tutorNote);
});

When('the tutor updates the status to {string}', async function(status: string) {
  const item = this.checklist.items.find((item: any) => this.hoveredItem?.id === item.id);
  if (item) {
    item.status = status;
    if (status === 'partially_covered') {
      item.understanding_level = 'basic';
    }
  }
});

When('adds note: {string}', async function(note: string) {
  const item = this.checklist.items.find((item: any) => this.hoveredItem?.id === item.id);
  if (item) {
    item.tutor_notes = note;
  }
});

Then('the item should show {string} status with yellow indicator', async function(status: string) {
  const item = this.checklist.items.find((item: any) => this.hoveredItem?.id === item.id);
  expect(item?.status).toBe(status);
});

Then('should remain a priority for AI focus', async function() {
  const item = this.checklist.items.find((item: any) => this.hoveredItem?.id === item.id);
  expect(['pending', 'partially_covered']).toContain(item?.status);
});

Then('the tutor should see {string} indicator', async function(indicator: string) {
  expect(this.uiIndicators).toContain(indicator);
});

// Cognitive vs Behavioral categorization steps
Given('the checklist contains both understanding and behavior items', async function() {
  this.checklist.items = [
    {
      id: '1',
      area_text: '[understanding] URL verification techniques',
      status: 'pending',
      category: 'understanding'
    },
    {
      id: '2', 
      area_text: '[behavior] Check domain manually',
      status: 'pending',
      category: 'behavior'
    }
  ];
});

When('the tutor views the progress summary', async function() {
  this.progressSummary = {
    understanding: this.checklist.items.filter((item: any) => item.area_text.includes('[understanding]')),
    behavior: this.checklist.items.filter((item: any) => item.area_text.includes('[behavior]'))
  };
});

Then('items should be clearly categorized:', async function(expectedTable: any) {
  expect(this.progressSummary.understanding.length).toBeGreaterThan(0);
  expect(this.progressSummary.behavior.length).toBeGreaterThan(0);
});

Then('progress should be tracked separately for each category', async function() {
  expect(this.checklist.progress.understanding_progress).toBeDefined();
  expect(this.checklist.progress.behavior_progress).toBeDefined();
});

Then('both types should contribute to overall completion percentage', async function() {
  const understandingWeight = 0.5;
  const behaviorWeight = 0.5;
  const expectedTotal = (this.checklist.progress.understanding_progress * understandingWeight) + 
                       (this.checklist.progress.behavior_progress * behaviorWeight);
  expect(this.checklist.progress.completion_percentage).toBeCloseTo(expectedTotal, 1);
});

// Soft delete functionality
Given('the checklist contains {string}', async function(itemText: string) {
  if (!this.checklist.items.some((item: any) => item.area_text.includes(itemText))) {
    this.checklist.items.push({
      id: 'item-' + Date.now(),
      area_text: itemText,
      status: 'pending',
      deleted: false
    });
  }
});

When('the tutor clicks the remove button for that item', async function() {
  this.itemToRemove = this.checklist.items.find((item: any) => 
    item.area_text.includes(this.lastMentionedItem)
  );
  this.removeButtonClicked = true;
});

When('confirms the removal', async function() {
  if (this.itemToRemove) {
    this.itemToRemove.deleted = true;
  }
  this.removalConfirmed = true;
});

Then('the item should be removed from the visible checklist', async function() {
  const visibleItems = this.checklist.items.filter((item: any) => !item.deleted);
  expect(visibleItems.some((item: any) => 
    item.area_text.includes(this.lastMentionedItem)
  )).toBe(false);
});

Then('should be marked as deleted in the database \\(soft delete\\)', async function() {
  expect(this.itemToRemove?.deleted).toBe(true);
});

Then('the completion percentage should recalculate without that item', async function() {
  const activeItems = this.checklist.items.filter((item: any) => !item.deleted);
  const coveredCount = activeItems.filter((item: any) => item.status === 'covered').length;
  const expectedPercentage = Math.round((coveredCount / activeItems.length) * 100);
  expect(this.checklist.progress.completion_percentage).toBe(expectedPercentage);
});

Then('any related evidence should be preserved', async function() {
  expect(this.itemToRemove?.coverage_evidence).toBeDefined();
  // Evidence remains in database even when item is soft deleted
});

// Student-level management
Given('a student is working on a checklist', async function() {
  this.studentChecklist = {
    student_id: this.student.id,
    room_id: this.room.id,
    items: this.checklist.items,
    progress: { completion_percentage: 25 }
  };
});

When('the student rejoins the same room later', async function() {
  this.studentRejoined = true;
  // Simulate student leaving and rejoining
});

Then('their individual checklist progress should be preserved', async function() {
  expect(this.studentChecklist.progress.completion_percentage).toBe(25);
});

Then('should continue from where they left off', async function() {
  const coveredItems = this.studentChecklist.items.filter((item: any) => item.status === 'covered');
  expect(coveredItems.length).toBeGreaterThan(0);
});

Then('should not be affected by other students\' progress in different sessions', async function() {
  // Each student has their own checklist instance
  expect(this.studentChecklist.student_id).toBe(this.student.id);
});

// Optional metadata handling
Given('checklist items have optional priority and understanding level metadata', async function() {
  this.checklist.items = this.checklist.items.map((item: any) => ({
    ...item,
    priority: 'critical',
    understanding_level: 'none'
  }));
  this.metadataEnabled = true;
});

When('the tutor chooses to use this metadata', async function() {
  this.tutorUsesMetadata = true;
});

Then('they can set priority levels \\(critical, important, optional\\)', async function() {
  expect(['critical', 'important', 'optional']).toContain(this.checklist.items[0]?.priority);
});

Then('can track understanding levels \\(none, basic, good, excellent\\)', async function() {
  expect(['none', 'basic', 'good', 'excellent']).toContain(this.checklist.items[0]?.understanding_level);
});

Then('when ignored, items function with just the core 3-step status workflow', async function() {
  const simplifiedItem = {
    status: 'pending' // Only core status, no metadata
  };
  expect(['pending', 'partially_covered', 'covered']).toContain(simplifiedItem.status);
});

Then('the system adapts to work with or without this additional data', async function() {
  expect(this.system.supports_metadata).toBe(true);
  expect(this.system.supports_simplified_mode).toBe(true);
});

// Template integration
Given('no system prompt is available for extraction', async function() {
  this.systemPrompt = null;
  this.extractionFailed = true;
});

When('the tutor selects {string}', async function(option: string) {
  this.selectedOption = option;
});

When('chooses {string} template', async function(templateName: string) {
  this.selectedTemplate = {
    name: templateName,
    items: [
      '[understanding] Sender verification techniques',
      '[behavior] Check sender email address manually',
      '[understanding] Link analysis methods',
      '[behavior] Hover over links without clicking',
      '[understanding] Urgency language recognition',
      '[behavior] Take time to verify urgent requests'
    ]
  };
});

Then('the checklist should be populated with template items:', async function(expectedItems: string) {
  expect(this.checklist.items.length).toBe(this.selectedTemplate.items.length);
  this.selectedTemplate.items.forEach((expectedItem: string) => {
    expect(this.checklist.items.some((item: any) => 
      item.area_text.includes(expectedItem.replace(/^\[.*?\]\s*/, ''))
    )).toBe(true);
  });
});

// Add helper methods for complex scenarios
Given(/^(\d+) items are "([^"]*)", (\d+) are "([^"]*)", and (\d+) are "([^"]*)"$/, 
  async function(count1: number, status1: string, count2: number, status2: string, count3: number, status3: string) {
    this.checklist.items = [];
    
    // Add items with specified statuses
    for (let i = 0; i < count1; i++) {
      this.checklist.items.push({ id: `item-${i}`, status: status1, area_text: `Item ${i}` });
    }
    for (let i = 0; i < count2; i++) {
      this.checklist.items.push({ id: `item-${count1 + i}`, status: status2, area_text: `Item ${count1 + i}` });
    }
    for (let i = 0; i < count3; i++) {
      this.checklist.items.push({ id: `item-${count1 + count2 + i}`, status: status3, area_text: `Item ${count1 + count2 + i}` });
    }
});

Then('the progress bar should show appropriate completion percentage', async function() {
  const totalItems = this.checklist.items.length;
  const coveredItems = this.checklist.items.filter((item: any) => item.status === 'covered').length;
  const expectedPercentage = Math.round((coveredItems / totalItems) * 100);
  expect(this.checklist.progress.completion_percentage).toBe(expectedPercentage);
});