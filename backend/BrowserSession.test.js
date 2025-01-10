const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, './.env') });
const puppeteer = require("puppeteer-extra");

// add stealth plugin and use defaults (all evasion techniques)
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const BrowserSession = require('./BrowserSession');

let browser;
let wsEndpoint;
/** @type {BrowserSession} */
let browserSession;



beforeAll(async () => {
	browser = await puppeteer.launch({
		headless: false,
		product: "chrome",
		channel: "chrome",
		args: ["--no-sandbox", "--disable-setuid-sandbox"],
	}); //I don't know why these extra arguments are needed here, but whateves.
	wsEndpoint = browser.wsEndpoint();
    console.log(process.env.TEST_USERNAME, process.env.INSTAGRAM_USERNAME)
	browserSession = new BrowserSession(process.env.TEST_USERNAME, wsEndpoint);

    await browserSession.connectToBrowser();

});

afterAll(async () => {
	browser.close();
});


describe("Logs into Instagram", () => {
    test("If password fails, should throw error", async () => {
        console.log(browserSession.username);
        await expect(browserSession.loginToInstagram("wrongpassword"))
            .rejects
            .toThrow("Failed to log in to Instagram.");
        await new Promise(r => setTimeout(r,2000));
    });

    test("Should login successfully with correct credentials", async () => {
        await expect(browserSession.loginToInstagram(process.env.TEST_PASSWORD))
            .resolves
            .not.toThrow();
        
        expect(browserSession.loggedIn).toBe(true);
    });

    test("Should detect if already logged in", async () => {
        // Already logged in from previous test
        await browserSession.loginToInstagram(process.env.TEST_PASSWORD);
        expect(browserSession.loggedIn).toBe(true);
    });
});
