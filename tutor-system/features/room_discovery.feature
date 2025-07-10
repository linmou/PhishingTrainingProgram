Feature: Room Discovery and Joining
  As a student or observer
  I want to browse and join available rooms
  So that I can participate in tutoring sessions

  Background:
    Given the system has the following users:
      | display_name   | role     |
      | John Tutor     | tutor    |
      | Jane Student   | student  |
      | Bob Student    | student  |
      | Alice Observer | observer |

  Scenario: Student views available rooms
    Given I am logged in as "Jane Student" with role "student"
    And the tutor "John Tutor" has created a room titled "Math Basics" with description "Introduction to algebra"
    When I view the student dashboard
    Then I should see the available rooms section
    And I should see a room card with:
      | Title       | Math Basics              |
      | Tutor       | John Tutor               |
      | Description | Introduction to algebra  |
      | Status      | Available                |

  Scenario: Student sees waiting message when no rooms available
    Given I am logged in as "Jane Student" with role "student"
    And there are no active rooms
    When I view the student dashboard
    Then I should see "No rooms available"
    And I should see "Please wait for a tutor to create a room"

  Scenario: Student joins an available room
    Given I am logged in as "Jane Student" with role "student"
    And the tutor "John Tutor" has created a room titled "Physics 101"
    And no other student has joined the room
    When I view the student dashboard
    And I click "Join Room" on the "Physics 101" room card
    Then I should be redirected to the room view
    And I should see "Physics 101" as the room title
    And I should see "John Tutor" as the tutor name
    And I should be able to send messages in the chat

  Scenario: Student cannot join a full room
    Given I am logged in as "Jane Student" with role "student"
    And the tutor "John Tutor" has created a room titled "Chemistry Lab"
    And the student "Bob Student" has already joined the room
    When I view the student dashboard
    Then I should see the "Chemistry Lab" room card
    And the room card should show "Room Full" status
    And the "Join Room" button should be disabled

  Scenario: Observer views available rooms
    Given I am logged in as "Alice Observer" with role "observer"
    And the tutor "John Tutor" has created a room titled "History Class"
    When I view the observer dashboard
    Then I should see the available rooms section
    And I should see a room card for "History Class"

  Scenario: Observer joins a room as read-only
    Given I am logged in as "Alice Observer" with role "observer"
    And the tutor "John Tutor" has created a room titled "English Literature"
    And the student "Jane Student" has joined the room
    When I view the observer dashboard
    And I click "Observe Room" on the "English Literature" room card
    Then I should be redirected to the room view
    And I should see "English Literature" as the room title
    And I should see the chat messages
    But I should not see the message input field
    And I should see "Observer Mode - Read Only" indicator

  Scenario: Multiple observers can join the same room
    Given I am logged in as "Alice Observer" with role "observer"
    And the tutor "John Tutor" has created a room titled "Science Lab"
    And the student "Jane Student" has joined the room
    And 3 observers have already joined the room
    When I view the observer dashboard
    And I click "Observe Room" on the "Science Lab" room card
    Then I should successfully join the room as an observer
    And I should see "4 observers" in the room info

  Scenario: Room list updates in real-time
    Given I am logged in as "Jane Student" with role "student"
    And I am viewing the student dashboard
    And there are no active rooms
    When the tutor "John Tutor" creates a new room titled "Calculus Help"
    Then I should see the "Calculus Help" room appear without refreshing
    And the room card should show as "Available"

  Scenario: Student sees room status change in real-time
    Given I am logged in as "Jane Student" with role "student"
    And the tutor "John Tutor" has created a room titled "Programming 101"
    And I am viewing the student dashboard
    When another student "Bob Student" joins the "Programming 101" room
    Then I should see the room status change to "Room Full"
    And the "Join Room" button should become disabled

  Scenario: Room displays preview image
    Given I am logged in as "Jane Student" with role "student"
    And the tutor "John Tutor" has created a room titled "Art History" with image "art-history.jpg"
    When I view the student dashboard
    Then I should see the room card for "Art History"
    And the room card should display the "art-history.jpg" preview image