// Puppeteer-extra is an enhanced version of Puppeteer that allows adding plugins
// It augments Puppeteer with plugin functionality, such as evasion techniques to avoid detection.
const puppeteer = require("puppeteer-extra");

// Stealth Plugin helps to avoid detection by evading techniques used by websites to identify bots.
// It applies various evasion tactics such as masking the user agent and modifying browser fingerprints.
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const { Page, Browser } = require("puppeteer");
const { randomDelay } = require("./helper");
const {addAction} = require("./database");
/**
 * Connects to an existing Chromium browser session via WebSocket (ws.txt).
 * This allows for connecting to a headless browser instance running elsewhere.
 * If no pages are found or connection fails, logs an error message.
 *
 * @type {string} wsEndpoint
 * @returns {Promise<[Browser,Page]>}
 */
async function connectToBrowser(wsEndpoint,db) {
	try {
		// Connect to the browser using the wsEndpoint
		const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });

		console.log("Connected to the browser using WebSocket endpoint!");

		// Get all open browser pages/tabs
		let pages = await browser.pages();
		if (pages.length !== 1) {
			throw new Error(`Expected one context, found ${pages.length}`);
		}

		// Bring the found page to the front
		let page = pages[0];
		await page.bringToFront();

        addAction(db,-1,"start",new Date().toISOString())

		return [browser, page];
	} catch (err) {
		console.log(err);
		console.log("Did you run chromiumserver.js?");
		throw new Error();
	}
}

/**
 * Logs into Instagram using provided credentials by navigating to the login page,
 * inputting the username/password, and submitting the form. After a successful login,
 * it creates an SQLite database to store user-related data (followers, following, etc.).
 *
 * @param {Page} page
 * @param {string} username - Instagram username.
 * @param {string} password - Instagram password.
 */
async function loginToInstagram(page, username, password) {
	try {
		// Navigate to Instagram login page and wait for network to be idle
		await page.goto("https://www.instagram.com/accounts/login/", {
			waitUntil: "networkidle2",
		});

		// Input username and password with delays to simulate human behavior
		await page.type('input[name="username"]', username);
		await randomDelay();
		await page.type('input[name="password"]', password);
		await randomDelay();

		// Submit the login form by clicking the login button
		await page.click('button[type="submit"]');
		await randomDelay();

		// Wait for the page to navigate after login
		await page.waitForNavigation({ timeout: 10000, waitUntil: "networkidle2" });

		console.log("Instagram login successful.");
	} catch (err) {
		console.error("Error during Instagram login:", err);
		throw new Error();
	}
}

/**
 * Fetches both followers and followings for a user by their ID. It handles
 * pagination to retrieve large lists of followers/following and returns
 * the combined lists.
 *
 * @param {Page} username
 * @param {string} username - The Instagram username to fetch followers and followings for.
 * @returns {Promise<[string[],string[]]>} - An object containing arrays of follower and following data.
 */
async function fetchFollowersAndFollowing(page, username) {
	const userQueryRes = await page.evaluate(async (username) => {
		const userQueryRes = await fetch(
			`https://www.instagram.com/web/search/topsearch/?query=${username}`
		);
		return userQueryRes.json();
	}, username);

	const userId = userQueryRes.users[0].user.pk;

	let followers = [];
	let following = [];
	let after = null;
	let hasNext = true;

	// Fetch followers using pagination
	while (hasNext) {
		const res = await page.evaluate(
			async (userId, after) => {
				const response = await fetch(
					`https://www.instagram.com/graphql/query/?query_hash=c76146de99bb02f6415203be841dd25a&variables=` +
						encodeURIComponent(
							JSON.stringify({
								id: userId,
								include_reel: true,
								fetch_mutual: true,
								first: 50,
								after: after,
							})
						)
				);
				return response.json();
			},
			userId,
			after
		);

		hasNext = res.data.user.edge_followed_by.page_info.has_next_page;
		after = res.data.user.edge_followed_by.page_info.end_cursor;
		followers = followers.concat(
			res.data.user.edge_followed_by.edges.map(({ node }) => node.username)
		);
	}

	// Reset and fetch following using pagination
	after = null;
	hasNext = true;

	while (hasNext) {
		const res = await page.evaluate(
			async (userId, after) => {
				const response = await fetch(
					`https://www.instagram.com/graphql/query/?query_hash=d04b0a864b4b54837c0d870b0e77e076&variables=` +
						encodeURIComponent(
							JSON.stringify({
								id: userId,
								include_reel: true,
								fetch_mutual: true,
								first: 50,
								after: after,
							})
						)
				);
				return response.json();
			},
			userId,
			after
		);

		hasNext = res.data.user.edge_follow.page_info.has_next_page;
		after = res.data.user.edge_follow.page_info.end_cursor;
		following = following.concat(
			res.data.user.edge_follow.edges.map(({ node }) => node.username)
		);
	}

	return [followers, following];
}

module.exports = {
	connectToBrowser,
	loginToInstagram,
	fetchFollowersAndFollowing,
};
