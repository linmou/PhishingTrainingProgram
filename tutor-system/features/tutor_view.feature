@tutor-ui
Feature: Tutor User Interface

  As a tutor, I want a clear and functional interface to select my role,
  create and manage rooms, engage with students in chat, and download session history,
  so I can effectively conduct a training session.

  Background:
    Given a user is logged in

  Scenario: Tutor selects their role and sees the dashboard
    Given the user is on the role selection page
    When the user selects the "Tutor" role
    Then the user is redirected to the tutor dashboard
    And the page should display options to "Create a new Room"

  Scenario: Tutor creates a new room
    Given the user is logged in as a "Tutor"
    When the tutor clicks on "Create a new Room"
    And they fill in the title "Advanced Phishing" and description "A deep dive into modern phishing attacks"
    And they select a predefined image for the room
    And they click the "Create" button
    Then a new room with the title "Advanced Phishing" should be active
    And the tutor is automatically navigated to the new room page

  Scenario: Tutor sees their created room on the dashboard
    Given a tutor has created a room with the title "Advanced Phishing"
    When the tutor navigates to their dashboard
    Then they should see "Advanced Phishing" in their list of managed rooms
    And they should see an option to "Enter Room"

  Scenario: Tutor enters and interacts in a room
    Given a tutor is on their dashboard
    And their room "Advanced Phishing" has a student waiting
    When the tutor clicks "Enter Room" for "Advanced Phishing"
    Then the tutor is navigated to the room page
    And they can see the student in the participant list
    When the tutor sends the message "Hello, welcome to the training!"
    Then the message "Hello, welcome to the training!" from the tutor should be visible in the chat

  Scenario: Tutor downloads chat history from the room
    Given a tutor is in the "Advanced Phishing" room
    And the chat contains a conversation with a student
    When the tutor clicks the "Download History" button
    Then a file containing the chat history and room details should be downloaded

  Scenario: Tutor sees AI assistant controls in room
    Given a tutor is in the "Advanced Phishing" room
    Then the tutor should see an "AI Settings" button
    And the tutor should see the AI status indicator
    And the AI status should initially show "AI: Off"

  Scenario: Tutor uses AI suggestions while teaching
    Given a tutor is in the "Advanced Phishing" room with AI enabled
    And a student asks "What are the warning signs of phishing?"
    When the tutor clicks the AI suggestion button
    Then an AI suggestion box should appear
    And the suggestion should be contextually relevant to the student's question
    And the tutor should see options to "Copy to Input" or "Reject"

  Scenario: Tutor downloads chat history with AI tracking data
    Given a tutor is in a room where they used AI suggestions
    And the tutor has accepted, modified, and rejected various suggestions
    When the tutor clicks the "Download History" button
    And selects "Download as JSON"
    Then the downloaded file should include:
      | Section         | Description                           |
      | messages        | All chat messages                     |
      | ai_interactions | Records of AI suggestion usage        |
      | ai_summary      | Statistics on AI suggestion usage     |

  # Room Template Management
  Scenario: Tutor creates a room and saves it as a template
    Given the user is logged in as a "Tutor"
    When the tutor clicks on "Create a new Room"
    And they fill in the title "Phishing Email Detection Training"
    And they fill in the description "Learn to identify and avoid phishing emails"
    And they select a predefined image for the room
    And they add pre-populated dialogue messages
    And they enable AI assistant with specific settings
    And they check the "Save as template" checkbox
    And they click the "Create Room" button
    Then a new room with the title "Phishing Email Detection Training" should be created
    And a template with the name "Phishing Email Detection Training" should be saved
    And the template should include all room configurations

  Scenario: Tutor views available templates during room creation
    Given the user is logged in as a "Tutor"
    And the tutor has previously saved templates:
      | Template Name                        | Category      |
      | Phishing Email Detection Training    | phishing      |
      | Privacy Basics Workshop             | privacy       |
      | Social Engineering Defense          | social        |
    When the tutor clicks on "Create a new Room"
    Then they should see a "Use template" dropdown
    And the dropdown should contain:
      | Template Name                        |
      | Phishing Email Detection Training    |
      | Privacy Basics Workshop             |
      | Social Engineering Defense          |

  Scenario: Tutor creates a room using an existing template
    Given the user is logged in as a "Tutor"
    And a template named "Privacy Basics Workshop" exists with:
      | Field                  | Value                                    |
      | title                  | Privacy Basics Workshop                 |
      | description            | Understanding digital privacy fundamentals |
      | image_url              | /images/room-presets/privacy_1.png      |
      | ai_assistant_enabled   | true                                     |
      | ai_model               | gpt-3.5-turbo                           |
      | pre_populated_dialogue | 2 example messages                       |
    When the tutor clicks on "Create a new Room"
    And they select "Privacy Basics Workshop" from the template dropdown
    Then the room creation form should be auto-filled with:
      | Field       | Expected Value                           |
      | title       | Privacy Basics Workshop                 |
      | description | Understanding digital privacy fundamentals |
      | image       | privacy_1.png selected                  |
    And the AI assistant settings should be pre-configured
    And the pre-populated dialogue should be loaded
    And the tutor should be able to modify any of these values before creating

  Scenario: Tutor modifies template values before creating room
    Given the user is logged in as a "Tutor"
    And they have selected the "Privacy Basics Workshop" template
    And the form is pre-filled with template values
    When they change the title to "Advanced Privacy Workshop"
    And they modify the description to "Advanced digital privacy concepts"
    And they select a different preset image
    And they click the "Create Room" button
    Then a new room should be created with the modified values
    And the original template should remain unchanged
    And the new room should not affect the existing template

  Scenario: Template preserves all room configurations
    Given the user is logged in as a "Tutor"
    And they are creating a room with complex configurations:
      | Configuration Type     | Details                                  |
      | OP Settings           | Custom OP name "TrainingBot"            |
      | Password Protection   | Enabled with password "SecureTraining"  |
      | Pre-populated Dialogue| 3 training scenario messages            |
      | AI Configuration      | GPT-4 model, temperature 0.8, custom prompt |
      | Image Selection       | Custom uploaded training image           |
    When they check "Save as template"
    And they create the room
    Then the saved template should preserve all configurations
    And future rooms created from this template should inherit all settings

  Scenario: Tutor creates room with template but chooses not to save as new template
    Given the user is logged in as a "Tutor"
    When they create a room using the "Privacy Basics Workshop" template
    And they modify the room configuration
    And they do not check "Save as template"
    And they click "Create Room"
    Then a new room should be created with the modified values
    And no new template should be saved
    And the template count should remain the same

  Scenario: Template auto-naming uses room title
    Given the user is logged in as a "Tutor"
    When they create a room with title "Cybersecurity Fundamentals Workshop"
    And they check "Save as template"
    And they create the room
    Then the template should be saved with the name "Cybersecurity Fundamentals Workshop"
    And the template should appear in future dropdown menus with this exact name

  Scenario: Multiple templates from same tutor are independently managed
    Given the user is logged in as a "Tutor"
    And they have created multiple templates:
      | Template Name                     | Creation Date |
      | Phishing Email Detection          | 2024-01-01    |
      | Social Engineering Awareness      | 2024-01-02    |
      | Password Security Training        | 2024-01-03    |
    When they navigate to room creation
    Then all three templates should be available in the dropdown
    And each template should maintain its unique configuration
    And selecting any template should load its specific settings

  Scenario: Template dropdown shows only tutor's own templates
    Given the user is logged in as a "Tutor A"
    And "Tutor A" has created templates:
      | Template Name                     |
      | Phishing Email Detection          |
      | Social Engineering Awareness      |
    And another "Tutor B" has created templates:
      | Template Name                     |
      | Advanced Malware Analysis         |
      | Network Security Fundamentals     |
    When "Tutor A" navigates to room creation
    Then the template dropdown should only show:
      | Template Name                     |
      | Phishing Email Detection          |
      | Social Engineering Awareness      |
    And "Tutor B's" templates should not be visible 