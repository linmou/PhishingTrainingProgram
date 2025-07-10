Feature: Chat History and Room Information Download

  As a user (tutor, student, or observer)
  I want to download the chat history and room information
  So that I can keep a record of the training session for future reference.

  Background:
    Given a "tutor" user is logged in
    And the "tutor" has created a room named "Phishing 101"
    And a "student" user has joined the "Phishing 101" room
    And the "tutor" has sent the message "Welcome to Phishing 101!"
    And the "student" has sent the message "Glad to be here!"
    And an "observer" user has joined the "Phishing 101" room

  Scenario: Download button is visible to all roles
    Given the user is logged in as a "tutor" in the "Phishing 101" room
    Then the user should see a "Download Chat" button
    When the user logs out and logs in as a "student" in the "Phishing 101" room
    Then the user should see a "Download Chat" button
    When the user logs out and logs in as an "observer" in the "Phishing 101" room
    Then the user should see a "Download Chat" button

  Scenario: Download chat history as TXT
    Given the user is logged in as a "student" in the "Phishing 101" room
    When the user clicks the "Download Chat" button
    And selects the "TXT" format
    Then a file named "Phishing_101_chat_history.txt" should be downloaded
    And the file should contain the room title "Phishing 101"
    And the file should contain the messages "Welcome to Phishing 101!" and "Glad to be here!" with timestamps.

  Scenario: Download chat history as JSON
    Given the user is logged in as a "tutor" in the "Phishing 101" room
    When the user clicks the "Download Chat" button
    And selects the "JSON" format
    Then a file named "Phishing_101_chat_history.json" should be downloaded
    And the JSON file should be valid
    And the JSON file should contain the room title "Phishing 101"
    And the JSON file should contain a list of participants including the "tutor", "student", and "observer"
    And the JSON file should contain a list of messages with content, author, role, and timestamp

  Scenario: Download chat history as PDF
    Given the user is logged in as an "observer" in the "Phishing 101" room
    When the user clicks the "Download Chat" button
    And selects the "PDF" format
    Then a file named "Phishing_101_chat_history.pdf" should be downloaded
    And the downloaded file should be a valid PDF document.

  Scenario: Downloaded content includes all required information
    Given the user is logged in as a "tutor" in the "Phishing 101" room
    When the user downloads the chat history as "JSON"
    Then the downloaded file should contain the room's creation date
    And the downloaded file should contain each participant's display name and role
    And each message in the downloaded file should have a unique ID, content, author's display name, author's role, and a precise timestamp. 