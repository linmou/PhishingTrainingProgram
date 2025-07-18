Feature: Room Management with Preset Images
  As a tutor
  I want to create rooms with content and preset image selection
  So that students can join and participate in learning sessions

  Background:
    Given the Supabase authentication system is configured
    And the user is authenticated as a tutor
    And preset room images are available

  Scenario: Tutor creates a basic room without image
    Given I am logged in as a tutor
    When I navigate to the room creation page
    And I enter room title "Introduction to Python"
    And I enter room description "Basic Python programming concepts for beginners"
    And I submit the room creation form
    Then a new room should be created in the database
    And the room should be visible in the room list
    And the room should have the correct title and description
    And the room should be marked as active

  Scenario: Tutor creates a room with preset image selection
    Given I am logged in as a tutor
    When I navigate to the room creation page
    And I enter room title "Advanced JavaScript"
    And I enter room description "Advanced JavaScript concepts and patterns"
    And I select a preset image "phishing_1.png"
    And I submit the room creation form
    Then a new room should be created with the selected preset image
    And the room should display the selected preset image
    And the image should be accessible via the preset image URL

  Scenario: Preset image selection validation
    Given I am logged in as a tutor
    When I navigate to the room creation page
    And I view the available preset images
    Then I should see a selection of curated room images
    And each image should have a descriptive name
    And I should be able to select one image option

  Scenario: Room creation without image selection
    Given I am logged in as a tutor
    When I navigate to the room creation page
    And I enter room title "Mathematics Basics"
    And I enter room description "Fundamental mathematics concepts"
    And I do not select any preset image
    And I submit the room creation form
    Then a new room should be created with a default image
    And the room should display the default placeholder image

  Scenario: Room creation form validation
    Given I am logged in as a tutor
    When I navigate to the room creation page
    And I leave the room title empty
    And I submit the room creation form
    Then I should see a validation error "Room title is required"
    And the room should not be created

  Scenario: Multiple room creation
    Given I am logged in as a tutor
    And I have already created a room "Math Basics"
    When I create another room "Science Fundamentals"
    Then both rooms should be visible in the room list
    And each room should maintain its own metadata
    And the rooms should be listed in creation order

  Scenario: Preset image display
    Given preset images are loaded
    When I navigate to the room creation page
    Then I should see a grid of available preset images
    And each image should be clearly labeled
    And I should be able to preview each image before selection

  Scenario: Image selection feedback
    Given I am logged in as a tutor
    When I navigate to the room creation page
    And I select a preset image "privacy_1.png"
    Then the selected image should be highlighted
    And I should see a preview of the selected image
    And the image name should be displayed

  Scenario: Default image handling
    Given I am logged in as a tutor
    When I create a room without selecting any preset image
    Then the system should assign a default room image
    And the default image should be appropriate for educational content
    And the room should be created successfully

  Scenario: Tutor creates a password-protected room
    Given I am logged in as a tutor
    When I navigate to the room creation page
    And I enter room title "Private Study Session"
    And I enter room description "Advanced topics requiring password access"
    And I enable password protection
    And I enter room password "SecurePass123"
    And I submit the room creation form
    Then a new password-protected room should be created
    And the room password should be visible in my room list
    And the password should be displayed in a monospace font

  Scenario: Room owner bypasses password protection
    Given I am logged in as a tutor
    And I have created a password-protected room "Private Session" with password "MyPass123"
    When I click to enter my own room
    Then I should enter the room directly without password prompt
    And I should see the room content immediately

  Scenario: Non-owner attempts to join password-protected room
    Given a password-protected room exists with password "SecurePass123"
    And I am logged in as a student
    When I attempt to join the password-protected room
    Then I should see a password prompt modal
    And the modal should display "This room is password protected. Please enter the password."
    And the modal should have a password input field

  Scenario: Entering correct password for room access
    Given a password-protected room exists with password "SecurePass123"
    And I am logged in as an observer
    And I see the password prompt modal
    When I enter the password "SecurePass123"
    And I click "Join Room"
    Then I should successfully enter the room
    And the password prompt should disappear
    And I should see the room content

  Scenario: Entering incorrect password for room access
    Given a password-protected room exists with password "SecurePass123"
    And I am logged in as a student
    And I see the password prompt modal
    When I enter the password "WrongPassword"
    And I click "Join Room"
    Then I should see an error message "Incorrect password. Please try again."
    And the password prompt should remain open
    And the password field should be cleared
    And I should be able to retry entering the password

  Scenario: Canceling password prompt
    Given a password-protected room exists
    And I am logged in as a student
    And I see the password prompt modal
    When I click "Cancel"
    Then I should be redirected to the home page
    And I should not enter the room

  Scenario: Room without password protection
    Given I am logged in as a tutor
    When I create a room without enabling password protection
    Then the room should be created without a password
    And any authenticated user should be able to join without password prompt
    And the room card should display "No password" in the password field