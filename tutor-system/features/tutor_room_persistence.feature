@tutor-room-persistence
Feature: Tutor Room Persistence

  As a tutor, I want my created rooms to persist across login sessions
  so that I can continue managing my rooms when I return to the platform.

  Background:
    Given a user is logged in

  Scenario: Tutor sees previously created rooms after re-login
    Given I previously logged in as "Dr. Smith" with role "Tutor"
    And I created a room titled "Advanced Security Training"
    And I logged out
    When I log in again as "Dr. Smith" with role "Tutor"
    And I navigate to the tutor dashboard
    Then I should see "Advanced Security Training" in my list of managed rooms
    And the room should show as "Active"

  Scenario: Different tutors see only their own rooms
    Given tutor "Dr. Smith" has created a room titled "Security 101"
    And tutor "Prof. Johnson" has created a room titled "Privacy Basics"
    When I log in as "Dr. Smith" with role "Tutor"
    Then I should see "Security 101" in my list of managed rooms
    And I should not see "Privacy Basics" in my list of managed rooms

  Scenario: Tutor rooms persist with correct metadata
    Given I previously logged in as "Dr. Smith" with role "Tutor"
    And I created a room with the following details:
      | title       | Phishing Defense Workshop          |
      | description | Learn to identify phishing attacks |
      | image       | phishing-1                         |
    When I log in again as "Dr. Smith" with role "Tutor"
    And I navigate to the tutor dashboard
    Then I should see a room with:
      | title       | Phishing Defense Workshop          |
      | description | Learn to identify phishing attacks |
      | status      | Active                             |

  Scenario: Tutor can manage rooms from previous sessions
    Given I previously logged in as "Dr. Smith" with role "Tutor"
    And I created a room titled "Cybersecurity Fundamentals"
    When I log in again as "Dr. Smith" with role "Tutor"
    And I navigate to the tutor dashboard
    And I click "Enter Room" for "Cybersecurity Fundamentals"
    Then I should be navigated to the room page
    And I should be able to send messages in the room