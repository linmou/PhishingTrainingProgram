@ai-openai
Feature: OpenAI API Integration
  As a system administrator
  I want to configure real OpenAI API integration
  So that tutors can get high-quality AI suggestions

  Background:
    Given the system has environment variables configured:
      | Variable      | Description                          |
      | OAI_API_KEY   | OpenAI API key for authentication   |
      | OAI_BASE_URL  | Optional custom API endpoint         |

  Scenario: System uses dummy AI when no API key is configured
    Given OAI_API_KEY is not set
    When a tutor requests an AI suggestion
    Then the system should use the DummyAIService
    And the response should be from predefined templates
    And the response time should be simulated (200-800ms)

  Scenario: System uses OpenAI when API key is configured
    Given OAI_API_KEY is set to a valid API key
    When a tutor requests an AI suggestion
    Then the system should use the OpenAIService
    And the request should be sent to OpenAI's API
    And the response should be dynamically generated

  Scenario: Custom API endpoint configuration
    Given OAI_API_KEY is set
    And OAI_BASE_URL is set to "https://custom-api.example.com"
    When a tutor requests an AI suggestion
    Then the system should send requests to the custom endpoint
    And use the provided API key for authentication

  Scenario: OpenAI service respects room configuration
    Given OpenAI integration is active
    And a room has AI settings:
      | Setting      | Value                              |
      | model        | gpt-4o-mini                       |
      | temperature  | 0.7                               |
      | max_tokens   | 300                               |
      | prompt       | Focus on cybersecurity education   |
    When generating a suggestion
    Then the OpenAI request should use these exact settings

  Scenario: Graceful fallback on OpenAI errors
    Given OpenAI integration is active
    And the OpenAI API returns an error
    When a tutor requests an AI suggestion
    Then the system should show an error message
    And the error should be logged for debugging
    And the tutor can still type responses manually

  Scenario: Response formatting from OpenAI
    Given OpenAI integration is active
    When OpenAI returns a response
    Then the system should extract the content
    And format it as a suggested_response
    And include metadata (model_used, response_time_ms)

  Scenario: Cost-effective API usage
    Given OpenAI integration is active
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

  Scenario: Model selection with OpenAI
    Given OpenAI integration is active
    When a tutor selects different models:
      | Model Selected    | API Model Used     |
      | GPT-4o Mini      | gpt-4o-mini       |
      | GPT-4o           | gpt-4o            |
      | GPT-4            | gpt-4             |
    Then the system should use the appropriate model

  Scenario: Temperature effects on suggestions
    Given OpenAI integration is active
    When temperature is set to different values:
      | Temperature | Expected Behavior                    |
      | 0.0        | Most deterministic responses         |
      | 0.5        | Balanced creativity and consistency  |
      | 1.0        | More creative and varied responses   |
    Then the AI suggestions should reflect these characteristics