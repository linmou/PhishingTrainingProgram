/**
 * Quick Smart Generate test - minimal version for fast feedback
 */

import { Builder, By, WebDriver, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';

const ROOM_URL = 'http://localhost:3000/room/cc187010-f419-45e5-969e-9c4750399877';

describe('Quick Smart Generate Test', () => {
  let driver: WebDriver;

  beforeAll(async () => {
    const options = new chrome.Options();
    options.addArguments('--headless');
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');

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

  test('can navigate to room and find basic elements', async () => {
    console.log('🚀 Quick test: navigating to room...');
    
    await driver.get(ROOM_URL);
    await driver.sleep(5000); // Wait for full load
    
    const title = await driver.getTitle();
    console.log('📄 Page title:', title);
    
    const pageText = await driver.findElement(By.tagName('body')).getText();
    console.log('📄 Page has text content:', pageText.length > 0);
    console.log('📄 First 200 chars:', pageText.substring(0, 200));
    
    // Check if we can find any buttons
    const buttons = await driver.findElements(By.tagName('button'));
    console.log('🔘 Found buttons:', buttons.length);
    
    if (buttons.length > 0) {
      for (let i = 0; i < Math.min(buttons.length, 5); i++) {
        const buttonText = await buttons[i].getText();
        console.log(`  Button ${i + 1}: "${buttonText}"`);
      }
    }
    
    expect(title).toContain('Tutor System');
    expect(buttons.length).toBeGreaterThan(0);
  }, 30000);

  test('can test Smart Generate if available', async () => {
    console.log('🧠 Testing Smart Generate if available...');
    
    // Add cache busting to ensure fresh code
    await driver.get(ROOM_URL + '?bust=' + Date.now());
    await driver.sleep(5000);
    
    // Look for Learning Progress button
    const buttons = await driver.findElements(By.tagName('button'));
    let foundLearningProgress = false;
    
    for (const button of buttons) {
      const text = await button.getText();
      if (text.includes('Learning Progress') || text.includes('Checklist')) {
        console.log(`✅ Found checklist button: "${text}"`);
        await button.click();
        foundLearningProgress = true;
        break;
      }
    }
    
    if (!foundLearningProgress) {
      console.log('⚠️ No Learning Progress button found, skipping Smart Generate test');
      return;
    }
    
    await driver.sleep(2000);
    
    // Look for Smart Generate button
    const allButtons = await driver.findElements(By.tagName('button'));
    let foundSmartGenerate = false;
    
    for (const button of allButtons) {
      const text = await button.getText();
      if (text.includes('Smart Generate')) {
        console.log(`✅ Found Smart Generate button: "${text}"`);
        await button.click();
        foundSmartGenerate = true;
        break;
      }
    }
    
    if (foundSmartGenerate) {
      console.log('🧠 Clicked Smart Generate, waiting for result...');
      await driver.sleep(10000); // Wait for processing
      
      // Get browser console logs
      const logs = await driver.manage().logs().get('browser');
      console.log('📊 ALL browser console logs:');
      logs.slice(-20).forEach(log => { // Show last 20 logs
        console.log(`  ${log.level.name}: ${log.message.substring(0, 150)}...`);
      });
      
      const relevantLogs = logs.filter(log => 
        log.message.includes('Created manual checklist') ||
        log.message.includes('Reading checklist') ||
        log.message.includes('Checklist query result') ||
        log.message.includes('First read returned null') ||
        log.message.includes('Smart generation') ||
        log.message.includes('Error:')
      );
      
      console.log('📊 Relevant logs:');
      relevantLogs.forEach(log => {
        console.log(`  ${log.level.name}: ${log.message}`);
      });
      
      const finalPageText = await driver.findElement(By.tagName('body')).getText();
      
      if (finalPageText.includes('Detection Areas') || finalPageText.includes('Verification Steps')) {
        console.log('🎉 SUCCESS: Smart Generate created checklist!');
      } else if (finalPageText.includes('Error:') || finalPageText.includes('Failed')) {
        console.log('❌ ERROR: Smart Generate failed');
        console.log('Error text:', finalPageText.substring(finalPageText.indexOf('Error'), finalPageText.indexOf('Error') + 200));
      } else {
        console.log('⏳ UNKNOWN: Smart Generate result unclear');
      }
    } else {
      console.log('⚠️ No Smart Generate button found');
    }
  }, 45000);
});