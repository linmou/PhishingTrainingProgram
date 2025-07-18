Feature: Room Original Poster (OP) Configuration
  As a tutor creating rooms
  I want to configure who appears as the Original Poster (OP)
  So that rooms can represent different authorship scenarios

  Background:
    Given the Supabase authentication system is configured
    And the user is authenticated as a tutor with display name "John Tutor"
    And the OP configuration feature is enabled

  Scenario: Default OP configuration using tutor profile
    Given I am logged in as a tutor
    When I navigate to the room creation page
    And I enter room title "Personal Tutoring Session"
    And I select "Use my profile as OP" option
    And I submit the room creation form
    Then the room should be created with OP set to my profile
    And the room post should display "John Tutor" as the OP
    And the room post should show my avatar as the OP avatar
    And the OP badge should display "📝 OP" instead of "👨‍🏫 Tutor"

  Scenario: Custom OP name configuration
    Given I am logged in as a tutor
    When I navigate to the room creation page
    And I enter room title "Corporate Training Module"
    And I select "Use custom OP name" option
    And I enter custom OP name "Security Department"
    And I submit the room creation form
    Then the room should be created with custom OP name
    And the room post should display "Security Department" as the OP
    And the room post should show default avatar for the OP
    And the OP should not be linked to any user account

  Scenario: OP configuration validation
    Given I am logged in as a tutor
    When I navigate to the room creation page
    And I select "Use custom OP name" option
    And I leave the custom OP name field empty
    And I submit the room creation form
    Then I should see an error "Custom OP name is required when using custom OP"
    And the room should not be created

  Scenario: OP settings display in room creation form
    Given I am logged in as a tutor
    When I navigate to the room creation page
    Then I should see "Original Poster (OP) Settings" section
    And I should see two radio options for OP configuration
    And the "Use my profile as OP" option should be selected by default
    And I should see my display name preview under the profile option

  Scenario: Custom OP name input visibility
    Given I am logged in as a tutor
    When I navigate to the room creation page
    And I select "Use custom OP name" option
    Then the custom OP name input field should become visible
    And I should see placeholder text "Enter custom OP name"
    And I should see helper text "Custom OP names won't have profile pictures or user accounts"

  Scenario: Switching between OP options
    Given I am logged in as a tutor
    When I navigate to the room creation page
    And I select "Use custom OP name" option
    And I enter custom OP name "Training Team"
    And I switch back to "Use my profile as OP" option
    Then the custom OP name input should be hidden
    And my profile name should be shown as the OP preview

  Scenario: Room display with profile OP
    Given a room exists with tutor "John Tutor" as the OP
    When I view the room in post-style interface
    Then I should see "John Tutor" displayed as the OP
    And I should see the tutor's avatar next to the OP name
    And I should see "📝 OP" badge next to the name

  Scenario: Room display with custom OP
    Given a room exists with custom OP name "IT Department"
    When I view the room in post-style interface
    Then I should see "IT Department" displayed as the OP
    And I should see a default avatar for the OP
    And I should see "📝 OP" badge next to the name

  Scenario: Room card display configuration
    Given I have created rooms with different OP settings
    When I view my tutor dashboard
    Then room cards should show OP information when configured
    And rooms with profile OP should show the tutor's avatar
    And rooms with custom OP should show the custom name
    And the display should be controlled by the showOp prop

  Scenario: Backwards compatibility
    Given existing rooms created before OP feature
    When the OP fields are added to the database
    Then existing rooms should have OP fields set to the tutor's information
    And the rooms should display correctly with tutor as OP
    And no data should be lost in the migration