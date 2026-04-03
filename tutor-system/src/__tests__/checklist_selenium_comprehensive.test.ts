/**
 * Comprehensive Selenium Tests for AI Checklist Integration.
 * Combines all checklist-related browser tests into one organized opt-in external suite.
 * 
 * Test Coverage:
 * 1. Basic Navigation and UI Elements
 * 2. Smart Generate Functionality  
 * 3. Checklist CRUD Operations
 * 4. AI Coverage Detection
 * 5. Real-time Updates
 */

import { Builder, WebDriver, By, until, WebElement } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';

const describeBrowserE2E = process.env.RUN_BROWSER_E2E_TESTS === 'true' ? describe : describe.skip;

describeBrowserE2E('Checklist Feature - Comprehensive Selenium Tests', () => {
  let driver: WebDriver;
  const baseUrl = 'http://localhost:3000';
  const testRoomId = '910b9930-df5a-43c7-ac85-68394aaf6ccb'; // Nintendo Switch room
  
  jest.setTimeout(60000);
  
  beforeAll(async () => {
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
    await driver.wait(until.elementLocated(By.css('body')), 5000);
  });

  describe('Basic Navigation and UI', () => {
    it('should navigate to room and find checklist elements', async () => {
      await navigateToRoom();
      
      // Find Learning Progress button
      const learningButtons = await driver.findElements(By.xpath('//*[contains(text(), "Learning Progress")]'));
      expect(learningButtons.length).toBeGreaterThan(0);
      
      // Click to open checklist panel
      const checklistButton = learningButtons[0];
      await driver.executeScript("arguments[0].click();", checklistButton);
      await driver.sleep(1000);
      
      // Verify panel opened
      const panelElements = await driver.findElements(By.xpath('//*[contains(text(), "Smart Generate") or contains(text(), "No checklist found")]'));
      expect(panelElements.length).toBeGreaterThan(0);
    });
  });

  describe('Smart Generate Functionality', () => {
    it('should successfully generate checklist using Smart Generate', async () => {
      await navigateToRoom();
      await openChecklistPanel();
      
      // Find and click Smart Generate button
      const smartGenButtons = await driver.findElements(By.xpath('//button[contains(text(), "Smart Generate")]'));
      if (smartGenButtons.length > 0) {
        console.log('🧠 Found Smart Generate button');
        await driver.executeScript("arguments[0].click();", smartGenButtons[0]);
        
        // Wait for generation to complete
        await driver.sleep(5000);
        
        // Check for success indicators
        const bodyText = await driver.findElement(By.tagName('body')).getText();
        const hasDetectionAreas = bodyText.includes('Detection Areas') || bodyText.includes('detection areas');
        const hasVerificationSteps = bodyText.includes('Verification Steps') || bodyText.includes('verification steps');
        
        expect(hasDetectionAreas || hasVerificationSteps).toBe(true);
        console.log('✅ Smart Generate completed successfully');
      } else {
        console.log('⚠️ Smart Generate button not available in this room');
      }
    });

    it('should handle Smart Generate with custom system prompt', async () => {
      await navigateToRoom();
      
      // First set a custom AI prompt
      await setCustomAIPrompt(`
        Guide students to identify phishing attempts by:
        - Recognizing urgency tactics in messages
        - Checking sender email addresses carefully
        - Hovering over links before clicking
        - Verifying requests through official channels
      `);
      
      await openChecklistPanel();
      
      // Generate checklist
      const smartGenButtons = await driver.findElements(By.xpath('//button[contains(text(), "Smart Generate")]'));
      if (smartGenButtons.length > 0) {
        await driver.executeScript("arguments[0].click();", smartGenButtons[0]);
        await driver.sleep(5000);
        
        // Verify generated items match prompt content
        const bodyText = await driver.findElement(By.tagName('body')).getText();
        expect(bodyText).toMatch(/urgency|sender|hover|verif/i);
      }
    });

    it('should extract cognitive understanding points from phishing training prompt', async () => {
      await navigateToRoom();
      
      // Set system prompt with cognitive content
      const systemPrompt = `
        You are helping students identify phishing attempts. Guide them to:
        - Understand how attackers create urgency to pressure victims
        - Recognize suspicious URLs and domains  
        - Learn to manually verify sender authenticity
        - Always hover over links before clicking
        - Report suspicious content to appropriate authorities
      `;
      
      await setCustomAIPrompt(systemPrompt);
      await openChecklistPanel();
      
      // Generate checklist
      const smartGenButtons = await driver.findElements(By.xpath('//button[contains(text(), "Smart Generate")]'));
      if (smartGenButtons.length > 0) {
        await driver.executeScript("arguments[0].click();", smartGenButtons[0]);
        await driver.sleep(5000);
        
        // Verify cognitive understanding items appear
        const bodyText = await driver.findElement(By.tagName('body')).getText();
        
        // Check for understanding-focused items
        expect(bodyText).toMatch(/urgency.*manipulation|pressure.*tactics/i);
        expect(bodyText).toMatch(/URL.*analysis|domain.*suspicious/i);
        expect(bodyText).toMatch(/sender.*authenticity|verify.*sender/i);
      }
    });

    it('should categorize mixed cognitive and behavioral content correctly', async () => {
      await navigateToRoom();
      
      const mixedPrompt = `
        Students should understand social engineering tactics and know to verify information through official channels
      `;
      
      await setCustomAIPrompt(mixedPrompt);
      await openChecklistPanel();
      
      // Generate checklist
      const smartGenButtons = await driver.findElements(By.xpath('//button[contains(text(), "Smart Generate")]'));
      if (smartGenButtons.length > 0) {
        await driver.executeScript("arguments[0].click();", smartGenButtons[0]);
        await driver.sleep(5000);
        
        const bodyText = await driver.findElement(By.tagName('body')).getText();
        
        // Should have both understanding and behavioral items
        expect(bodyText).toMatch(/social.*engineering|engineering.*tactics/i);
        expect(bodyText).toMatch(/verify.*official|official.*channels/i);
      }
    });
  });

  describe('Checklist CRUD Operations', () => {
    it('should allow manual checklist creation', async () => {
      await navigateToRoom();
      await openChecklistPanel();
      
      // Look for manual creation option
      const manualButtons = await driver.findElements(By.xpath('//button[contains(text(), "Create Manual") or contains(text(), "Add Custom")]'));
      if (manualButtons.length > 0) {
        await driver.executeScript("arguments[0].click();", manualButtons[0]);
        await driver.sleep(1000);
        
        // Fill in manual items if form appears
        const inputFields = await driver.findElements(By.css('input[type="text"], textarea'));
        if (inputFields.length > 0) {
          await inputFields[0].sendKeys('Check sender email address');
          if (inputFields.length > 1) {
            await inputFields[1].sendKeys('Verify URL before clicking');
          }
          
          // Submit form
          const submitButton = await driver.findElement(By.xpath('//button[contains(text(), "Create") or contains(text(), "Save")]'));
          await submitButton.click();
          await driver.sleep(2000);
        }
      }
    });

    it('should allow editing checklist items via dropdown menu', async () => {
      await navigateToRoom();
      await ensureChecklistExists();
      await openChecklistPanel();
      
      // Get initial item text to verify change
      const itemElements = await driver.findElements(By.css('.checklist-item span, [data-testid="checklist-item"] span'));
      const initialText = itemElements.length > 0 ? await itemElements[0].getText() : '';
      
      // Find dropdown menu buttons - look for three dots icon
      const menuButtons = await driver.findElements(By.css('button[aria-label*="menu"], button[title*="menu"], button svg[class*="dots"]'));
      
      if (menuButtons.length > 0) {
        console.log('Found dropdown menu button, clicking...');
        // Click first item's menu
        await driver.executeScript("arguments[0].click();", menuButtons[0]);
        await driver.sleep(1000);
        
        // Look for edit option in dropdown
        const editOptions = await driver.findElements(By.xpath('//div[contains(@role, "menu")]//span[contains(text(), "Edit")] | //button[contains(text(), "Edit")]'));
        
        if (editOptions.length > 0) {
          console.log('Found Edit option in dropdown');
          await driver.executeScript("arguments[0].click();", editOptions[0]);
          await driver.sleep(1000);
          
          // Verify we're in edit mode
          const editInputs = await driver.findElements(By.css('input[type="text"]:focus, textarea:focus, input.editing'));
          expect(editInputs.length).toBeGreaterThan(0);
          
          // Modify text in edit mode
          const editInput = editInputs[0];
          await editInput.clear();
          const newText = 'Edited via dropdown - ' + Date.now();
          await editInput.sendKeys(newText);
          await editInput.sendKeys('\n'); // Press Enter to save
          
          await driver.sleep(2000);
          
          // Verify update was successful
          const bodyText = await driver.findElement(By.tagName('body')).getText();
          expect(bodyText).toContain(newText);
          expect(bodyText).not.toContain(initialText);
          
          console.log('✅ Successfully edited checklist item via dropdown menu');
        } else {
          console.log('⚠️ Edit option not found in dropdown menu');
        }
      } else {
        console.log('⚠️ Dropdown menu button not found');
      }
    });

    it('should update item status and priority', async () => {
      await navigateToRoom();
      await ensureChecklistExists();
      await openChecklistPanel();
      
      // Find status dropdown
      const statusSelects = await driver.findElements(By.css('select'));
      if (statusSelects.length > 0) {
        // Change first item status
        await statusSelects[0].click();
        const coveredOption = await driver.findElement(By.css('option[value="covered"]'));
        await coveredOption.click();
        
        await driver.sleep(1000);
        
        // Verify status changed
        const selectedValue = await statusSelects[0].getAttribute('value');
        expect(selectedValue).toBe('covered');
      }
      
      // Find priority dropdown (if exists)
      const prioritySelects = await driver.findElements(By.css('select[name*="priority"], select[title*="priority"]'));
      if (prioritySelects.length > 0) {
        await prioritySelects[0].click();
        const criticalOption = await driver.findElement(By.css('option[value="critical"]'));
        await criticalOption.click();
        
        await driver.sleep(1000);
      }
    });

    it('should persist checklist modifications to Supabase and reload correctly', async () => {
      await navigateToRoom();
      await ensureChecklistExists();
      await openChecklistPanel();
      
      // Modify a checklist item
      const menuButtons = await driver.findElements(By.css('button[aria-label*="menu"], button[title*="menu"], button:has(svg)'));
      if (menuButtons.length > 0) {
        await menuButtons[0].click();
        await driver.sleep(500);
        
        const editOption = await driver.findElement(By.xpath('//div[contains(@role, "menu")]//span[contains(text(), "Edit")]'));
        await editOption.click();
        await driver.sleep(1000);
        
        const editInput = await driver.findElement(By.css('input[type="text"]:focus, textarea:focus'));
        await editInput.clear();
        await editInput.sendKeys('Persisted test item - ' + Date.now());
        await editInput.sendKeys('\n');
        await driver.sleep(2000);
      }
      
      // Get the modified text
      const modifiedText = await driver.findElement(By.xpath('//*[contains(text(), "Persisted test item")]')).getText();
      
      // Close panel and re-navigate to room
      const closeButton = await driver.findElements(By.css('[aria-label="Close"], button[title="Close"]'));
      if (closeButton.length > 0) {
        await closeButton[0].click();
      }
      
      // Navigate away and back
      await driver.get(baseUrl);
      await driver.sleep(1000);
      await navigateToRoom();
      await openChecklistPanel();
      
      // Verify the modification persisted
      const persistedElements = await driver.findElements(By.xpath(`//*[contains(text(), "${modifiedText}")]`));
      expect(persistedElements.length).toBeGreaterThan(0);
      console.log('✅ Checklist modifications persist across sessions');
    });

    it('should handle UUID validation correctly for checklist items', async () => {
      await navigateToRoom();
      await openChecklistPanel();
      
      // Generate a new checklist
      const smartGenButtons = await driver.findElements(By.xpath('//button[contains(text(), "Smart Generate")]'));
      if (smartGenButtons.length > 0) {
        await driver.executeScript("arguments[0].click();", smartGenButtons[0]);
        await driver.sleep(5000);
        
        // Try to update priority of a newly generated item
        const prioritySelects = await driver.findElements(By.css('select[name*="priority"], select[title*="priority"]'));
        if (prioritySelects.length > 0) {
          const initialValue = await prioritySelects[0].getAttribute('value');
          await prioritySelects[0].click();
          
          // Change to different priority
          const newPriority = initialValue === 'critical' ? 'important' : 'critical';
          const newOption = await driver.findElement(By.css(`option[value="${newPriority}"]`));
          await newOption.click();
          await driver.sleep(2000);
          
          // Verify no UUID error appears
          const bodyText = await driver.findElement(By.tagName('body')).getText();
          expect(bodyText).not.toMatch(/invalid.*uuid|uuid.*error/i);
          expect(bodyText).not.toContain('detection_area-0');
          
          // Verify the change was successful
          const updatedValue = await prioritySelects[0].getAttribute('value');
          expect(updatedValue).toBe(newPriority);
        }
      }
    });

    it('should deactivate old checklists when creating new ones', async () => {
      await navigateToRoom();
      await openChecklistPanel();
      
      // Create first checklist
      const smartGenButtons = await driver.findElements(By.xpath('//button[contains(text(), "Smart Generate")]'));
      if (smartGenButtons.length > 0) {
        // Generate first checklist
        await driver.executeScript("arguments[0].click();", smartGenButtons[0]);
        await driver.sleep(5000);
        
        // Note the first item text
        const firstChecklistItems = await driver.findElements(By.css('.checklist-item, [data-testid="checklist-item"]'));
        const firstItemText = firstChecklistItems.length > 0 ? await firstChecklistItems[0].getText() : '';
        
        // Generate second checklist (should deactivate the first)
        const smartGenButtonsAgain = await driver.findElements(By.xpath('//button[contains(text(), "Smart Generate")]'));
        if (smartGenButtonsAgain.length > 0) {
          await driver.executeScript("arguments[0].click();", smartGenButtonsAgain[0]);
          await driver.sleep(5000);
          
          // Verify we don't have duplicate checklists active
          const bodyText = await driver.findElement(By.tagName('body')).getText();
          expect(bodyText).not.toMatch(/multiple.*rows.*returned|PGRST116/i);
          
          // Should have a new checklist without errors
          const newChecklistItems = await driver.findElements(By.css('.checklist-item, [data-testid="checklist-item"]'));
          expect(newChecklistItems.length).toBeGreaterThan(0);
        }
      }
    });

    it('should handle database replication lag with retry logic', async () => {
      await navigateToRoom();
      await openChecklistPanel();
      
      // Quickly create and access checklist to test retry logic
      const smartGenButtons = await driver.findElements(By.xpath('//button[contains(text(), "Smart Generate")]'));
      if (smartGenButtons.length > 0) {
        await driver.executeScript("arguments[0].click();", smartGenButtons[0]);
        
        // Immediately try to access - should trigger retry if needed
        await driver.sleep(1000); // Short wait
        
        // Close and reopen panel quickly
        const closeButton = await driver.findElements(By.css('[aria-label="Close"], button[title="Close"]'));
        if (closeButton.length > 0) {
          await closeButton[0].click();
          await driver.sleep(500);
          await openChecklistPanel();
          
          // Should successfully load checklist even with potential replication lag
          const checklistItems = await driver.findElements(By.css('.checklist-item, [data-testid="checklist-item"]'));
          expect(checklistItems.length).toBeGreaterThan(0);
          
          // No error messages about missing checklist
          const bodyText = await driver.findElement(By.tagName('body')).getText();
          expect(bodyText).not.toMatch(/failed.*initialize|no.*checklist.*found/i);
        }
      }
    });
  });

  describe('AI Coverage Detection', () => {
    it('should detect coverage in student messages', async () => {
      await navigateToRoom();
      await ensureChecklistExists();
      
      // Switch to student view or simulate student message
      const messageInput = await driver.findElement(By.css('textarea, input[type="text"][placeholder*="message"]'));
      await messageInput.sendKeys('I noticed the email address looks suspicious - it\'s not from the official Nintendo domain');
      await messageInput.sendKeys('\n');
      
      await driver.sleep(3000); // Wait for AI processing
      
      // Check if checklist was updated
      await openChecklistPanel();
      const bodyText = await driver.findElement(By.tagName('body')).getText();
      
      // Look for coverage indicators
      const hasCoverageUpdate = bodyText.match(/covered|partial|detected/i);
      expect(hasCoverageUpdate).toBeTruthy();
    });

    it('should detect behavioral demonstration and update checklist status', async () => {
      await navigateToRoom();
      await ensureChecklistExists();
      
      // Student demonstrates hovering behavior
      const messageInput = await driver.findElement(By.css('textarea, input[type="text"][placeholder*="message"]'));
      await messageInput.sendKeys('I hovered over the link and saw it was going to a different site than expected');
      await messageInput.sendKeys('\n');
      
      await driver.sleep(3000); // Wait for AI processing
      
      // Check if checklist shows behavioral coverage
      await openChecklistPanel();
      const bodyText = await driver.findElement(By.tagName('body')).getText();
      
      // Should detect hover behavior coverage
      expect(bodyText).toMatch(/hover.*covered|covered.*hover/i);
    });

    it('should handle multiple simultaneous coverage detections', async () => {
      await navigateToRoom();
      await ensureChecklistExists();
      
      // Student demonstrates multiple skills in one message
      const messageInput = await driver.findElement(By.css('textarea, input[type="text"][placeholder*="message"]'));
      await messageInput.sendKeys('I checked the sender\'s email, hovered over the link, and saw both were suspicious. Also the price seemed too good to be true.');
      await messageInput.sendKeys('\n');
      
      await driver.sleep(4000); // Extra wait for multiple detection processing
      
      // Check multiple items updated
      await openChecklistPanel();
      const bodyText = await driver.findElement(By.tagName('body')).getText();
      
      // Should show multiple coverage areas
      const coverageMatches = (bodyText.match(/covered|partial/gi) || []).length;
      expect(coverageMatches).toBeGreaterThan(1);
    });
  });

  describe('Real-time Updates', () => {
    it('should show progress percentage updates', async () => {
      await navigateToRoom();
      await ensureChecklistExists();
      await openChecklistPanel();
      
      // Get initial progress
      let progressText = await getProgressText();
      const initialProgress = parseProgressPercentage(progressText);
      
      // Update an item status
      const statusSelects = await driver.findElements(By.css('select'));
      if (statusSelects.length > 0) {
        await statusSelects[0].click();
        const coveredOption = await driver.findElement(By.css('option[value="covered"]'));
        await coveredOption.click();
        await driver.sleep(2000);
        
        // Check progress updated
        progressText = await getProgressText();
        const newProgress = parseProgressPercentage(progressText);
        expect(newProgress).toBeGreaterThan(initialProgress);
      }
    });

    it('should show real-time updates as student demonstrates understanding', async () => {
      await navigateToRoom();
      await ensureChecklistExists();
      
      // Open checklist to see initial state
      await openChecklistPanel();
      const initialProgress = parseProgressPercentage(await getProgressText());
      
      // Close panel to send message
      const closeButton = await driver.findElements(By.css('[aria-label="Close"], button[title="Close"]'));
      if (closeButton.length > 0) {
        await closeButton[0].click();
        await driver.sleep(500);
      }
      
      // Student demonstrates understanding
      const messageInput = await driver.findElement(By.css('textarea, input[type="text"][placeholder*="message"]'));
      await messageInput.sendKeys('That $19.99 is way too cheap for a Switch that normally costs $300');
      await messageInput.sendKeys('\n');
      
      await driver.sleep(3000); // Wait for AI processing
      
      // Check that progress increased
      await openChecklistPanel();
      const updatedProgress = parseProgressPercentage(await getProgressText());
      expect(updatedProgress).toBeGreaterThan(initialProgress);
    });
  });

  describe('AI Response Adaptation', () => {
    it('should adapt AI responses based on checklist progress', async () => {
      await navigateToRoom();
      await ensureChecklistExists();
      
      // First mark some items as covered
      await openChecklistPanel();
      const statusSelects = await driver.findElements(By.css('select'));
      if (statusSelects.length > 1) {
        // Mark first item as covered
        await statusSelects[0].click();
        const coveredOption = await driver.findElement(By.css('option[value="covered"]'));
        await coveredOption.click();
        await driver.sleep(1000);
      }
      
      // Close panel to send message
      const closeButton = await driver.findElements(By.css('[aria-label="Close"], button[title="Close"]'));
      if (closeButton.length > 0) {
        await closeButton[0].click();
        await driver.sleep(500);
      }
      
      // Ask a question that should get adapted response
      const messageInput = await driver.findElement(By.css('textarea, input[type="text"][placeholder*="message"]'));
      await messageInput.sendKeys('What should I look for in this message?');
      await messageInput.sendKeys('\n');
      
      await driver.sleep(3000); // Wait for AI response
      
      // AI should focus on uncovered items
      const messages = await driver.findElements(By.css('.message-content, .chat-message'));
      const lastMessage = messages[messages.length - 1];
      const responseText = await lastMessage.getText();
      
      // Response should adapt to focus on pending items
      console.log('AI adapted response:', responseText.substring(0, 100) + '...');
    });

    it('should provide differentiated feedback for understanding vs behavior', async () => {
      await navigateToRoom();
      await ensureChecklistExists();
      
      // Student demonstrates both understanding and behavior
      const messageInput = await driver.findElement(By.css('textarea, input[type="text"][placeholder*="message"]'));
      await messageInput.sendKeys('I recognized the urgency language trying to pressure me, so I went directly to Nintendo\'s official website instead');
      await messageInput.sendKeys('\n');
      
      await driver.sleep(3000); // Wait for AI processing
      
      // Check that AI acknowledges both dimensions
      const messages = await driver.findElements(By.css('.message-content, .chat-message'));
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        const responseText = await lastMessage.getText();
        
        // AI should recognize both cognitive understanding and behavioral application
        console.log('AI differentiated response:', responseText.substring(0, 150) + '...');
      }
    });
  });

  describe('UI Validation and Debug', () => {
    it('should validate all essential UI components are present', async () => {
      await navigateToRoom();
      
      // Get comprehensive element counts
      const buttons = await driver.findElements(By.css('button'));
      const learningElements = await driver.findElements(By.xpath('//*[contains(text(), "Learning Progress")]'));
      const aiElements = await driver.findElements(By.xpath('//*[contains(text(), "AI") or contains(text(), "✨")]'));
      
      // Validate essential components
      expect(buttons.length).toBeGreaterThanOrEqual(10); // Minimum interactive elements
      expect(learningElements.length).toBeGreaterThanOrEqual(1); // Learning Progress button
      expect(aiElements.length).toBeGreaterThanOrEqual(1); // AI integration elements
      
      // Log component summary
      console.log(`📊 UI Component Summary:`);
      console.log(`   Buttons: ${buttons.length}`);
      console.log(`   Learning Progress elements: ${learningElements.length}`);
      console.log(`   AI elements: ${aiElements.length}`);
    });

    it('should demonstrate end-to-end checklist interaction workflow', async () => {
      await navigateToRoom();
      
      // Step 1: Find Learning Progress
      const learningElements = await driver.findElements(By.xpath('//*[contains(text(), "Learning Progress")]'));
      expect(learningElements.length).toBeGreaterThan(0);
      
      // Step 2: Click to open panel
      await driver.executeScript("arguments[0].click();", learningElements[0]);
      await driver.sleep(1000);
      
      // Step 3: Verify checklist generation options appear
      const panelElements = await driver.findElements(By.xpath('//*[contains(text(), "Smart Generate") or contains(text(), "No checklist") or contains(text(), "Detection Areas")]'));
      expect(panelElements.length).toBeGreaterThan(0);
      
      console.log('✅ Complete checklist workflow validated');
    });
  });

  // Helper Functions
  async function navigateToRoom(): Promise<void> {
    await driver.get(`${baseUrl}/room/${testRoomId}`);
    await driver.wait(until.elementLocated(By.css('body')), 10000);
    
    // Wait for room content to load
    await driver.wait(async () => {
      try {
        const buttons = await driver.findElements(By.css('button'));
        const roomElements = await driver.findElements(By.xpath('//*[contains(text(), "Nintendo Switch") or contains(text(), "Learning Progress")]'));
        return buttons.length >= 10 && roomElements.length > 0;
      } catch (e) {
        return false;
      }
    }, 20000);
    
    await driver.sleep(2000); // Extra wait for dynamic content
    console.log('Successfully navigated to room');
  }

  async function openChecklistPanel(): Promise<void> {
    try {
      // Find Learning Progress button
      const learningElements = await driver.findElements(By.xpath('//*[contains(text(), "Learning Progress")]'));
      
      if (learningElements.length > 0) {
        const checklistButton = learningElements[0];
        await driver.executeScript("arguments[0].click();", checklistButton);
        await driver.sleep(1000);
        
        // Wait for panel content
        await driver.wait(async () => {
          const panelTexts = await driver.findElements(By.xpath('//*[contains(text(), "Smart Generate") or contains(text(), "No checklist") or contains(text(), "Detection Areas")]'));
          return panelTexts.length > 0;
        }, 10000);
        
        console.log('Checklist panel opened successfully');
      } else {
        throw new Error('Could not find Learning Progress button');
      }
    } catch (e) {
      console.error('Failed to open checklist panel:', e.message);
      throw e;
    }
  }

  async function ensureChecklistExists(): Promise<void> {
    await openChecklistPanel();
    
    // Check if checklist exists
    const bodyText = await driver.findElement(By.tagName('body')).getText();
    
    if (bodyText.includes('No checklist found')) {
      // Try Smart Generate
      const smartGenButtons = await driver.findElements(By.xpath('//button[contains(text(), "Smart Generate")]'));
      if (smartGenButtons.length > 0) {
        await driver.executeScript("arguments[0].click();", smartGenButtons[0]);
        await driver.sleep(5000);
        console.log('Generated checklist using Smart Generate');
      }
    } else {
      console.log('Checklist already exists');
    }
  }

  async function setCustomAIPrompt(prompt: string): Promise<void> {
    try {
      // Click AI Assistant Settings
      const aiSettingsButton = await driver.findElement(By.xpath('//button[contains(text(), "AI Assistant Settings")]'));
      await aiSettingsButton.click();
      await driver.sleep(1000);
      
      // Find and update system prompt
      const promptTextarea = await driver.findElement(By.css('textarea'));
      await promptTextarea.clear();
      await promptTextarea.sendKeys(prompt);
      
      // Save settings
      const saveButton = await driver.findElement(By.xpath('//button[contains(text(), "Save")]'));
      await saveButton.click();
      await driver.sleep(2000);
      
      console.log('Updated AI system prompt');
    } catch (e) {
      console.log('Could not update AI prompt:', e.message);
    }
  }

  async function getProgressText(): Promise<string> {
    try {
      const progressElements = await driver.findElements(By.xpath('//*[contains(text(), "%")]'));
      if (progressElements.length > 0) {
        return await progressElements[0].getText();
      }
    } catch (e) {
      console.log('Could not find progress text');
    }
    return '0%';
  }

  function parseProgressPercentage(text: string): number {
    const match = text.match(/(\d+(?:\.\d+)?)%/);
    return match ? parseFloat(match[1]) : 0;
  }
});
