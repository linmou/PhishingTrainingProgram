@student-ai-tone
Feature: Student AI tone preference (1:1 rooms only)
  As a student in a single-student room with AI enabled
  I want to optionally claim the AI response tone (peer or adult)
  So that the AI speaks in my preferred register and the tutor cannot override that tone

  # Product note (feedback 9 reinterpretation):
  # Not multi-bot. One AI voice; student may opt in to peer vs adult.
  # Multi-student rooms: feature is blocked (hidden / unavailable) for now.
  # E2E: src/__tests__/student_ai_tone_e2e.test.tsx (RoomPagePost + real tone/settings UI)

  Background:
    Given the AI assistant is enabled for the room
    And the room has a tutor

  # --- Opt-in then tone dropdown ---

  Scenario: Student sees opt-in control before any tone dropdown
    Given exactly one student is in the room
    When the student is viewing the room
    Then the student should see a "Choose AI tone?" control
    And the student should not see a tone dropdown yet

  Scenario: Student opens tone choices after opt-in
    Given exactly one student is in the room
    And the student is viewing the room
    When the student clicks "Choose AI tone?"
    Then the student should see a tone dropdown
    And the tone options should include "Peer" and "Adult"

  Scenario: Student selects Peer tone updates room AI role and locks tutor control
    Given exactly one student is in the room
    And the student has opened the tone dropdown
    When the student selects tone "Peer"
    Then the room AI role should be peer
    And the tutor AI personality control should be locked
    And the tutor should see a visual lock indicator for AI tone

  Scenario: Student selects Adult tone updates room AI role and locks tutor control
    Given exactly one student is in the room
    And the student has opened the tone dropdown
    When the student selects tone "Adult"
    Then the room AI role should be trusted adult
    And the tutor AI personality control should be locked

  Scenario: Tutor can still edit AI personality before student chooses a tone
    Given exactly one student is in the room
    And the student has not chosen an AI tone
    When the tutor opens AI settings
    Then the AI Personality control should be editable
    And there should be no visual lock indicator for AI tone

  # --- Multi-student block ---

  Scenario: Feature is unavailable when multiple students are in the room
    Given two students are in the room
    When a student is viewing the room
    Then the student should not see a "Choose AI tone?" control
    And the student should not see a tone dropdown

  Scenario: Student cannot apply tone when a second student joins before selection
    Given exactly one student is in the room
    And the student has opened the tone dropdown
    When a second student joins the room
    And the first student tries to select tone "Peer"
    Then the tone change should be rejected
    And the tutor AI personality control should remain unlocked

  # --- Preconditions ---

  Scenario: Feature is hidden when AI assistant is disabled
    Given the AI assistant is disabled for the room
    And exactly one student is in the room
    When the student is viewing the room
    Then the student should not see a "Choose AI tone?" control

  Scenario: Observers cannot choose AI tone
    Given exactly one student is in the room
    And an observer is viewing the room
    Then the observer should not see a "Choose AI tone?" control
