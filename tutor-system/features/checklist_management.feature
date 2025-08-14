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
    And the AI system prompt should be regenerated automatically
    And the tutor note should be saved for future reference

  Scenario: Tutor marks item as partially covered
    Given the "[understanding] Social engineering recognition" item shows as "pending"
    When the tutor updates the status to "partially_covered"
    And adds note: "Student identified some tactics but missed emotional manipulation"
    Then the item should show "partially_covered" status with yellow indicator
    And should remain a priority for AI focus
    And the tutor should see "Needs Reinforcement" indicator

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
    And adds description: "Student should recognize emotional pressure techniques"
    And clicks "Add Item"
    Then the new item should appear in the checklist
    And should be marked as "pending"
    And should be included in future AI system prompts

  Scenario: Tutor removes checklist item (soft delete)
    Given the checklist contains "[behavior] Report to IT department"
    When the tutor clicks the remove button for that item
    And confirms the removal
    Then the item should be removed from the visible checklist
    And should be marked as deleted in the database (soft delete)
    And the completion percentage should recalculate without that item
    And any related evidence should be preserved

  Scenario: Tutor overrides AI coverage detection
    Given the AI has automatically marked "[understanding] Business logic evaluation" as "covered"
    But the tutor believes the student's understanding is incomplete
    When the tutor clicks on that item
    And selects "Override AI Assessment"
    And changes status from "covered" to "partially_covered"
    And adds note: "Student needs more practice with why companies wouldn't offer loss-making deals"
    Then the item should update to "partially_covered" status
    And the AI should receive updated guidance to reinforce this area
    And the override should be logged for quality improvement

  Scenario: Tutor views student progress analytics
    When the tutor clicks "View Analytics" in the checklist panel
    Then they should see a detailed breakdown:
      | Metric | Value | Insight |
      | Time to First Coverage | 12 minutes | Student took time to warm up |
      | Most Difficult Item | [understanding] Urgency language | Required 3 attempts |
      | Strongest Item | [behavior] URL verification | Mastered quickly |
      | Coverage Pattern | Linear progression | Systematic learner |
      | AI Detection Accuracy | 85% accurate | High confidence in AI |

  Scenario: Different templates have different checklists
    Given the tutor is using "Nintendo Switch Deal" template with 8 items
    When the tutor switches to "iTunes Gift Card Survey" template
    Then the checklist should update to show different knowledge points
    And all items should be marked as "pending"
    And the AI system prompt should be regenerated with new items

  Scenario: Real-time updates during conversation
    Given the tutor has the checklist panel open
    And is monitoring a conversation between AI and student
    When the student demonstrates understanding of "[understanding] Generic username identification"
    Then the checklist should update in real-time without page refresh
    And the item should change from "pending" to "covered"
    And the tutor should see the updated completion percentage immediately

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
    And chooses "Phishing Email Training" template
    Then the checklist should be populated with template items:
      """
      [understanding] Sender verification techniques
      [behavior] Check sender email address manually
      [understanding] Link analysis methods
      [behavior] Hover over links without clicking
      [understanding] Urgency language recognition
      [behavior] Take time to verify urgent requests
      """

  Scenario: Cognitive understanding vs behavior categorization
    Given the checklist contains both understanding and behavior items
    When the tutor views the progress summary
    Then items should be clearly categorized:
      | Category | Example Items | Purpose |
      | [understanding] | URL verification techniques, Social engineering recognition | Knowledge concepts |
      | [behavior] | Check domain manually, Report suspicious content | Practical actions |
    And progress should be tracked separately for each category
    And both types should contribute to overall completion percentage

  Scenario: Handling mixed cognitive and behavioral content
    Given a complex knowledge point contains both understanding and action elements
    When creating checklist items
    Then it should be split into separate items:
      """
      Original: "Students should understand phishing tactics and know to verify before clicking"
      Split into:
      [understanding] Phishing tactics recognition
      [behavior] Verify links before clicking
      """

  Scenario: Student-level checklist management
    Given a student is working on a checklist
    When the student rejoins the same room later
    Then their individual checklist progress should be preserved
    And should continue from where they left off
    And should not be affected by other students' progress in different sessions

  Scenario: Optional metadata management
    Given checklist items have optional priority and understanding level metadata
    When the tutor chooses to use this metadata
    Then they can set priority levels (critical, important, optional)
    And can track understanding levels (none, basic, good, excellent)
    But when ignored, items function with just the core 3-step status workflow
    And the system adapts to work with or without this additional data

  Scenario: Tutor receives intelligent alerts
    Given the AI has detected inconsistent understanding patterns
    When a student shows mastery regression in a previously covered item
    Then the tutor should receive an alert: "⚠️ Student may need review of '[understanding] URL verification' - showing confusion after initial mastery"
    And should see recommended interventions
    And should have the option to reset that item to "partially_covered" status

  Scenario: Tutor handles technical issues gracefully
    Given the AI coverage detection service becomes unavailable
    When the tutor notices items aren't updating automatically
    Then the system should display a "Manual Mode" indicator
    And should allow full manual control of all status updates
    And should queue updates to sync when service is restored
    And should not interrupt the learning session