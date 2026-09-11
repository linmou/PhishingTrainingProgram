# Purpose: specify the observable T09 transfer-assessment lifecycle at the room boundary.
Feature: Transfer assessment lifecycle
  As a teacher reviewing phishing-training tutoring
  I want transfer checks to be evidence-based, private, and single-use
  So that a learner demonstrates understanding in a meaningful new situation

  Background:
    Given the transfer assessment policy is enabled for a new learner-owned checklist
    And the checklist uses the existing status and understanding_level pair

  @T09 @U01 @U02
  Scenario: Broad learner evidence makes one meaningful transfer target eligible
    Given the learner has given a correct explanation for a configured concept
    And the learner has not already demonstrated transfer for that concept
    When the tutor evaluates the next turn
    Then the concept may become partially_covered with understanding_level basic
    And the tutor may select at most one current relevant transfer target
    And the transfer context must change the meaningful situation rather than only the brand

  @T09 @U03 @U07
  Scenario: Protection and correction precede transfer assessment
    Given the learner is about to open a suspicious link
    When the tutor evaluates the next turn
    Then the tutor protects or corrects the learner before proposing an assessment
    And the assessment cannot be the first response to the imminent unsafe action

  @T09 @U08 @D01 @D03
  Scenario: Teacher reviews and delivers an assessment as a tutor turn
    Given the tutor has generated a structured transfer assessment draft
    And the draft contains four options labelled A, B, C, and D
    When the teacher reviews and explicitly sends the draft
    Then the delivered tutor turn has mode assessment and instruction transfer_assess
    And the room participation mode remains tutoring
    And the learner can see only the stem, instruction, and four options
    And the answer key, transfer basis, and model rationale remain private

  @T09 @U14 @D02 @D05 @D06
  Scenario: The first valid delivered answer is graded by exact selection
    Given a delivered single-answer assessment has answer key B
    When the learner submits "B?" with an optional explanation
    Then the answer is graded as correct without requiring confidence
    And the assessment resolves exactly once
    And a later guess cannot create a second grade

  @T09 @D05 @D13
  Scenario: Ambiguity and assistance do not create a failing grade
    Given a delivered multiple-answer assessment has answer key B and D
    When the learner submits "B or D"
    Then the assessment remains unresolved and the tutor may clarify the format
    When the learner receives content help that could reveal the solution
    Then the assessment is cancelled as assisted without issuing a failing grade

  @T09 @U15 @D11
  Scenario: An unsent assessment is not delivered or gradable
    Given the tutor has generated an assessment draft
    And the teacher has not sent the draft
    When the learner submits an option in the existing chat
    Then the option is not graded
    And no assessment feedback is created
    And the learner progress pair is unchanged

  @T09 @U13 @D12
  Scenario: Feedback precedes another assessment
    Given the learner has answered and resolved one delivered assessment
    When the tutor generates the next response
    Then the next response is tutoring feedback or an independently required Guard response
    And it contains no new assessment payload
    And another assessment is not eligible until the feedback turn is delivered

  @T09 @U06 @U11 @U12
  Scenario: Verification and later contradiction update the same progress authority
    Given the learner demonstrates the concept in a meaningfully changed context
    When the tutor records spontaneous transfer
    Then the concept becomes covered with understanding_level good without requiring a quiz
    When a later learner message genuinely contradicts that understanding
    Then the concept reopens as needs_review with understanding_level basic
    And the tutor does not routinely reassess an already verified concept without new contradictory evidence
