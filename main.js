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
    //loginToInstagram(username, password);
  });

  ipcMain.on('sql-action', (event, command) => {
    console.log("sql-action: command");

    //db.run(command)

  })
});
