@ai-tracking
Feature: AI Suggestion Tracking and Analytics
  As a tutor or researcher
  I want to track how AI suggestions are used
  So that I can analyze the effectiveness of AI assistance

  Background:
    Given the user is logged in as a tutor
    And the tutor has a room with AI assistant enabled
    And a student is participating in the room

  Scenario: Track accepted suggestions
    Given the student sends "How do I identify phishing emails?"
    And the AI generates suggestion "Look for these red flags: suspicious sender addresses..."
    When the tutor copies the suggestion
    And sends it without modification
    Then the system should record:
      | Field               | Value                                    |
      | tutor_action       | accepted                                 |
      | parent_message     | How do I identify phishing emails?       |
      | ai_suggestion      | Look for these red flags...              |
      | tutor_final_response | Look for these red flags...           |
      | response_time_ms   | <measured time>                         |

  Scenario: Track rejected suggestions
    Given the student sends "Is this email legitimate?"
    And the AI generates a suggestion
    When the tutor clicks "Reject"
    Then the system should record:
      | Field               | Value                          |
      | tutor_action       | rejected                       |
      | parent_message     | Is this email legitimate?      |
      | ai_suggestion      | <generated suggestion>         |
      | tutor_final_response | null                         |

  Scenario: Track modified suggestions
    Given the student sends "What should I do if I clicked a phishing link?"
    And the AI generates suggestion "Immediately change your passwords..."
    When the tutor copies the suggestion
    And modifies it to "First, don't panic. Then change your passwords..."
    And sends the modified message
    Then the system should record:
      | Field               | Value                                           |
      | tutor_action       | modified                                        |
      | ai_suggestion      | Immediately change your passwords...             |
      | tutor_final_response | First, don't panic. Then change your passwords... |

  Scenario: Track ignored suggestions
    Given the student sends "Can you help me?"
    And the AI generates a suggestion
    And the tutor views the suggestion
    When the tutor generates another AI suggestion without using the first
    Then the system should mark the first suggestion as "ignored"

  Scenario: Export tracking data as JSON
    Given the tutor has used AI suggestions multiple times
    When the tutor downloads chat history
    And selects "Download as JSON"
    Then the export should include:
      | Section          | Contains                              |
      | messages         | All chat messages                     |
      | ai_interactions  | Array of AI suggestion interactions   |
      | summary          | Statistics on AI usage               |

  Scenario: AI interaction summary in JSON export
    Given the tutor has:
      | Accepted suggestions | 5 |
      | Rejected suggestions | 2 |
      | Modified suggestions | 3 |
      | Ignored suggestions  | 1 |
    When the tutor exports as JSON
    Then the summary section should show:
      """json
      {
        "ai_summary": {
          "total_suggestions": 11,
          "accepted": 5,
          "rejected": 2,
          "modified": 3,
          "ignored": 1,
          "acceptance_rate": 45.45,
          "modification_rate": 27.27
        }
      }
      """

  Scenario: Export tracking data as TXT
    Given the tutor has used AI suggestions
    When the tutor downloads chat history
    And selects "Download as TXT"
    Then the export should include a section:
      """
      AI Assistant Summary:
      ===================
      Total AI suggestions: 11
      Accepted: 5 (45.45%)
      Modified: 3 (27.27%)
      Rejected: 2 (18.18%)
      Ignored: 1 (9.09%)
      """

  Scenario: Track response time metrics
    Given the AI generates a suggestion at timestamp T1
    When the tutor takes action at timestamp T2
    Then the system should calculate response_time_ms as (T2 - T1)
    And store this metric with the interaction record

  Scenario: Persistent tracking across sessions
    Given the tutor has AI interactions in a previous session
    When the tutor rejoins the room
    And downloads the chat history
    Then all previous AI interactions should be included
    And the data should be complete and accurate

  Scenario: Privacy-conscious tracking
    Given AI tracking is enabled
    Then the system should only track:
      | Tracked           | Not Tracked              |
      | Action taken      | Tutor personal info      |
      | Response times    | Student personal info    |
      | Message content   | IP addresses             |
      | Suggestion content| Browser information      |

  Scenario: Real-time tracking updates
    Given the tutor is using AI suggestions
    When the tutor accepts a suggestion
    Then the tracking database should be updated immediately
    And the interaction should be available in exports without page refresh

  Scenario: Contextual message tracking
    Given the AI generates suggestions based on previous messages
    When tracking an AI interaction
    Then the system should store the context messages
    And preserve the conversation flow for analysis