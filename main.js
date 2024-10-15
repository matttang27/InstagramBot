const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { Builder, By, until } = require('selenium-webdriver');
require('chromedriver'); // Ensure ChromeDriver is installed

let mainWindow;

async function loginToInstagram(username, password) {
  let driver = await new Builder().forBrowser('chrome').build();
  try {
    // Navigate to Instagram login page
    await driver.get('https://www.instagram.com/accounts/login/');

    // Wait for the login form to load and input the username
    await driver.wait(until.elementLocated(By.name('username')), 10000);
    const usernameInput = await driver.findElement(By.name('username'));
    await usernameInput.sendKeys(username);

    // Input the password
    const passwordInput = await driver.findElement(By.name('password'));
    await passwordInput.sendKeys(password);

    // Submit the form
    const loginButton = await driver.findElement(By.css('button[type="submit"]'));
    await loginButton.click();

    console.log('Instagram login attempted with username:', username);
  } catch (err) {
    console.error('Error during Instagram login:', err);
  } finally {
    // Close the browser after a delay (or when done)
    setTimeout(async () => {
      await driver.quit();
    }, 10000); // Adjust delay as needed
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, // Important for security
      contextIsolation: true, // Use contextBridge for IPC
    },
  });

  mainWindow.loadURL('http://localhost:3000');
}

app.on('ready', () => {
  createWindow();

  // Listen for the 'login-instagram' event from React (Renderer Process)
  ipcMain.on('login-instagram', (event, { username, password }) => {
    console.log('Received login data:', username, password);
    // Call the Selenium login function
    loginToInstagram(username, password);
  });
});
