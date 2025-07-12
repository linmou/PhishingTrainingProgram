@observer-ui
Feature: Observer User Interface

  As an observer, I want a clear, read-only interface to watch training sessions,
  so that I can monitor the interaction without participating in the chat.
  This interface should be responsive and handle various states gracefully.

  Background:
    Given a user is authenticated

  Scenario: Observer selects their role and sees the dashboard with loading state
    Given the user is on the role selection page
    When the user selects the "Observer" role
    Then the user is redirected to the observer dashboard
    And the observer dashboard should initially display a "Loading rooms..." message
    And then the page should display "Available Rooms"

  Scenario: Observer sees a list of available rooms
    Given the user is logged in as an "Observer"
    And a room with the title "Live Phishing Demo" is active
    When the observer is on the dashboard
    Then the observer should see the room "Live Phishing Demo" in the list
    And the room should display the tutor name and description

  Scenario: Observer sees updated message when no rooms are available
    Given the user is logged in as an "Observer"
    And no active rooms are available
    When the observer is on the dashboard
    Then the observer should see the message "No rooms available"
    And the observer should see the message "Please wait for a tutor to create a room."

  Scenario: Observer sees new rooms appear in real-time
    Given the observer is on the dashboard viewing an empty list of rooms
    When a tutor creates a new room with title "Security Awareness Training"
    Then the "Security Awareness Training" room should appear in the list automatically without a page refresh

  Scenario: Observer browses and joins an available room
    Given the user is logged in as an "Observer"
    And a room with the title "Live Phishing Demo" is active
    When the observer clicks the "Join" button for the "Live Phishing Demo" room
    Then the observer is navigated to the room page for "Live Phishing Demo"

  Scenario: Observer has a read-only view of the chat
    Given an observer has joined the "Live Phishing Demo" room
    When the observer views the chat interface
    Then they should see a clear indicator that they are in "Read-Only Mode"
    And the chat message input field must be disabled or not visible
    And there should be a visual indicator showing their observer status

  Scenario: Observer sees the conversation unfold in real-time
    Given an observer is in the "Live Phishing Demo" room
    When the tutor sends the message "Can you spot the fake link?"
    Then the observer should see the tutor's message in the chat log immediately
    When the student sends the message "I think it's the one with the typo."
    Then the observer should also see the student's message immediately
    And messages should display with appropriate role labels (Tutor/Student)

  Scenario: Observer fails to join a room due to an error
    Given the user is logged in as an "Observer"
    And the system will produce an error when they try to join "Live Phishing Demo"
    When the observer clicks the "Join" button for the "Live Phishing Demo" room
    Then the observer should see an error message "Failed to join the room. Please try again."

  Scenario: Observer downloads the chat history
    Given an observer is in the "Live Phishing Demo" room
    And a conversation has taken place
    When the observer clicks the "Download History" button
    Then a file containing the complete chat history should be downloaded
    And the file should include room information and participant details

  Scenario: Observer interface is responsive on mobile devices
    Given an observer is logged in on a mobile device
    When they view the observer dashboard
    Then the layout should be optimized for mobile screens
    And all buttons and text should be clearly visible and accessible

  Scenario: Observer interface is responsive on desktop
    Given an observer is logged in on a desktop browser
    When they view the observer dashboard
    Then the layout should utilize the available screen space effectively
    And the room list should be clearly organized and readable

  Scenario: Observer handles multiple rooms being available
    Given the user is logged in as an "Observer"
    And multiple rooms are active: "Phishing Basics", "Advanced Threats", "Social Engineering"
    When the observer is on the dashboard
    Then they should see all three rooms listed
    And each room should have its own "Join" button
    And room information should be clearly distinguished

  Scenario: Observer sees clear indication of read-only status in room
    Given an observer has joined the "Live Phishing Demo" room
    When they view the room interface
    Then there should be a persistent visual indicator showing "Observer Mode"
    And the participant list should show their name with "(Observer)" label
    And any interactive elements should be clearly disabled or hidden 