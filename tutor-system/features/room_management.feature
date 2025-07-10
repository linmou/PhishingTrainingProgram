Feature: Room Management with Supabase Storage
  As a tutor
  I want to create rooms with content and image uploads
  So that students can join and participate in learning sessions

  Background:
    Given the Supabase authentication system is configured
    And the user is authenticated as a tutor
    And Supabase Storage is properly configured with RLS policies

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

  Scenario: Tutor creates a room with image upload
    Given I am logged in as a tutor
    When I navigate to the room creation page
    And I enter room title "Advanced JavaScript"
    And I enter room description "Advanced JavaScript concepts and patterns"
    And I select an image file "python-basics.jpg" for upload
    And I submit the room creation form
    Then the image should be uploaded to Supabase Storage
    And a secure download URL should be generated for the image
    And a new room should be created with the image metadata
    And the room should display the uploaded image
    And the image should be accessible via the secure URL

  Scenario: Image upload validation
    Given I am logged in as a tutor
    When I navigate to the room creation page
    And I try to upload a file "document.pdf" that is not an image
    Then I should see an error message "Please select a valid image file (JPG, PNG, GIF)"
    And the upload should be rejected

  Scenario: Image upload size validation
    Given I am logged in as a tutor
    When I navigate to the room creation page
    And I try to upload an image larger than 5MB
    Then I should see an error message "Image size must be less than 5MB"
    And the upload should be rejected

  Scenario: Upload progress indicator
    Given I am logged in as a tutor
    When I navigate to the room creation page
    And I select a large image file for upload
    And I submit the room creation form
    Then I should see a progress indicator during upload
    And the progress should update as the upload proceeds
    And the form should be disabled during upload

  Scenario: RLS policy enforcement for storage
    Given I am logged in as a student
    When I try to upload an image to Supabase Storage directly
    Then the upload should be rejected due to RLS policies
    And I should receive an authorization error

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

  Scenario: Image compression
    Given I am logged in as a tutor
    When I upload a high-resolution image
    Then the image should be automatically compressed
    And the compressed image should maintain acceptable quality
    And the file size should be optimized for web display

  Scenario: Secure image URL generation
    Given a room exists with an uploaded image
    When the room is displayed to users
    Then the image URL should be a secure Supabase Storage URL
    And the URL should include proper authentication tokens
    And the URL should have an appropriate expiration time 