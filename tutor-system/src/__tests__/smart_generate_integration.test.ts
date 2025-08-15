/**
 * Integration test for Smart Generate checklist functionality
 * Tests the complete flow: navigate to room -> open checklist panel -> click Smart Generate -> verify success
 */

import { Builder, By, WebDriver, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';

const ROOM_URL = 'http://localhost:3000/room/cc187010-f419-45e5-969e-9c4750399877';
const TIMEOUT = 30000; // 30 seconds

describe('Smart Generate Checklist Integration', () => {
  let driver: WebDriver;

  beforeAll(async () => {
    // Configure Chrome options for headless testing
    const options = new chrome.Options();
    options.addArguments('--headless');
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');
    options.addArguments('--disable-gpu');
    options.addArguments('--window-size=1280,720');

    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
  });

  afterAll(async () => {
    if (driver) {
      await driver.quit();
    }
  });

  test('Smart Generate creates checklist successfully', async () => {
    console.log('🚀 Starting Smart Generate integration test...');

    // Navigate to room
    console.log('📍 Navigating to room...');
    await driver.get(ROOM_URL);
    
    // Wait for page to load
    await driver.wait(until.titleContains('Tutor System'), TIMEOUT);
    console.log('✅ Page loaded');

    // Wait for page to fully load and find any button that opens checklist
    await driver.sleep(3000); // Wait for React to fully render
    
    console.log('🔍 Looking for Learning Progress button (any variant)...');
    let checklistButton;
    
    try {
      // Try multiple possible button texts
      checklistButton = await driver.findElement(By.xpath("//button[contains(text(), 'Learning Progress Checklist')]"));
    } catch {
      try {
        checklistButton = await driver.findElement(By.xpath("//button[contains(text(), 'Learning Progress')]"));
      } catch {
        try {
          checklistButton = await driver.findElement(By.xpath("//button[contains(text(), 'Checklist')]"));
        } catch {
          // If no button found, let's check the page structure
          const pageText = await driver.findElement(By.tagName('body')).getText();
          console.log('📄 Page content:', pageText.substring(0, 500));
          throw new Error('Could not find Learning Progress button');
        }
      }
    }
    
    await checklistButton.click();
    console.log('✅ Clicked Learning Progress button');

    // Wait for checklist panel to open and find Smart Generate button
    console.log('🔍 Looking for Smart Generate button...');
    const smartGenerateButton = await driver.wait(
      until.elementLocated(By.xpath("//button[contains(text(), 'Smart Generate')]")),
      TIMEOUT
    );
    console.log('✅ Found Smart Generate button');

    // Click Smart Generate
    console.log('🧠 Clicking Smart Generate...');
    await smartGenerateButton.click();

    // Wait for loading state
    console.log('⏳ Waiting for checklist generation...');
    const loadingText = await driver.wait(
      until.elementLocated(By.xpath("//*[contains(text(), 'Loading checklist')]")),
      TIMEOUT
    );
    console.log('✅ Found loading state');

    // Wait for completion - either success or error
    console.log('🔍 Waiting for completion...');
    
    try {
      // Wait for either success (checklist items) or error message
      await driver.wait(async () => {
        const pageSource = await driver.getPageSource();
        
        // Check for success indicators
        const hasChecklistItems = pageSource.includes('Detection Areas') || pageSource.includes('Verification Steps');
        const hasProgressIndicator = pageSource.includes('Progress:') || pageSource.includes('completion');
        
        // Check for error indicators
        const hasError = pageSource.includes('Error:') || pageSource.includes('Failed to');
        const hasRetryButton = pageSource.includes('Retry');
        
        if (hasChecklistItems || hasProgressIndicator) {
          console.log('✅ Success: Found checklist content');
          return true;
        }
        
        if (hasError || hasRetryButton) {
          console.log('❌ Error detected in checklist generation');
          return true;
        }
        
        return false;
      }, TIMEOUT);

      // Get final page state for analysis
      const finalPageSource = await driver.getPageSource();
      
      // Check for success indicators
      const hasChecklistItems = finalPageSource.includes('Detection Areas') || finalPageSource.includes('Verification Steps');
      const hasProgressIndicator = finalPageSource.includes('Progress:') || finalPageSource.includes('completion');
      
      if (hasChecklistItems || hasProgressIndicator) {
        console.log('🎉 Test PASSED: Smart Generate created checklist successfully');
        
        // Get console logs for debugging
        const logs = await driver.manage().logs().get('browser');
        const smartGenerateLogs = logs.filter(log => 
          log.message.includes('Smart generation') || 
          log.message.includes('Created manual checklist') ||
          log.message.includes('checklistId')
        );
        
        console.log('📊 Relevant console logs:');
        smartGenerateLogs.forEach(log => {
          console.log(`  ${log.level.name}: ${log.message}`);
        });
        
        return;
      }
      
      // Check for specific error patterns
      const hasNullError = finalPageSource.includes('returned null');
      const hasUUIDError = finalPageSource.includes('invalid input syntax for type uuid');
      const hasRLSError = finalPageSource.includes('violates row-level security policy');
      
      if (hasNullError) {
        console.log('❌ Test FAILED: Null return error detected');
        throw new Error('Smart Generate failed with null return error');
      }
      
      if (hasUUIDError) {
        console.log('❌ Test FAILED: UUID error detected');
        throw new Error('Smart Generate failed with UUID error');
      }
      
      if (hasRLSError) {
        console.log('❌ Test FAILED: RLS policy error detected');
        throw new Error('Smart Generate failed with RLS policy error');
      }
      
      console.log('❌ Test FAILED: Unknown error or timeout');
      throw new Error('Smart Generate failed with unknown error');
      
    } catch (timeoutError) {
      console.log('⏰ Test TIMEOUT: Smart Generate did not complete within expected time');
      
      // Get console logs for debugging
      const logs = await driver.manage().logs().get('browser');
      console.log('📊 Console logs at timeout:');
      logs.slice(-10).forEach(log => {
        console.log(`  ${log.level.name}: ${log.message}`);
      });
      
      throw new Error('Smart Generate test timed out');
    }
  }, TIMEOUT * 2); // Double timeout for jest

  test('Manual Input creates checklist successfully', async () => {
    console.log('🚀 Starting Manual Input integration test...');

    // Navigate to room (fresh state)
    await driver.get(ROOM_URL);
    await driver.wait(until.titleContains('Tutor System'), TIMEOUT);

    // Open checklist panel
    await driver.sleep(3000); // Wait for React to fully render
    
    let checklistButton;
    try {
      checklistButton = await driver.findElement(By.xpath("//button[contains(text(), 'Learning Progress Checklist')]"));
    } catch {
      try {
        checklistButton = await driver.findElement(By.xpath("//button[contains(text(), 'Learning Progress')]"));
      } catch {
        checklistButton = await driver.findElement(By.xpath("//button[contains(text(), 'Checklist')]"));
      }
    }
    await checklistButton.click();

    // Click Manual Input
    const manualInputButton = await driver.wait(
      until.elementLocated(By.xpath("//button[contains(text(), 'Manual Input')]")),
      TIMEOUT
    );
    await manualInputButton.click();
    console.log('✅ Clicked Manual Input button');

    // Wait for manual input form
    const detectionAreaInput = await driver.wait(
      until.elementLocated(By.xpath("//textarea[contains(@placeholder, 'detection area') or contains(@placeholder, 'Detection area')]")),
      TIMEOUT
    );
    
    // Fill in test data
    await detectionAreaInput.sendKeys('Urgent language\nSuspicious links\nPersonal information requests');
    
    const verificationStepInput = await driver.findElement(
      By.xpath("//textarea[contains(@placeholder, 'verification step') or contains(@placeholder, 'Verification step')]")
    );
    await verificationStepInput.sendKeys('Check sender identity\nVerify URL legitimacy\nContact organization directly');

    // Submit the form
    const createButton = await driver.findElement(By.xpath("//button[contains(text(), 'Create Checklist')]"));
    await createButton.click();
    console.log('✅ Submitted manual checklist');

    // Wait for success
    await driver.wait(async () => {
      const pageSource = await driver.getPageSource();
      return pageSource.includes('Detection Areas') || pageSource.includes('Verification Steps');
    }, TIMEOUT);

    console.log('🎉 Manual Input test PASSED');
  }, TIMEOUT * 2);
});