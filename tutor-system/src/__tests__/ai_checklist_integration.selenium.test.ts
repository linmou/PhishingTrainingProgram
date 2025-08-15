/**
 * Selenium End-to-End Tests for AI Checklist Integration
 * TDD Red Phase: Writing failing tests first
 * 
 * These tests validate the browser-level interactions for:
 * - LLM extracting knowledge points from system prompts 
 * - AI detecting coverage in student responses
 * - AI adapting responses based on checklist progress
 * - Checklist UI updates reflecting AI coverage detection
 */

import { Builder, WebDriver, By, until, WebElement } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';

describe('AI Checklist Integration - Selenium E2E Tests', () => {
  let driver: WebDriver;
  const baseUrl = 'http://localhost:3000';
  
  // Increase timeout for all tests
  jest.setTimeout(60000);
  
  beforeAll(async () => {
    // Configure Chrome options for headless testing
    const options = new chrome.Options();
    options.addArguments('--headless');
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');
    options.addArguments('--disable-gpu');
    options.addArguments('--window-size=1920,1080');
    
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
      
    // Set implicit wait
    await driver.manage().setTimeouts({ implicit: 10000 });
  });

  afterAll(async () => {
    if (driver) {
      await driver.quit();
    }
  });

  beforeEach(async () => {
    // Start fresh for each test
    await driver.get(baseUrl);
    // Wait for initial page load
    await driver.wait(until.elementLocated(By.css('body')), 5000);
  });

  describe('LLM extracts knowledge points from system prompt', () => {
    it('should extract cognitive understanding points from phishing training system prompt', async () => {
      // This test will fail initially - Red phase
      
      // Navigate to tutor view and set up a room with a system prompt
      await navigateToTutorView();
      const roomId = await createTestRoom();
      
      // Set system prompt with phishing training content
      const systemPrompt = `
        You are helping students identify phishing attempts. Guide them to:
        - Understand how attackers create urgency to pressure victims
        - Recognize suspicious URLs and domains  
        - Learn to manually verify sender authenticity
        - Always hover over links before clicking
        - Report suspicious content to appropriate authorities
      `;
      
      await setSystemPrompt(roomId, systemPrompt);
      
      // Wait for LLM processing and checklist generation
      await waitForChecklistGeneration();
      
      // Verify extracted understanding items appear in checklist
      const checklistPanel = await driver.findElement(By.className('checklist-panel'));
      
      // Check for cognitive understanding points
      const urgencyItem = await checklistPanel.findElement(
        By.xpath('//span[contains(text(), "Urgency manipulation techniques")]')
      );
      expect(await urgencyItem.isDisplayed()).toBe(true);
      
      const urlAnalysisItem = await checklistPanel.findElement(
        By.xpath('//span[contains(text(), "URL and domain analysis")]')
      );
      expect(await urlAnalysisItem.isDisplayed()).toBe(true);
      
      const authVerificationItem = await checklistPanel.findElement(
        By.xpath('//span[contains(text(), "Sender authenticity verification methods")]')
      );
      expect(await authVerificationItem.isDisplayed()).toBe(true);
      
      // Verify behavioral action points
      const hoverBehaviorItem = await checklistPanel.findElement(
        By.xpath('//span[contains(text(), "Hover over links before clicking")]')
      );
      expect(await hoverBehaviorItem.isDisplayed()).toBe(true);
      
      const reportBehaviorItem = await checklistPanel.findElement(
        By.xpath('//span[contains(text(), "Report suspicious content to authorities")]')
      );
      expect(await reportBehaviorItem.isDisplayed()).toBe(true);
    });

    it('should categorize mixed cognitive and behavioral content correctly', async () => {
      // This test will fail initially - Red phase
      
      await navigateToTutorView();
      const roomId = await createTestRoom();
      
      const mixedPrompt = `
        Students should understand social engineering tactics and know to verify information through official channels
      `;
      
      await setSystemPrompt(roomId, mixedPrompt);
      await waitForChecklistGeneration();
      
      const checklistPanel = await driver.findElement(By.className('checklist-panel'));
      
      // Verify understanding item with [understanding] prefix
      const understandingItem = await checklistPanel.findElement(
        By.xpath('//span[contains(text(), "[understanding] Social engineering tactics recognition")]')
      );
      expect(await understandingItem.isDisplayed()).toBe(true);
      
      // Verify behavioral item with [behavior] prefix  
      const behaviorItem = await checklistPanel.findElement(
        By.xpath('//span[contains(text(), "[behavior] Verify information through official channels")]')
      );
      expect(await behaviorItem.isDisplayed()).toBe(true);
    });
  });

  describe('AI detects coverage in student responses', () => {
    it('should automatically detect URL verification understanding in student chat', async () => {
      // This test will fail initially - Red phase
      
      // Set up room with tutor and student
      await setupRoomWithTutorAndStudent();
      
      // Navigate to student view
      await switchToStudentView();
      
      // Student sends a message demonstrating URL verification understanding
      const chatInput = await driver.findElement(By.className('chat-input'));
      const studentResponse = 'I noticed the link goes to goo.gl instead of nintendo.com, which seems suspicious';
      
      await chatInput.sendKeys(studentResponse);
      await chatInput.submit();
      
      // Wait for AI processing and response
      await waitForAIResponse();
      
      // Switch to tutor view to check checklist updates
      await switchToTutorView();
      
      // Verify checklist item status changed to "covered"
      const urlVerificationItem = await driver.findElement(
        By.xpath('//span[contains(text(), "URL verification techniques")]/../following-sibling::*//select')
      );
      const selectedValue = await urlVerificationItem.getAttribute('value');
      expect(selectedValue).toBe('covered');
      
      // Verify coverage evidence is recorded
      const evidenceButton = await driver.findElement(
        By.xpath('//span[contains(text(), "URL verification techniques")]/..//button[@title="View evidence"]')
      );
      expect(await evidenceButton.isDisplayed()).toBe(true);
    });

    it('should detect behavioral demonstration and update checklist', async () => {
      // This test will fail initially - Red phase
      
      await setupRoomWithTutorAndStudent();
      await switchToStudentView();
      
      // Student demonstrates hovering behavior
      const chatInput = await driver.findElement(By.className('chat-input'));
      const behaviorDemo = 'I hovered over the link and saw it was going to a different site than expected';
      
      await chatInput.sendKeys(behaviorDemo);
      await chatInput.submit();
      
      await waitForAIResponse();
      await switchToTutorView();
      
      // Verify behavioral item marked as covered
      const hoverBehaviorItem = await driver.findElement(
        By.xpath('//span[contains(text(), "Hover over links before clicking")]/../following-sibling::*//select')
      );
      const behaviorStatus = await hoverBehaviorItem.getAttribute('value');
      expect(behaviorStatus).toBe('covered');
      
      // Check for coverage evidence with specific marker
      const latestMessage = await driver.findElement(By.css('.chat-message:last-child .message-content'));
      const messageText = await latestMessage.getText();
      expect(messageText).toContain('[COVERAGE: hover_verification');
      expect(messageText).toContain('Student demonstrated safe link checking behavior');
    });
  });

  describe('AI adapts responses based on checklist progress', () => {
    it('should include current learning progress in system prompt context', async () => {
      // This test will fail initially - Red phase
      
      await setupRoomWithMixedProgress();
      await switchToStudentView();
      
      // Student asks a question
      const chatInput = await driver.findElement(By.className('chat-input'));
      await chatInput.sendKeys('What makes this message suspicious?');
      await chatInput.submit();
      
      await waitForAIResponse();
      
      // Verify AI response focuses on pending/partially covered items
      const aiResponse = await driver.findElement(By.css('.chat-message.ai:last-child .message-content'));
      const responseText = await aiResponse.getText();
      
      // Should focus on pending items like business logic evaluation
      expect(responseText).toContain('business logic');
      expect(responseText).toContain('report suspicious content');
      
      // Should only lightly reference covered items
      expect(responseText).not.toContain('URL verification techniques');
    });

    it('should provide differentiated feedback for understanding vs behavior', async () => {
      // This test will fail initially - Red phase
      
      await setupRoomWithTutorAndStudent();
      await switchToStudentView();
      
      // Student demonstrates both cognitive understanding and behavioral application
      const chatInput = await driver.findElement(By.className('chat-input'));
      const combinedResponse = 'I recognized the urgency language and then verified by going to the official website';
      
      await chatInput.sendKeys(combinedResponse);
      await chatInput.submit();
      
      await waitForAIResponse();
      
      // Verify AI acknowledges both dimensions in response
      const aiResponse = await driver.findElement(By.css('.chat-message.ai:last-child .message-content'));
      const responseText = await aiResponse.getText();
      
      expect(responseText).toContain('[understanding]');
      expect(responseText).toContain('[behavior]');
      expect(responseText).toContain('knowledge translates into safe behavior');
    });
  });

  describe('Checklist UI integration', () => {
    it('should show progress updates in real-time as student demonstrates understanding', async () => {
      // This test will fail initially - Red phase
      
      await setupRoomWithTutorAndStudent();
      
      // Open tutor view in split screen to watch checklist updates
      await switchToTutorView();
      const initialProgress = await getProgressPercentage();
      
      // Switch to student and demonstrate understanding
      await switchToStudentView();
      const chatInput = await driver.findElement(By.className('chat-input'));
      await chatInput.sendKeys('That $19.99 is way too cheap for a Switch that costs $300');
      await chatInput.submit();
      
      await waitForAIResponse();
      
      // Check that progress percentage increased
      await switchToTutorView();
      const updatedProgress = await getProgressPercentage();
      expect(updatedProgress).toBeGreaterThan(initialProgress);
      
      // Verify specific item status changed
      const businessLogicItem = await driver.findElement(
        By.xpath('//span[contains(text(), "Business logic evaluation")]')
      );
      const itemContainer = await businessLogicItem.findElement(By.xpath('./../../..'));
      const statusIcon = await itemContainer.findElement(By.className('status-icon'));
      const iconClass = await statusIcon.getAttribute('class');
      expect(iconClass).toContain('covered');
    });

    it('should handle multiple simultaneous coverage detections', async () => {
      // This test will fail initially - Red phase
      
      await setupRoomWithTutorAndStudent();
      await switchToStudentView();
      
      // Student demonstrates multiple skills in one response
      const chatInput = await driver.findElement(By.className('chat-input'));
      const multiSkillResponse = 'I checked the sender\'s email, hovered over the link, and saw both were suspicious';
      
      await chatInput.sendKeys(multiSkillResponse);
      await chatInput.submit();
      
      await waitForAIResponse();
      
      // Verify AI detected multiple coverage areas
      const aiResponse = await driver.findElement(By.css('.chat-message.ai:last-child .message-content'));
      const responseText = await aiResponse.getText();
      
      expect(responseText).toContain('[COVERAGE: sender_verification');
      expect(responseText).toContain('[COVERAGE: link_hover_behavior');
      expect(responseText).toContain('[COVERAGE: suspicious_indicator_synthesis');
      
      // Check multiple checklist items updated
      await switchToTutorView();
      const senderItem = await driver.findElement(
        By.xpath('//span[contains(text(), "Check sender")]/../following-sibling::*//select')
      );
      const hoverItem = await driver.findElement(
        By.xpath('//span[contains(text(), "Hover over links")]/../following-sibling::*//select')
      );
      
      expect(await senderItem.getAttribute('value')).toBe('covered');
      expect(await hoverItem.getAttribute('value')).toBe('covered');
    });
  });

  // Debug helper to see what's on the page
  async function debugPageElements(): Promise<void> {
    try {
      console.log('=== PAGE DEBUG INFO ===');
      const title = await driver.getTitle();
      const url = await driver.getCurrentUrl();
      console.log(`Title: ${title}`);
      console.log(`URL: ${url}`);
      
      // Find all buttons
      const buttons = await driver.findElements(By.css('button'));
      console.log(`Found ${buttons.length} buttons:`);
      for (let i = 0; i < Math.min(buttons.length, 10); i++) {
        try {
          const text = await buttons[i].getText();
          const visible = await buttons[i].isDisplayed();
          console.log(`  Button ${i}: "${text}" (visible: ${visible})`);
        } catch (e) {
          console.log(`  Button ${i}: Error getting text`);
        }
      }
      
      // Find elements with "Learning" or "Progress" text
      const learningElements = await driver.findElements(By.xpath('//*[contains(text(), "Learning") or contains(text(), "Progress")]'));
      console.log(`Found ${learningElements.length} elements with "Learning" or "Progress":`);
      for (let elem of learningElements) {
        try {
          const text = await elem.getText();
          const tagName = await elem.getTagName();
          console.log(`  ${tagName}: "${text}"`);
        } catch (e) {
          console.log('  Element: Error getting text');
        }
      }
      console.log('=== END DEBUG INFO ===');
    } catch (e) {
      console.log('Debug failed:', e.message);
    }
  }

  // Helper functions for test setup
  async function navigateToTutorView(): Promise<void> {
    // Navigate directly to Nintendo Switch room we explored
    await driver.get(`${baseUrl}/room/910b9930-df5a-43c7-ac85-68394aaf6ccb`);
    
    // Wait for initial page load
    await driver.wait(until.elementLocated(By.css('body')), 10000);
    
    // Wait for content to appear (ignore persistent loading elements)
    await driver.wait(async () => {
      try {
        // Look for buttons that indicate the page is interactive
        const buttons = await driver.findElements(By.css('button'));
        
        // Check if we have a reasonable number of buttons (room interface should have many)
        if (buttons.length < 10) {
          return false;
        }
        
        // Check for specific room elements
        const roomElements = await driver.findElements(By.xpath('//*[contains(text(), "Nintendo Switch") or contains(text(), "Learning Progress")]'));
        return roomElements.length > 0;
      } catch (e) {
        return false;
      }
    }, 20000);
    
    // Additional wait for buttons to be interactive
    await driver.sleep(2000);
    console.log('Successfully navigated to room and content loaded');
    
    // Debug what elements are present
    await debugPageElements();
  }

  async function createTestRoom(): Promise<string> {
    // We're not creating a new room, just using the first available room
    // Return the current room ID from URL
    try {
      const currentUrl = await driver.getCurrentUrl();
      const roomMatch = currentUrl.match(/\/room\/([^\/\?]+)/);
      return roomMatch ? roomMatch[1] : 'room-1';
    } catch (e) {
      return 'room-1'; // Default room ID
    }
  }

  async function setSystemPrompt(roomId: string, prompt: string): Promise<void> {
    try {
      // Click AI Assistant Settings button  
      const aiSettingsButton = await driver.findElement(By.xpath('//button[contains(text(), "AI Assistant Settings")]'));
      await aiSettingsButton.click();
      
      // Wait for settings modal to open
      await driver.wait(until.elementLocated(By.xpath('//heading[contains(text(), "AI Assistant Settings")]')), 5000);
      
      // Find system prompt textarea and update it
      const promptTextarea = await driver.findElement(By.xpath('//text[contains(text(), "System Prompt")]/following-sibling::textbox'));
      await promptTextarea.clear();
      await promptTextarea.sendKeys(prompt);
      
      // Save the settings
      const saveButton = await driver.findElement(By.xpath('//button[contains(text(), "Save Settings")]'));
      await saveButton.click();
      
      console.log('Successfully updated system prompt');
    } catch (e) {
      console.log('Could not set system prompt through UI:', e.message);
    }
  }

  async function waitForChecklistGeneration(): Promise<void> {
    try {
      // Use the proven approach from the simple test
      // First try to find any element with "Learning Progress" text
      const learningElements = await driver.findElements(By.xpath('//*[contains(text(), "Learning Progress")]'));
      
      let checklistButton = null;
      if (learningElements.length > 0) {
        checklistButton = learningElements[0]; // Use first found element
        console.log(`Found Learning Progress element`);
      } else {
        // Fallback: try to find Learning button
        const learningButtons = await driver.findElements(By.xpath('//button[contains(text(), "Learning")]'));
        if (learningButtons.length > 0) {
          checklistButton = learningButtons[0];
          console.log(`Found Learning button as fallback`);
        }
      }
      
      if (!checklistButton) {
        throw new Error('Could not find Learning Progress button');
      }
      
      // Click the button
      await driver.executeScript("arguments[0].click();", checklistButton);
      await driver.sleep(1000); // Wait for panel animation
      
      // Wait for checklist panel content to appear
      await driver.wait(async () => {
        try {
          const panelTexts = await driver.findElements(By.xpath('//*[contains(text(), "Smart Generate") or contains(text(), "No checklist found")]'));
          return panelTexts.length > 0;
        } catch (e) {
          return false;
        }
      }, 10000);
      
      console.log('Checklist panel opened successfully');
    } catch (e) {
      console.log('Could not open checklist panel:', e.message);
      throw e; // Re-throw to see the actual error in tests
    }
  }

  async function setupRoomWithTutorAndStudent(): Promise<void> {
    // Navigate to tutor view of first available room
    await navigateToTutorView();
    const roomId = await createTestRoom();
    
    // Wait for the room page to load completely
    await driver.wait(until.elementLocated(By.css('.room-container, .tutor-view, main')), 10000);
    
    // Look for checklist panel or wait for it to load
    try {
      await waitForChecklistGeneration();
    } catch (e) {
      console.log('Checklist panel not found, room may not have checklist enabled');
    }
  }

  async function switchToStudentView(): Promise<void> {
    // Navigate to student view - may need to open new tab/window or switch roles
    try {
      const studentButton = await driver.findElement(
        By.xpath('//button[contains(text(), "Student") or contains(text(), "student")]')
      );
      await studentButton.click();
    } catch (e) {
      // If no role switch available, may need to simulate student interface
      console.log('Could not switch to student view, continuing with current view');
    }
  }

  async function switchToTutorView(): Promise<void> {
    try {
      const tutorButton = await driver.findElement(
        By.xpath('//button[contains(text(), "Tutor") or contains(text(), "tutor")]')
      );
      await tutorButton.click();
    } catch (e) {
      console.log('Could not switch to tutor view, continuing with current view');
    }
  }

  async function waitForAIResponse(): Promise<void> {
    // Wait for AI response to appear in chat
    await driver.wait(until.elementLocated(By.css('.chat-message.ai, .message.ai, .ai-response')), 10000);
    
    // Wait a bit longer for any coverage analysis to complete
    await driver.sleep(2000);
  }

  async function setupRoomWithMixedProgress(): Promise<void> {
    await setupRoomWithTutorAndStudent();
    
    // Simulate some progress by having student demonstrate understanding
    await switchToStudentView();
    const chatInput = await driver.findElement(By.className('chat-input'));
    await chatInput.sendKeys('I understand how URLs can be suspicious');
    await chatInput.submit();
    await waitForAIResponse();
  }

  async function getProgressPercentage(): Promise<number> {
    try {
      // Look for progress percentage in the checklist panel
      const progressText = await driver.findElement(By.css('.progress-text, .completion-percentage'));
      const text = await progressText.getText();
      const match = text.match(/(\d+(?:\.\d+)?)%/);
      return match ? parseFloat(match[1]) : 0;
    } catch (e) {
      return 0;
    }
  }
});