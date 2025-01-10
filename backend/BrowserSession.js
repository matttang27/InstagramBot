const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { randomDelay } = require("./helper");


class BrowserSession {
	constructor(username, wsEndpoint) {
		this.username = username;
		this.wsEndpoint = wsEndpoint;

		/** @type {Browser} */
		this.browser = null;

		/** @type {Page} */
		this.page = null;

		this.loggedIn = false;
	}

	/**
	 * Connects to an existing Chromium browser session via WebSocket.
	 * @returns {Promise<void>}
	 */
	async connectToBrowser() {
		try {
			// Connect to the browser using the WebSocket endpoint
			this.browser = await puppeteer.connect({ browserWSEndpoint: this.wsEndpoint });

			console.log("Connected to the browser using WebSocket endpoint!");

			// Get all open pages
			let pages = await this.browser.pages();
			if (pages.length !== 1) {
				throw new Error(`Expected one context, found ${pages.length}`);
			}

			// Bring the found page to the front
			this.page = pages[0];
			await this.page.bringToFront();
		} catch (err) {
			console.error("Error connecting to the browser:", err);
			throw new Error("Did you run chromiumserver.js?");
		}
	}

	/**
	 * Logs into Instagram using provided credentials.
	 * @param {string} password - Instagram password.
	 * @returns {Promise<void>}
	 */
	async loginToInstagram(password) {
		try {

			if (!password || typeof password !== 'string') {
				throw new Error('Password must be a non-empty string');
			}
			// Navigate to Instagram settings page, to see if it changes to login page
			//if it does change, sign-in, otherwise already signed in.
			await this.page.goto("https://www.instagram.com/accounts/edit/", { waitUntil: "networkidle2" });

			// Check if we're on the login page
			const loginRequired = await this.page.$('input[name="username"]');

			if (loginRequired) {
				console.log("Login required, entering credentials...");

				// Input username and password
				await this.page.type('input[name="username"]', this.username);
				await randomDelay();
				await this.page.type('input[name="password"]', password);
				await randomDelay();

				// Submit the login form
				await this.page.click('button[type="submit"]');
				await randomDelay();

				// Wait for the page to navigate after login
				await this.page.waitForNavigation({ timeout: 15000, waitUntil: "networkidle2" })

				console.log("Instagram login successful.");
				this.loggedIn = true;
			} else {
				console.log("Already logged in to Instagram.");
			}
		} catch (err) {
			console.error("Error during Instagram login:", err);
			throw new Error("Failed to log in to Instagram.");
		}
	}

