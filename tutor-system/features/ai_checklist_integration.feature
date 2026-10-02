Feature: AI Checklist Integration
  As a tutor supporting a learner
  I want checklist progress and guidance to reflect what the learner demonstrates
  So that I can focus help on remaining gaps

  Background:
    Given the AI assistant is enabled for a tutoring room
    And a student has joined the room
    And the checklist system is initialized for the student

  @non_feasible
  Scenario: LLM extracts knowledge points from system prompt
    Given a system prompt contains phishing training content:
      """
      You are helping students identify phishing attempts. Guide them to:
      - Understand how attackers create urgency to pressure victims
      - Recognize suspicious URLs and domains
      - Learn to manually verify sender authenticity
      - Always hover over links before clicking
      - Report suspicious content to appropriate authorities
      """
    When the LLM processes the system prompt for checklist extraction
    Then the LLM should identify cognitive understanding points:
      """
      [understanding] Urgency manipulation techniques
      [understanding] URL and domain analysis
      [understanding] Sender authenticity verification methods
      """
    And should identify behavioral action points:
      """
      [behavior] Hover over links before clicking
      [behavior] Report suspicious content to authorities
      [behavior] Manually verify sender through official channels
      """
    And should extract only content that exists in the original prompt
    And should not add external knowledge not present in the prompt

  @non_feasible
  Scenario: LLM handles mixed cognitive and behavioral content
    Given a system prompt contains mixed content:
      """
      Students should understand social engineering tactics and know to verify information through official channels
      """
    When the LLM extracts checklist items
    Then it should separate the content into distinct items:
      """
      [understanding] Social engineering tactics recognition
      [behavior] Verify information through official channels
      """

  @non_feasible
  Scenario: LLM extraction with high-level cognitive and specific behavioral categorization
    Given a system prompt contains detailed phishing training guidance
    When the LLM extracts items using cognitive/behavioral categorization
    Then cognitive understanding items should be high-level concepts:
      """
      [understanding] Email authenticity assessment
      [understanding] URL verification techniques
      [understanding] Social engineering recognition
      """
    And behavioral action items should be specific actionable steps:
      """
      [behavior] Check sender email address manually
      [behavior] Navigate to official website independently
      [behavior] Verify urgent requests through alternate channels
      """

  Scenario: AI receives checklist context in system prompt
    Given the checklist shows items with mixed progress:
      | Item | Status | Category |
      | URL verification techniques | covered | understanding |
      | Check sender credentials manually | covered | behavior |
      | Social engineering recognition | partially_covered | understanding |
      | Report suspicious content | pending | behavior |
      | Business logic evaluation | pending | understanding |
    When the AI system prompt is generated
    Then the prompt should include current learning progress:
      """
      ## CURRENT LEARNING PROGRESS:
      🔴 PRIORITY ITEMS - FOCUS ON THESE:
      - [ ] [understanding] Business logic evaluation (pending)
      - [ ] [behavior] Report suspicious content (pending)
      - [~] [understanding] Social engineering recognition (needs reinforcement)
      
      ✅ WELL COVERED - REFERENCE LIGHTLY:
      - [✓] [understanding] URL verification techniques
      - [✓] [behavior] Check sender credentials manually
      """
    And the AI should receive instructions to focus on uncovered items

  @non_feasible
  Scenario: AI automatically detects coverage in student responses
    Given the "[understanding] URL verification techniques" item is marked as "pending"
    When a student responds with "I noticed the link goes to goo.gl instead of nintendo.com, which seems suspicious"
    And the AI analyzes the response for understanding
    Then the AI should identify URL verification understanding
    And should mark the response with coverage evidence: "[COVERAGE: url_verification | Student correctly identified non-official domain | good]"

  Scenario: URL verification coverage updates the tutor checklist
    Given the "[understanding] URL verification techniques" item is marked as "pending"
    And AI analysis has returned coverage evidence for the student's URL verification response
    When the room applies the coverage evidence
    Then the item should be marked as "covered"
    And the tutor should see the student's response as evidence for that item

  @non_feasible
  Scenario: AI detects behavioral demonstration
    Given the "[behavior] Hover over links before clicking" item is marked as "pending"
    When a student says "I hovered over the link and saw it was going to a different site than expected"
    Then the AI should recognize the behavioral demonstration
    And should mark it with: "[COVERAGE: hover_verification | Student demonstrated safe link checking behavior | good]"

  Scenario: Behavioral coverage updates the tutor checklist
    Given the "[behavior] Hover over links before clicking" item is marked as "pending"
    And AI analysis has returned coverage evidence for the student's link checking action
    When the room applies the coverage evidence
    Then the item should be marked as "covered"
    And the tutor should see the student's response as evidence for that item

  @non_feasible
  Scenario: AI tracks partial understanding progression
    Given a student shows basic understanding of "[understanding] Social engineering recognition"
    When the student identifies some manipulation tactics but misses emotional pressure techniques
    Then the AI should identify partial understanding
    And should provide targeted guidance on missed concepts
    And should gradually build toward complete understanding

  Scenario: Partial understanding updates the tutor checklist
    Given the "[understanding] Social engineering recognition" item is marked as "pending"
    And AI analysis has returned partial coverage evidence for that item
    When the room applies the coverage evidence
    Then the item should be marked as "partially_covered"
    And the tutor should see that it still needs attention

  @non_feasible
  Scenario: Learner receives practical guidance after mastering concepts
    Given a student has mastered cognitive understanding items but not behavioral actions
    When the AI provides guidance
    Then the learner should receive guidance that transitions from concept explanation to practical application
    And should say something like: "Great job recognizing the red flags! Now let's practice the specific steps you should take when you spot these signs."
    And should prioritize behavioral items in responses

  Scenario: Learner receives feedback on understanding and action
    Given a student demonstrates both cognitive understanding and behavioral application
    When the student explains "I recognized the urgency language and then verified by going to the official website"
    Then the learner should receive feedback that acknowledges both dimensions:
      """
      Excellent! You showed great understanding of urgency tactics [understanding] 
      AND you took the right verification action [behavior]. This is exactly 
      how knowledge translates into safe behavior.
      """

  @non_feasible
  Scenario: AI handles incorrect understanding gracefully
    Given the "[understanding] Business logic evaluation" item was marked as "covered"
    When the student later demonstrates misunderstanding of why companies wouldn't offer loss-making deals
    Then the AI should identify the later misunderstanding
    And should provide corrective guidance without making the student feel bad

  Scenario: Later misunderstanding reopens a covered checklist item
    Given the "[understanding] Business logic evaluation" item is marked as "covered"
    And AI analysis has returned evidence of the student's later misunderstanding
    When the room applies the coverage evidence
    Then the item should be marked as "partially_covered"
    And the tutor should see the updated status

  Scenario: Learner receives an explanation focused on remaining gaps
    Given "[understanding] Generic username identification" is marked as "covered"
    And "[understanding] Urgency language recognition" is "pending" 
    When the student asks "What makes this message suspicious?"
    Then the learner should hear: "You already spotted the fake username - good eye!"
    And should focus the explanation on: "Let's look at the urgent language that pressures quick action..."
    And should tailor response depth to match understanding levels

  @non_feasible
  Scenario: AI generates comprehensive coverage evidence
    Given the AI detects student understanding during conversation
    When the AI marks an item as covered
    Then it should generate evidence that includes:
      | Field | Example |
      | Student Quote | "That $19.99 is way too cheap for a Switch that costs $300" |
      | Concept Demonstrated | Price-reality evaluation |
      | Category | [understanding] Business logic evaluation |
      | Understanding Level | Good - student identified core issue |
      | Confidence Score | 85% confident in understanding |
      | Recommended Action | Move to related behavioral items |

  Scenario: Tutor can inspect saved coverage evidence
    Given coverage evidence includes a student quote, concept, category, understanding level, confidence score, and recommended action
    When the coverage update is saved and the tutor opens the checklist item
    Then the tutor should see those evidence fields with the covered item

  @non_feasible
  Scenario: AI handles multiple simultaneous coverage detections
    Given a student response demonstrates understanding of multiple items
    When the student says "I checked the sender's email, hovered over the link, and saw both were suspicious"
    Then the AI should identify multiple coverage areas:
      """
      [COVERAGE: sender_verification | Student checked email authenticity | good]
      [COVERAGE: link_hover_behavior | Student demonstrated safe link checking | excellent]
      [COVERAGE: suspicious_indicator_synthesis | Student combined multiple verification methods | excellent]
      """

  Scenario: Multiple coverage results update the tutor checklist together
    Given AI analysis has returned coverage evidence for sender verification, link hovering, and suspicious indicator synthesis
    When the room applies the coverage results
    Then all three corresponding checklist items should be marked as "covered"
    And the tutor should see evidence for each updated item

  Scenario: Tutor sees conflicting understanding flagged for review
    Given the AI detects conflicting signals about student understanding
    When a student shows both strong cognitive understanding and risky behavioral choices
    Then the tutor should see the response flagged for review
    And should see analysis: "Strong conceptual understanding but concerning behavioral choices detected"
    And should see a suggestion: "Tutor review recommended - mixed understanding signals detected"

  @non_feasible
  Scenario: Learner receives progress-based encouragement
    Given a student has made significant progress on their checklist
    When providing feedback
    Then the learner should hear specific achievements: "You've mastered 4 understanding concepts and 3 key behaviors!"
    And should hear targeted encouragement: "Your URL verification skills are really developing well."
    And should hear a next step: "Just 2 more behavioral skills to practice - you're doing great!"
