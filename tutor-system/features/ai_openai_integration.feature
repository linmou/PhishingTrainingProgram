@ai-qwen
Feature: Qwen API Integration
  As a system administrator
  I want to configure real Qwen API integration
  So that tutors can get high-quality AI suggestions

  Background:
    Given the system has environment variables configured:
      | Variable      | Description                          |
      | OAI_API_KEY   | DashScope Qwen API key for authentication |
      | OAI_BASE_URL  | Optional custom API endpoint         |

  Scenario: System uses dummy AI when no API key is configured
    Given OAI_API_KEY is not set
    When a tutor requests an AI suggestion
    Then the system should use the DummyAIService
    And the response should be from predefined templates
    And the response time should be simulated (200-800ms)

  Scenario: System uses Qwen when API key is configured
    Given OAI_API_KEY is set to a valid API key
    When a tutor requests an AI suggestion
    Then the system should use the QwenService
    And the request should be sent to DashScope's Qwen API
    And the response should be dynamically generated

  Scenario: Custom API endpoint configuration
    Given OAI_API_KEY is set
    And OAI_BASE_URL is set to "https://custom-api.example.com"
    When a tutor requests an AI suggestion
    Then the system should send requests to the custom endpoint
    And use the provided API key for authentication

  Scenario: Qwen service respects room controls
    Given Qwen integration is active
    And a room has AI settings:
      | Setting      | Value                              |
      | model        | qwen3.5-flash                    |
      | temperature  | 0.7                               |
      | max_tokens   | 300                               |
      | prompt       | Focus on cybersecurity education   |
    When generating a suggestion
    Then the Qwen request should use these exact settings

  Scenario: Visible failure on Qwen errors
    Given Qwen integration is active
    And the Qwen API returns an error
    When a tutor requests an AI suggestion
    Then the system should show an error message
    And the error should be logged for debugging
    And the tutor can still type responses manually

  Scenario: Response formatting from Qwen
    Given Qwen integration is active
    When Qwen returns a response
    Then the system should extract the content
    And format it as a suggested_response
    And include metadata (model_used, response_time_ms)

  Scenario: Cost-effective API usage
    Given Qwen integration is active
    Then the system should:
      | Optimization           | Implementation                    |
      | Limit context         | Only send recent relevant messages |
      | Respect max_tokens    | Prevent excessive token usage      |
      | Cache similar queries | Avoid duplicate API calls          |

  Scenario: Security of API credentials
    Given OAI_API_KEY is configured
    Then the API key should never be:
      | Exposed in           | Protection Method              |
      | Client-side code     | Server-side only              |
      | Error messages       | Sanitized error responses      |
      | Logs                 | Masked in log output           |
      | Database             | Environment variables only     |

  Scenario: Only Qwen model is selectable
    Given Qwen integration is active
    When a tutor selects different models:
      | Model Selected    | API Model Used     |
      | Qwen3.5 Flash    | qwen3.5-flash    |
    Then the system should use the appropriate model

  Scenario: Temperature effects on suggestions
    Given Qwen integration is active
    When temperature is set to different values:
      | Temperature | Expected Behavior                    |
      | 0.0        | Most deterministic responses         |
      | 0.5        | Balanced creativity and consistency  |
      | 1.0        | More creative and varied responses   |
    Then the AI suggestions should reflect these characteristics
