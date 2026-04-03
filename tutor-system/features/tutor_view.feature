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
