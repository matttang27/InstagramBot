// puppeteer-extra is a drop-in replacement for puppeteer,
// it augments the installed puppeteer with plugin functionality
const puppeteer = require('puppeteer-extra')

// add stealth plugin and use defaults (all evasion techniques)
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

const fs = require('fs');



(async function () {
    const browser = await puppeteer.launch({headless: false});
    const wsEndpoint = browser.wsEndpoint();

    fs.writeFileSync('ws.txt', wsEndpoint, 'utf8');
    console.log('WebSocket endpoint saved to ws.txt');

    await new Promise(() => {});
    console.log("BYE");

    
})();