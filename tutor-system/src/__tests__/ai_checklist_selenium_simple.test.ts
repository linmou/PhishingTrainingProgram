/**
 * Simplified Selenium Test for AI Checklist Integration
 * Focus on debugging and getting basic automation working
 */

import { Builder, WebDriver, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';

describe('AI Checklist Integration - Simple Selenium Test', () => {
  let driver: WebDriver;
  const baseUrl = 'http://localhost:3000';
  
  // Shorter timeout for debugging
  jest.setTimeout(30000);
  
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
      
    await driver.manage().setTimeouts({ implicit: 5000 });
  });

  afterAll(async () => {
    if (driver) {
      await driver.quit();
    }
  });

  it('should navigate to room and find basic elements', async () => {
    console.log('Starting basic navigation test...');
    
    // Navigate to the Nintendo Switch room directly
    await driver.get(`${baseUrl}/room/910b9930-df5a-43c7-ac85-68394aaf6ccb`);
    console.log('Navigated to room URL');
    
    // Wait for page to load
    await driver.wait(until.elementLocated(By.css('body')), 10000);
    console.log('Body element found');
    
    // Wait for either loading to complete or content to appear
    await driver.wait(async () => {
      try {
        const loadingElements = await driver.findElements(By.xpath('//*[contains(text(), "Loading")]'));
        console.log(`Found ${loadingElements.length} loading elements`);
        
        const allButtons = await driver.findElements(By.css('button'));
        console.log(`Found ${allButtons.length} buttons total`);
        
        // If no loading and we have buttons, page is ready
        return loadingElements.length === 0 && allButtons.length > 0;
      } catch (e) {
        return false;
      }
    }, 15000);
    
    console.log('Page loading completed');
    
    // Get page info
    const title = await driver.getTitle();
    const url = await driver.getCurrentUrl();
    console.log(`Title: ${title}`);
    console.log(`URL: ${url}`);
    
    // Find all buttons and log them
    const buttons = await driver.findElements(By.css('button'));
    console.log(`\n=== FOUND ${buttons.length} BUTTONS ===`);
    
    for (let i = 0; i < buttons.length; i++) {
      try {
        const text = await buttons[i].getText();
        const isVisible = await buttons[i].isDisplayed();
        const isEnabled = await buttons[i].isEnabled();
        console.log(`Button ${i}: "${text}" (visible: ${isVisible}, enabled: ${isEnabled})`);
      } catch (e) {
        console.log(`Button ${i}: Error - ${e.message}`);
      }
    }
    
    // Look for Learning Progress specifically
    console.log('\n=== SEARCHING FOR LEARNING PROGRESS ===');
    const learningSelectors = [
      'button:contains("Learning Progress")',
      'button:contains("Learning")',
      'button:contains("Progress")',
      '*:contains("Learning Progress")',
      '[data-testid="learning-progress"]',
      '.learning-progress',
      '#learning-progress'
    ];
    
    for (const selector of learningSelectors) {
      try {
        const elements = await driver.findElements(By.css(selector));
        console.log(`Selector "${selector}": found ${elements.length} elements`);
      } catch (e) {
        console.log(`Selector "${selector}": error - ${e.message}`);
      }
    }
    
    // Try XPath selectors
    const xpathSelectors = [
      '//button[contains(text(), "Learning Progress")]',
      '//button[contains(text(), "Learning")]',
      '//button[contains(text(), "Progress")]',
      '//*[contains(text(), "Learning Progress")]',
      '//*[contains(text(), "Learning") and contains(text(), "Progress")]'
    ];
    
    console.log('\n=== TRYING XPATH SELECTORS ===');
    for (const selector of xpathSelectors) {
      try {
        const elements = await driver.findElements(By.xpath(selector));
        console.log(`XPath "${selector}": found ${elements.length} elements`);
        for (let elem of elements) {
          try {
            const text = await elem.getText();
            const tag = await elem.getTagName();
            console.log(`  ${tag}: "${text}"`);
          } catch (e) {
            console.log(`  Element: error getting text`);
          }
        }
      } catch (e) {
        console.log(`XPath "${selector}": error - ${e.message}`);
      }
    }
    
    // Basic assertion - we should have found the page
    expect(title).toContain('Tutor System');
    expect(buttons.length).toBeGreaterThan(0);
    
    console.log('Basic navigation test completed successfully');
  });

  it('should find and click Learning Progress button', async () => {
    console.log('Starting Learning Progress button test...');
    
    // Navigate to room
    await driver.get(`${baseUrl}/room/910b9930-df5a-43c7-ac85-68394aaf6ccb`);
    await driver.wait(until.elementLocated(By.css('body')), 10000);
    
    // Wait for page to be ready
    await driver.wait(async () => {
      const buttons = await driver.findElements(By.css('button'));
      return buttons.length > 0;
    }, 15000);
    
    // Extra wait for dynamic content
    await driver.sleep(3000);
    
    console.log('Looking for Learning Progress button...');
    
    // Try to find Learning Progress button with various strategies
    let learningProgressButton = null;
    
    // Strategy 1: Find button containing "Learning Progress"
    try {
      learningProgressButton = await driver.findElement(By.xpath('//button[contains(text(), "Learning Progress")]'));
      console.log('Found button with "Learning Progress" text');
    } catch (e) {
      console.log('Strategy 1 failed: ', e.message);
    }
    
    // Strategy 2: Find any element with "Learning Progress" 
    if (!learningProgressButton) {
      try {
        const elements = await driver.findElements(By.xpath('//*[contains(text(), "Learning Progress")]'));
        if (elements.length > 0) {
          learningProgressButton = elements[0];
          console.log('Found element with "Learning Progress" text');
        }
      } catch (e) {
        console.log('Strategy 2 failed: ', e.message);
      }
    }
    
    // Strategy 3: Find button with just "Learning" 
    if (!learningProgressButton) {
      try {
        learningProgressButton = await driver.findElement(By.xpath('//button[contains(text(), "Learning")]'));
        console.log('Found button with "Learning" text');
      } catch (e) {
        console.log('Strategy 3 failed: ', e.message);
      }
    }
    
    if (learningProgressButton) {
      console.log('Found Learning Progress button, attempting click...');
      
      // Try to click it
      try {
        await learningProgressButton.click();
        console.log('Successfully clicked Learning Progress button');
        
        // Wait for something to happen (modal/panel to open)
        await driver.sleep(2000);
        
        // Look for evidence that the panel opened
        const panelElements = await driver.findElements(By.xpath('//*[contains(text(), "Smart Generate") or contains(text(), "Manual Input") or contains(text(), "checklist")]'));
        console.log(`Found ${panelElements.length} potential panel elements after click`);
        
        expect(panelElements.length).toBeGreaterThan(0);
      } catch (e) {
        console.log('Click failed: ', e.message);
        throw e;
      }
    } else {
      console.log('Could not find Learning Progress button with any strategy');
      
      // Take a screenshot for debugging (if needed)
      const screenshot = await driver.takeScreenshot();
      console.log('Screenshot taken (base64 length):', screenshot.length);
      
      throw new Error('Learning Progress button not found');
    }
  });
});