@student-ai-tone
Feature: Student AI role preference (1:1 rooms only)
  As a student in a single-student room with AI enabled
  I want to optionally choose the AI role (peer or adult)
  So that the AI speaks in my preferred register and the tutor cannot override that role

  # Product note (feedback 9 reinterpretation):
  # Not multi-bot. One AI voice; student may opt in to peer vs adult.
  # Multi-student rooms: feature is blocked (hidden / unavailable) for now.
  # E2E: src/__tests__/student_ai_tone_e2e.test.tsx (RoomPagePost + real role/settings UI)

  Background:
    Given the AI assistant is enabled for the room
    And the room has a tutor

  # --- Opt-in then role dropdown ---

  Scenario: Student sees opt-in control before any role dropdown
    Given exactly one student is in the room
    When the student is viewing the room
    Then the student should see a "Choose AI role?" control
    And the student should not see a role dropdown yet

  Scenario: Student opens role choices after opt-in
    Given exactly one student is in the room
    And the student is viewing the room
    When the student clicks "Choose AI role?"
    Then the student should see a role dropdown
    And the role options should include "Peer" and "Adult"

  Scenario: Student selects Peer role updates room AI role and locks tutor control
    Given exactly one student is in the room
    And the student has opened the role dropdown
    When the student selects role "Peer"
    Then the room AI role should be peer
    And the tutor AI personality control should be locked
    And the tutor should see a visual lock indicator for AI role
    And Quick Adjust should receive the student-selected role

  Scenario: Student selects Adult role updates room AI role and locks tutor control
    Given exactly one student is in the room
    And the student has opened the role dropdown
    When the student selects role "Adult"
    Then the room AI role should be trusted adult
    And the tutor AI personality control should be locked

  Scenario: Tutor can still edit AI personality before student chooses a role
    Given exactly one student is in the room
    And the student has not chosen an AI role
    When the tutor opens AI settings
    Then the AI Personality control should be editable
    And there should be no visual lock indicator for AI role

  # --- Multi-student block ---

  Scenario: Feature is unavailable when multiple students are in the room
    Given two students are in the room
    When a student is viewing the room
    Then the student should not see a "Choose AI role?" control
    And the student should not see a role dropdown

  Scenario: Student cannot apply role when a second student joins before selection
    Given exactly one student is in the room
    And the student has opened the role dropdown
    When a second student joins the room
    And the first student tries to select role "Peer"
    Then the role change should be rejected
    And the tutor AI personality control should remain unlocked

  # --- Preconditions ---

  Scenario: Feature is hidden when AI assistant is disabled
    Given the AI assistant is disabled for the room
    And exactly one student is in the room
    When the student is viewing the room
    Then the student should not see a "Choose AI role?" control

  Scenario: Observers cannot choose AI role
    Given exactly one student is in the room
    And an observer is viewing the room
    Then the observer should not see a "Choose AI role?" control