	/**
	 * Fetches followers and following for the user.
	 * @returns {Promise<[string[], string[]]>} - Follower and following lists.
	 */
	async fetchFollowersAndFollowing() {
		try {
			console.log("Fetching list...")
			const userQueryRes = await this.page.evaluate(async (username) => {
				const userQueryRes = await fetch(
					`https://www.instagram.com/web/search/topsearch/?query=${username}`
				);
				return userQueryRes.json();
			}, this.username);

			const userId = userQueryRes.users[0].user.pk;
			let followers = [];
			let following = [];
			let after = null;
			let hasNext = true;

			// Fetch followers using pagination
			while (hasNext) {
				const res = await this.page.evaluate(
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

			// Fetch following using pagination
			after = null;
			hasNext = true;

			while (hasNext) {
				const res = await this.page.evaluate(
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
		} catch (err) {
			console.error("Error fetching followers/following:", err);
			throw new Error("Failed to fetch followers and following.");
		}
	}

	/**
	 * Gets profile data, including # of posts, followers, following & most importantly # of mutuals.
	 * @param {string} username
	 * @returns {Promise<{posts: number, followers: number, following: number, mutuals: number}>}
	 */
	async viewProfile(username) {
		try {
			await this.page.goto(`https://www.instagram.com/${username}`, {
				waitUntil: "networkidle2",
			});

			let data = await this.page.evaluate(async () => {
				let posts = parseInt(
					document
						.evaluate("//*[contains(text(), ' posts')]", document)
						.iterateNext()
						.children[0].innerText.replace(/,/g, "")
				);
				let followers = parseInt(
					document
						.evaluate("//*[contains(text(), ' followers')]", document)
						.iterateNext()
						.children[0].innerText.replace(/,/g, "")
				);
				let following = parseInt(
					document
						.evaluate("//*[contains(text(), ' following')]", document)
						.iterateNext()
						.children[0].innerText.replace(/,/g, "")
				);
				let mutualMessage = document
					.evaluate(`//*[contains(text(), 'Followed by')]`, document)
					.iterateNext()
					.innerText.split("+");
				//Usernames cannot have + signs
				//If there isn't a plus, could have 1 or 2 mutuals but doesn't matter
				let mutuals = (mutualMessage.length === 1 ? 0 : parseInt(mutualMessage[1]));

				return {posts: posts, followers: followers, following: following, mutuals: mutuals};
			});

			console.log(data);
			return data;
		} catch (err) {
			console.error("Failed to visit", username);
		}
	}

	async followUser(username) {
		try {
			await this.page.goto(`https://www.instagram.com/${username}/`, {
				waitUntil: "networkidle2",
			});

			await randomDelay();

			try {
				let button = await this.page.waitForSelector(
					`::-p-xpath(//header[1]//div[text()="Follow"]/parent::*/parent::*)`,
					{ timeout: 3000 }
				);

				await randomDelay();
				await button.click();
			} catch {
				let button = await this.page.waitForSelector(
					`::-p-xpath(//header[1]//div[text()="Follow Back"]/parent::*/parent::*)`,
					{ timeout: 3000 }
				);

				await randomDelay();
				await button.click();
			}
			
			console.log(`Successfully requested follow for ${username}`);
			await new Promise(r => setTimeout(r,2000));
		} catch (err) {
			console.error(err);
		}
	}

	async unfollowUser(username) {
		//unfollow if requested or following
		try {
			await this.page.goto(`https://www.instagram.com/${username}/`);
			let button;
			await randomDelay();
			try {
				button = await this.page.waitForSelector(
					`::-p-xpath(//header[1]//div[text()="Following"]/parent::*/parent::*)`,
					{ timeout: 3000 }
				);
				await randomDelay();
				await button.click();

				

				let unfollowButton = await this.page.waitForSelector(
					`::-p-xpath(//span[text()="Unfollow"]/parent::*/parent::*/parent::*/parent::*/parent::*/parent::*/parent::*/parent::*)`,
					{ timeout: 3000 }
				);
				await randomDelay();
				await unfollowButton.click();

				console.log(`Successfully unfollowed ${username}`);
				return 'unfollowed'
			} catch (err) {
				button = await this.page.waitForSelector(
					`::-p-xpath(//header[1]//div[text()="Requested"]/parent::*/parent::*)`,
					{ timeout: 3000 }
				);
				await randomDelay();
				await button.click();

				let unfollowButton = await this.page.waitForSelector(
					`::-p-xpath(//button[text()="Unfollow"])`,
					{ timeout: 3000 }
				);
				await randomDelay();
				await unfollowButton.click();
				console.log(`Successfully unrequested ${username}`);
				return 'unrequested'
			}
		} catch (err) {
			console.error(err);
		}
	}

	/**
	 * Gets a list of followers of a person you follow.
	 * As the chance of you having lots of mutuals with a person gets lower the more nonmutual people you see
	 * Use the limit variable to stop searching.
	 *
	 *
	 * @param {string} username
	 * @param {number} limit
	 * @returns {[[string,string]]} - a collection of users and the current follow status with them
	 * We already know the following & follower status of everyone, so this helps with whether they're requested.
	 */
	
	async getFollowers(username, limit) {
		console.log("Getting followers of mutual")
		//TODO: Check if this handles people who have requested to follow you
		try {

			let userData = await this.viewProfile(username) ;
			await this.page.goto(`https://www.instagram.com/${username}`, {
				waitUntil: "networkidle2",
			});
			//get followers button (wanna make this shorter)
			let button = await this.page.waitForSelector(
				`::-p-xpath(//li[contains(., ' followers')])`,
				{ timeout: 1000 }
			);
			console.log("FOUND!");
			await randomDelay();
			await button.click();
			await randomDelay();

			let users = await this.page.evaluate(async (limit) => {
				//the scrollbox is three parents above
				let users = [];
				let notFollowedCount = 0;
				let openUsers = document.getElementsByClassName("x1dm5mii");
				if (openUsers.length === 0) {
					return users;
				}
				let scrollBox = openUsers[0].parentElement.parentElement.parentElement;

				while (true) {
					await new Promise((r) => setTimeout(r, Math.random() * 1000 + 1000));
					//if no new users appeared from the scrollbox
					if (openUsers.length - 1 <= users.length) {
						break;
					}
					if (notFollowedCount > limit) {
						break;
					}
					//skip first user, usually us
					for (var i = users.length + 1; i < openUsers.length; i++) {
						let button = openUsers[i].getElementsByTagName("button")[0];
						let buttonContent = button.textContent;
						if (buttonContent === "Follow") {
							notFollowedCount++;
						}
						//trust the process
						let username =
							button.parentElement.parentElement.previousSibling.firstChild.firstChild
								.firstChild.textContent;
						users.push([username, buttonContent]);
					}
					scrollBox.scrollBy(0, 2000);
				}

				return users;
			}, limit);

			console.log(users);
			return users;
		} catch (err) {
			console.error(err);
		}
	}

	/**
	 * Closes the browser session.
	 * @returns {Promise<void>}
	 */
	async closeBrowser() {
		if (this.browser) {
			try {
				await this.browser.close();
				console.log("Browser closed.");
			} catch (err) {
				console.error("Error closing the browser:", err);
			}
		}
	}
}

module.exports = BrowserSession;
