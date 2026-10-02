Feature: Checklist Management System
  As a tutor teaching cybersecurity concepts
  I want to track which knowledge points students have mastered
  So that I can ensure comprehensive coverage and focus on learning gaps

  Background:
    Given a tutor is logged into the system
    And the tutor has created a room with AI assistant enabled
    And a student has joined the room
    And the tutor has selected a scenario template

  Scenario: Tutor sees initial checklist with all items pending
    When the tutor opens the "Learning Progress" panel
    Then the tutor should see a checklist with knowledge points
    And all items should be marked as "pending"
    And the completion percentage should show "0% Complete"
    And items should display their category prefixes "[understanding]" and "[behavior]"

  Scenario: Tutor manually marks item as covered
    Given the "[behavior] Check actual domain before clicking" item shows as "pending"
    And the student has demonstrated understanding verbally but not in text
    When the tutor clicks the status dropdown for that item
    And selects "Mark as Covered"
    And enters tutor note: "Student correctly verified domain in verbal discussion"
    And clicks "Save"
    Then the item should change to "covered" status with green checkmark
    And the completion percentage should update accordingly
    And the tutor note should be saved for future reference

  Scenario: Tutor marks item as partially covered
    Given the "[understanding] Social engineering recognition" item shows as "pending"
    When the tutor updates the status to "partially_covered"
    And adds note: "Student identified some tactics but missed emotional manipulation"
    Then the item should show "partially_covered" status with yellow indicator
    And should remain a priority for AI focus

  Scenario: Progressive coverage tracking through conversation
    Given the student has not yet demonstrated understanding of URL verification
    When the student asks "How can I tell if this link is safe?"
    And the AI responds with URL checking techniques
    And the student replies "Oh, so I should look for the real company domain?"
    Then the "[understanding] URL verification techniques" item should be marked as "partially_covered"
    And when the student later says "I checked and it goes to a different domain than expected"
    Then the item should be upgraded to "covered"

  Scenario: Checklist progress visualization
    Given 3 items are "covered", 2 are "partially_covered", and 3 are "pending"
    When the tutor views the checklist panel
    Then the progress bar should show appropriate completion percentage
    And should display:
      | Status | Count | Color |
      | Covered | 3 | Green |
      | Partially Covered | 2 | Yellow |
      | Pending | 3 | Red |

  Scenario: Tutor adds custom checklist item
    When the tutor clicks "Add Custom Item"
    And enters "[understanding] Emotional manipulation tactics" as the item name
    And clicks "Add Item"
    Then the new item should appear in the checklist
    And should be marked as "pending"

  Scenario: Coverage evidence tracking
    Given an item is marked as "covered"
    When the tutor clicks on that item
    Then they should see the evidence that triggered the coverage:
      | Field | Example |
      | Student Response | "Lucy Simms doesn't sound like a real Nintendo employee" |
      | Analysis | Student correctly identified non-official username |
      | Timestamp | 2024-01-15 14:23:45 |
      | Detection Method | AI Analysis |
      | Confidence Level | High |

  Scenario: Template system integration
    Given no system prompt is available for extraction
    When the tutor selects "Create from Template"
    And uses the default "General Scam Indicators" template
    Then the checklist should be populated with template items:
      """
      Too good to be true pricing or offers
      Urgent language designed to pressure quick action
      Suspicious or shortened URLs that hide real destinations
      Check the source: Is this from an official, verified account?
      Verify the URL: Does it match the official website domain?
      Cross-reference: Check the company's official website and social media
      """
