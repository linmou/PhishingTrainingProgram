Feature: Observer User Interface

  As an observer, I want a clear, read-only interface to watch training sessions,
  so that I can monitor the interaction without participating in the chat.

  Background:
    Given a user is logged in

  Scenario: Observer selects their role and sees the dashboard
    Given the user is on the role selection page
    When the user selects the "Observer" role
    Then the user is redirected to the observer dashboard
    And the page should display a list of "Available Rooms"

  Scenario: Observer browses and joins an available room
    Given the user is logged in as an "Observer"
    And a room with the title "Live Phishing Demo" is active
    When the observer is on the dashboard
    And they click the "Join" button for the "Live Phishing Demo" room
    Then the observer is navigated to the room page for "Live Phishing Demo"

  Scenario: Observer has a read-only view of the chat
    Given an observer has joined the "Live Phishing Demo" room
    When the observer views the chat interface
    Then they should see a clear indicator that they are in "Read-Only Mode"
    And the chat message input field must be disabled or not visible

  Scenario: Observer sees the conversation unfold
    Given an observer is in the "Live Phishing Demo" room
    When the tutor sends the message "Can you spot the fake link?"
    Then the observer should see the tutor's message in the chat log
    When the student sends the message "I think it's the one with the typo."
    Then the observer should also see the student's message

  Scenario: Observer downloads the chat history
    Given an observer is in the "Live Phishing Demo" room
    And a conversation has taken place
    When the observer clicks the "Download History" button
    Then a file containing the complete chat history should be downloaded 