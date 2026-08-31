@ai-assistant
Feature: AI Assistant for Tutors
  As a tutor
  I want an AI assistant that provides contextual suggestions
  So that I can respond more effectively to student questions

  Background:
    Given the user is logged in as a tutor
    And the tutor has created a room called "AI-Enhanced Learning"
    And a student has joined the room
    And the AI assistant feature is available

  Scenario: Tutor enables AI assistant for a room
    Given the tutor is in the "AI-Enhanced Learning" room
    When the tutor clicks the "AI Settings" button
    And the tutor toggles "Enable AI Assistant" to on
    And the tutor selects model "Qwen3.5 Flash"
    And the tutor sets temperature to 0.7
    And the tutor saves the settings
    Then the AI assistant should be enabled for the room
    And the AI status should show as "AI: On (Qwen3.5 Flash)"

  Scenario: Tutor disables AI assistant
    Given the AI assistant is enabled in the room
    When the tutor clicks the "AI Settings" button
    And the tutor toggles "Enable AI Assistant" to off
    And the tutor saves the settings
    Then the AI assistant should be disabled for the room
    And the AI status should show as "AI: Off"

  Scenario: AI generates contextual suggestions
    Given the AI assistant is enabled
    And the student sends the message "What is phishing?"
    When the tutor clicks the AI suggestion button
    Then the AI assistant should generate a suggested response
    And the suggestion should relate to phishing education
    And the suggestion box should show the student's message as context

  Scenario: Tutor accepts AI suggestion
    Given the AI has generated a suggestion "Phishing is a cybercrime where..."
    When the tutor clicks "Copy to Input"
    Then the suggestion should be copied to the message input field
    And the suggestion box should disappear
    When the tutor sends the message without changes
    Then the system should track the suggestion as "accepted"

  Scenario: Tutor rejects AI suggestion
    Given the AI has generated a suggestion
    When the tutor clicks the "Reject" button
    Then the suggestion box should disappear
    And the system should track the suggestion as "rejected"
    And the message input should remain empty

  Scenario: Tutor modifies AI suggestion
    Given the AI has generated a suggestion "Phishing is a cybercrime where..."
    When the tutor clicks "Copy to Input"
    And the tutor modifies the text to "Phishing is a type of cyber attack where..."
    And the tutor sends the modified message
    Then the system should track the suggestion as "modified"
    And the final response should be recorded

  Scenario: AI responds to specific student messages
    Given the AI assistant is enabled
    And there are multiple messages in the chat
    When the student sends "Can you explain spear phishing?"
    And the tutor clicks the AI suggestion button
    Then the AI should generate a response specifically about spear phishing
    And the context should show "Can you explain spear phishing?" as the parent message

  Scenario: AI suggestion tracking
    Given the tutor has interacted with AI suggestions
    When the tutor has:
      | Action   | Count |
      | accepted | 3     |
      | rejected | 1     |
      | modified | 2     |
    Then the system should maintain a record of all interactions
    And each interaction should include response time metrics

  Scenario: AI configuration persistence
    Given the tutor has configured AI settings with:
      | Setting      | Value            |
      | Model        | Qwen3.5 Flash   |
      | Temperature  | 0.5             |
      | Max Tokens   | 300             |
      | Enabled      | true            |
    When the tutor leaves the room
    And the tutor rejoins the room
    Then the AI settings should be preserved
    And the AI status should show "AI: On (Qwen3.5 Flash)"

  Scenario: AI handles no student messages gracefully
    Given the AI assistant is enabled
    And there are no student messages in the chat
    When the tutor clicks the AI suggestion button
    Then the system should show "No student message found to respond to"
    And no suggestion should be generated

  Scenario: AI respects role-based access
    Given a student is viewing the room
    Then the student should not see the AI Settings button
    And the student should not see the AI suggestion button
    Given an observer is viewing the room
    Then the observer should not see the AI Settings button
    And the observer should not see the AI suggestion button

  Scenario: AI suggestion with custom system prompt
    Given the tutor has set a custom system prompt "Focus on practical examples"
    And the student asks "What is social engineering?"
    When the tutor requests an AI suggestion
    Then the AI response should emphasize practical examples
    And the suggestion should align with the custom prompt

  Scenario: AI failure handling
    Given the AI assistant is enabled
    And the AI service is temporarily unavailable
    When the tutor clicks the AI suggestion button
    Then the system should show an error message
    And the error should say "Failed to generate AI response"
    And the tutor should still be able to type manually
