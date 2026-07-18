Feature: Student User Interface

  As a student, I want a clear and functional interface to select my role,
  find available rooms, see their status, and join them,
  so I can effectively participate in a training session.
  This interface should be responsive and handle various states gracefully.

  Background:
    Given a user is authenticated

  Scenario: Student selects their role and sees the dashboard with a loading state
    When the user logs in and selects the "Student" role
    Then the student dashboard should initially display a "Loading rooms..." message
    And then the page should display "Available Rooms"

  Scenario: Student sees a list of available rooms
    Given the user is logged in as a "Student"
    And a tutor has created a room with title "Phishing 101"
    When the student is on the dashboard
    Then the student should see the room "Phishing 101" in the list

  Scenario: Student sees an updated message when no rooms are available
    Given the user is logged in as a "Student"
    And no active rooms are available
    When the student is on the dashboard
    Then the student should see the message "No rooms available"
    And the student should see the message "Please wait for a tutor to create a room."

  Scenario: Student sees a new room appear in real-time
    Given the student is on the dashboard viewing an empty list of rooms
    When a tutor creates a new room with title "Live Hacking Demo"
    Then the "Live Hacking Demo" room should appear in the list automatically without a page refresh

  Scenario: Student joins a room successfully
    Given a user is logged in as a "Student"
    And the "Phishing 101" room is available and not full
    When the student clicks the "Join" button for the "Phishing 101" room
    Then the user should be navigated to the room page for "Phishing 101"

  Scenario: Student sees a room is full
    Given the user is logged in as a "Student"
    And the "Phishing 101" room is full
    When the student views the list of available rooms
    Then the "Join" button for the "Phishing 101" room should be disabled
    And the student should see a "Room Full" status indicator for that room

  Scenario: Student fails to join a room due to an error
    Given the user is logged in as a "Student"
    And the system will produce an error when they try to join "Phishing 101"
    When the student clicks the "Join" button for the "Phishing 101" room
    Then the student should see an error message "Failed to join the room. Please try again."

  # --- Test / harness rooms (behavior-eval) must not appear on Available Rooms ---
  # Covered by mock suites: StudentView.roomVisibility.test.tsx, behaviorTestRooms.test.ts
  # (and steps below). Classification: [behavior-test-room] marker, Demo: titles,
  # DemoTutor_* harness owners; real teaching rooms stay visible.

  Scenario: Student does not see behavior-test rooms tagged with the marker
    Given the user is logged in as a "Student"
    And an active teaching room titled "Phishing 101" exists
    And an active room titled "Internal Eval Room" is tagged as a behavior-test room
    When the student is on the dashboard
    Then the student should see the room "Phishing 101" in the list
    And the student should not see the room "Internal Eval Room" in the list

  Scenario: Student does not see Demo-titled test rooms
    Given the user is logged in as a "Student"
    And an active teaching room titled "Phishing 101" exists
    And an active room titled "Demo: Lock Icon Myth" exists
    When the student is on the dashboard
    Then the student should see the room "Phishing 101" in the list
    And the student should not see the room "Demo: Lock Icon Myth" in the list

  Scenario: Student does not see rooms owned by DemoTutor harness accounts
    Given the user is logged in as a "Student"
    And an active teaching room titled "Phishing 101" exists with tutor "Grace"
    And an active room titled "Account Security Alert Scam" is owned by tutor "DemoTutor_615166"
    And an active room titled "Nintendo Switch Deal Scam" is owned by tutor "DemoTutor_962226"
    When the student is on the dashboard
    Then the student should see the room "Phishing 101" in the list
    And the student should not see the room "Nintendo Switch Deal Scam" in the list
    And the student should not see tutor "DemoTutor_615166" on the dashboard
    And the student should not see tutor "DemoTutor_962226" on the dashboard

  Scenario: Student still sees real classic teaching rooms from normal tutors
    Given the user is logged in as a "Student"
    And an active room titled "Account Security Alert Scam" is owned by tutor "Adele"
    When the student is on the dashboard
    Then the student should see the room "Account Security Alert Scam" in the list
    And the student should see tutor "Adele" on the dashboard

  Scenario: Student sees empty list when only test or harness rooms are active
    Given the user is logged in as a "Student"
    And the only active rooms are behavior-test or DemoTutor harness rooms
    When the student is on the dashboard
    Then the student should see the message "No rooms available"
    And the student should see the message "Please wait for a tutor to create a room."
