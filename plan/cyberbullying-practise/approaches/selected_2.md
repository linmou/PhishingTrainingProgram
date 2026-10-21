# Assigned approach
Intent: condition one independent implementation plan.

## 2. practice-adapter-boundary
- Candidate name: practice-adapter-boundary
- Core strategy: Extract a narrow typed practice adapter interface consumed by the room controller; phishing and Cyberbullying implementations supply generation/progress/configuration policies.
- Primary optimization target: Make subject-specific coupling explicit and independently testable
- Decomposition boundary: Adapter boundary between shared room workflow and practice behavior
- Sequencing principle: Characterize existing behavior, extract phishing adapter, then implement Cyberbullying adapter
- Main tradeoff: Additional abstraction and refactor before feature value
- Major risk: Interface grows into an unnecessary plugin framework
