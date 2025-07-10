Feature: Real-time Chat System
  As a user in a room, I want to communicate with other participants in real-time,
  with permissions based on my role.

  Background:
    Given a "tutor" user "Tutor" exists and is logged in
    And a "student" user "Student" exists and is logged in
    And an "observer" user "Observer" exists and is logged in
    And the tutor has created a room called "Phishing 101"
    And the student has joined the "Phishing 101" room
    And the observer has joined the "Phishing 101" room

  Scenario: Tutor and Student can exchange messages
    When the tutor sends the message "Welcome to the session!"
    Then the student should see the message "Welcome to the session!" from the tutor
    And the observer should see the message "Welcome to the session!" from the tutor
    When the student sends the message "Hi, glad to be here."
    Then the tutor should see the message "Hi, glad to be here." from the student
    And the observer should see the message "Hi, glad to be here." from the student

  Scenario: Messages appear immediately without page refresh
    Given the tutor and student are both viewing the same room
    When the tutor sends the message "Real-time test message"
    Then the student should see the message "Real-time test message" immediately without refreshing
    And the message should appear in the student's chat window within 2 seconds
    When the student sends the message "I can see it!"
    Then the tutor should see the message "I can see it!" immediately without refreshing
    And the message should appear in the tutor's chat window within 2 seconds

  Scenario: Observer has read-only access to the chat
    Then the chat input should be disabled for the observer
    And the send message button should be disabled for the observer

  Scenario: Chat history is preserved
    Given the tutor has sent the message "This is the first message."
    And the student has sent the message "This is the second message."
    When the student leaves the room
    And the student rejoins the "Phishing 101" room
    Then the student should see the message "This is the first message." from the tutor
    And the student should see the message "This is the second message." from the student

  Scenario: Typing indicators are shown between tutor and student
    When the student starts typing a message
    Then the tutor should see a typing indicator for the student
    When the student stops typing
    Then the tutor should not see a typing indicator for the student
    When the tutor starts typing a message
    Then the student should see a typing indicator for the tutor
    When the tutor stops typing
    Then the student should not see a typing indicator for the student 

  Scenario: Offline message synchronization
    Given the student is disconnected from the network
    When the tutor sends the message "Can you see this message?"
    And the student reconnects to the network
    Then the student should see the message "Can you see this message?" from the tutor 