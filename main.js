const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { Builder, By, until } = require('selenium-webdriver');
require('chromedriver'); // Ensure ChromeDriver is installed
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const { Database } = require('sqlite3');

// Enable electron-reload
require('electron-reload')(__dirname, {
  electron: path.join(__dirname, 'node_modules', '.bin', 'electron')
});

let mainWindow;

let driver;

/** @type {Database} */
let db;
async function loginToInstagram(username, password) {
  driver = await new Builder().forBrowser('chrome').build();
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

    await driver.wait(async () => {
      const currentUrl = await driver.getCurrentUrl();
      return !currentUrl.includes('www.instagram.com/accounts/login');
    }, 10000); // 10 seconds timeout
    
    console.log('Instagram login successful.');
    mainWindow.webContents.send('login-status', { success: true });

    // Create databases for the logged-in user
    db = createUserDatabases(username);

    


  } catch (err) {
    console.error('Error during Instagram login:', err);
    mainWindow.webContents.send('login-status', { success: false, error: err.message });
  } finally {
    // Close the browser after a delay (or when done)
    /*setTimeout(async () => {
      await driver.quit();
    }, 10000);*/ // Adjust delay as needed
  }
}

function createUserDatabases(username) {
  const dbName = username.replace(/[^a-zA-Z0-9]/g, '_'); // Sanitize username for use in filename
  //IMPORTANT: THIS MEANS THAT USERNAMES WITH IDENTICAL ALPLHANUMERIC (ex. matt_tang and matt.tang) cannot both be botted.
  //If it actually becomes a problem then I'll do some changes.
  const dbPath = `./databases/${dbName}.db`;

  // Create a new directory for databases if it doesn't exist
  if (!fs.existsSync('./databases')) {
    fs.mkdirSync('./databases');
  }

  // Open a new SQLite database connection
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
      return;
    }
    console.log(`Connected to the database for ${username}`);
  });

  // Create the required tables
  db.serialize(() => {
    // General table
    db.run(`CREATE TABLE IF NOT EXISTS general (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instagram_username TEXT,
      settings TEXT,
      followers TEXT,
      following TEXT
    )`);

    // Accounts table
    db.run(`CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      last_updated TEXT,
      followers_count INTEGER,
      following_count INTEGER,
      mutuals_count INTEGER,
      posts_count INTEGER,
      following_status TEXT,
      blacklisted INTEGER DEFAULT 0,
      user_interacted INTEGER DEFAULT 0,
      follows_me INTEGER DEFAULT 0,
      i_follow INTEGER DEFAULT 0
    )`);

    // Actions table
    db.run(`CREATE TABLE IF NOT EXISTS actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER,
      action_type TEXT,
      time TEXT
    )`);
  });

  return db;
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

  ipcMain.on('sql-action', (event, command) => {
    console.log("sql-action: command");

    db.run(command)

  })
});
