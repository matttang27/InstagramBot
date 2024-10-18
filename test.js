// Puppeteer-extra is an enhanced version of Puppeteer that allows adding plugins
// It augments Puppeteer with plugin functionality, such as evasion techniques to avoid detection.
const puppeteer = require("puppeteer-extra");

// Stealth Plugin helps to avoid detection by evading techniques used by websites to identify bots.
// It applies various evasion tactics such as masking the user agent and modifying browser fingerprints.
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const sqlite3 = require("sqlite3").verbose(); // SQLite3 module for database management
const fs = require("fs"); // File system module for reading/writing files
const { Browser, Page } = require("puppeteer");
const { Database } = require("sqlite3");

/** @type {Database} - SQLite3 Database connection object */
let db;

/** @type {Browser} - Puppeteer Browser instance */
let browser;

/** @type {Page} - Puppeteer Page instance, representing a browser tab */
let page;

/** Instagram login credentials (change accordingly) */
const username = "*******";
const password = "*******";

/**
 * Generates a random delay between `min` and `max` milliseconds to simulate human-like interactions.
 * This can help avoid detection as bots by introducing randomness into script actions.
 *
 * @param {number} [min=1000] - Minimum delay in milliseconds (default 1000ms).
 * @param {number} [max=2000] - Maximum delay in milliseconds (default 2000ms).
 * @returns {Promise} - A promise that resolves after the delay.
 */
function randomDelay(min = 1000, max = 2000) {
	return new Promise((r) => setTimeout(r, Math.random() * (max - min) + min));
}

/**
 * Connects to an existing Chromium browser session via WebSocket (ws.txt).
 * This allows for connecting to a headless browser instance running elsewhere.
 * If no pages are found or connection fails, logs an error message.
 */
async function connectToBrowser() {
	try {
		// Read WebSocket endpoint from file
		const wsEndpoint = fs.readFileSync("ws.txt", "utf8");
		console.log("WebSocket endpoint read from ws.txt:", wsEndpoint);

		// Connect to the browser using the wsEndpoint
		browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });

		console.log("Connected to the browser using WebSocket endpoint!");

		// Get all open browser pages/tabs
		let pages = await browser.pages();
		if (pages.length !== 1) {
			throw new Error(`Expected one context, found ${pages.length}`);
		}

		// Bring the found page to the front
		page = pages[0];
		await page.bringToFront();
	} catch (err) {
		console.log(err);
		console.log("Did you run chromiumserver.js?");
	}
}

/**
 * Logs into Instagram using provided credentials by navigating to the login page,
 * inputting the username/password, and submitting the form. After a successful login,
 * it creates an SQLite database to store user-related data (followers, following, etc.).
 *
 * @param {string} username - Instagram username.
 * @param {string} password - Instagram password.
 */
async function loginToInstagram(username, password) {
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

		// Create databases for the logged-in user
		db = createUserDatabases(username);
	} catch (err) {
		console.error("Error during Instagram login:", err);
	}
}

/**
 * Creates an SQLite database for the Instagram account identified by `username`.
 * This database stores general information, accounts, and actions.
 *
 * Note: Usernames with identical alphanumerical characters (e.g., matt.tang and matt_tang)
 * would overlap and cause problems.
 *
 * @param {string} username - Instagram username to create a database for.
 * @returns {Database} - SQLite Database connection object.
 */
async function createUserDatabases(username) {
	// Sanitize the username for safe use in filenames
	const dbName = username.replace(/[^a-zA-Z0-9]/g, "_");
	const dbPath = `./databases/${dbName}.db`;

	// Ensure that the "databases" directory exists, or create it
	if (!fs.existsSync("./databases")) {
		fs.mkdirSync("./databases");
	}

	// Create or open the SQLite database
	const db = new sqlite3.Database(dbPath, (err) => {
		if (err) {
			console.error("Error opening database:", err.message);
			return;
		}
		console.log(`Connected to the database for ${username}`);
	});

	// Create necessary tables: general, history, accounts, and actions
	db.serialize(() => {
		// General table to store overall account data
		db.run(`CREATE TABLE IF NOT EXISTS general (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE,
      value TEXT
    )`);

		// Table to store history of follower & following count, as well as who has followed & unfollowed since last check
		db.run(`CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        time TEXT,
        followers_count INTEGER,
        following_count INTEGER,
        new_followers TEXT,
        lost_followers TEXT,
        new_following TEXT,
        un_following TEXT

    )`);

		// Accounts table to track individual Instagram accounts interacted with
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

		// Actions table to log specific interactions with accounts
		db.run(`CREATE TABLE IF NOT EXISTS actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER,
      action_type TEXT,
      time TEXT
    )`);
	});

	return db;
}

/**
 * Fetches Instagram followers and following data for the given username.
 * It queries the Instagram API to get the user's information, retrieves
 * their ID, and then fetches both their followers and following lists.
 * Then, updates the databases:
 * - total # of followers & following & new changes in history
 * - follower / following status for each user in accounts
 *
 * @param {string} username - The Instagram username to query.
 * @returns {}
 */
async function updateFollowersAndFollowing(username) {
	try {
		//const [followersList, followingList] = await fetchInstagramFollowersAndFollowing(username);
		const followersData = fs.readFileSync('followers.txt', 'utf8'); // Read file as string
        const followersList = followersData.split(','); // Split by comma to create array

        // Read and process following.txt
        const followingData = fs.readFileSync('following.txt', 'utf8'); // Read file as string
        const followingList = followingData.split(','); // Split by comma to create array
        // So that .has() is O(1) time
		const followersSet = new Set(followersList);
		const followingSet = new Set(followingList);

		console.log("followers", followersList.toString());
		console.log("following", followingList.toString());

		//4 groups:
		//Mutual
		//onlyIFollow
		//onlyTheyFollow
		//neitherFollow - but still already in database

		//4 groups:
		//newFollowers
		//lostFollowers
		//newFollowing
		//lostFollowing

		db.serialize(() => {
			// Get all usernames already in the database to calculate the neitherFollows group
			db.all("SELECT * FROM accounts", (err, rows) => {
				if (err) {
					console.error(err);
					return;
				}

				const allUsersInDB = rows.map((row) => row.username);

				// Step 1: Create the groups
				const mutuallyFollow = followersList.filter((user) => followingSet.has(user));
				const onlyIFollow = followingList.filter((user) => !followersSet.has(user));
				const onlyTheyFollow = followersList.filter((user) => !followingSet.has(user));
				const neitherFollows = allUsersInDB.filter(
					(user) => !followersSet.has(user) && !followingSet.has(user)
				);

				//Don't want new followers & new following to be everyone on the first time this is run
				const origFollowers = new Set(
					rows.filter((user) => user.follows_me).map((user) => user.username)
				);
				const newFollowers =
					allUsersInDB.length === 0
						? []
						: followersList.filter((user) => !origFollowers.has(user));
				const lostFollowers = [...origFollowers].filter(
					(user) => !followersSet.has(user)
				);

				const origFollowing = new Set(
					rows.filter((user) => user.i_follow).map((user) => user.username)
				);
				const newFollowing =
					allUsersInDB.length === 0
						? []
						: followingList.filter((user) => !origFollowing.has(user));
				const unFollowing = [...origFollowing].filter((user) => !followingSet.has(user));

				db.run("BEGIN TRANSACTION");

				const updateAccount = db.prepare(`
            INSERT INTO accounts (username, follows_me, i_follow)
            VALUES (?, ?, ?)
            ON CONFLICT(username) 
            DO UPDATE SET 
              follows_me = excluded.follows_me,
              i_follow = excluded.i_follow
          `);

				// Step 2: Update based on groups

				// Mutually follow (set both follows_me = 1 and i_follow = 1)
				mutuallyFollow.forEach((username) => {
					updateAccount.run([username, 1, 1]);
				});

				// Only I follow (set follows_me = 0, i_follow = 1)
				onlyIFollow.forEach((username) => {
					updateAccount.run([username, 0, 1]);
				});

				// Only they follow (set follows_me = 1, i_follow = 0)
				onlyTheyFollow.forEach((username) => {
					updateAccount.run([username, 1, 0]);
				});

				// Neither follows (set both follows_me = 0 and i_follow = 0)
				neitherFollows.forEach((username) => {
					updateAccount.run([username, 0, 0]);
				});

				updateAccount.finalize();

				db.run("COMMIT");

				const currentTime = new Date().toISOString(); // get the current timestamp
				const followersCount = followersList.length; // count of current followers
				const followingCount = followingList.length; // count of current following
				const newFollowersStr = newFollowers.join(","); // convert array to comma-separated string
				const lostFollowersStr = lostFollowers.join(",");
				const newFollowingStr = newFollowing.join(","); // convert array to comma-separated string
				const unFollowingStr = unFollowing.join(",");

				db.run(
					`INSERT INTO history (time, followers_count, following_count, new_followers, lost_followers, new_following, un_following) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
					[
						currentTime,
						followersCount,
						followingCount,
						newFollowersStr,
						lostFollowersStr,
						newFollowingStr,
						unFollowingStr,
					]
				);
			});
		});

        console.log("Finished updating followers and following")
	} catch (err) {
		console.error(err);
		return null;
	}
}

/**
 * Fetches both followers and followings for a user by their ID. It handles
 * pagination to retrieve large lists of followers/following and returns
 * the combined lists.
 *
 * @param {string} username - The Instagram username to fetch followers and followings for.
 * @returns {{followers: string[], following: string[]}} - An object containing arrays of follower and following data.
 */
async function fetchInstagramFollowersAndFollowing(username) {

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
			res.data.user.edge_followed_by.edges.map(({ node }) => (node.username))
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
			res.data.user.edge_follow.edges.map(({ node }) => (node.username))
		);
	}

	return [followers, following];
}

// Start the script
(async function () {
	await connectToBrowser(); // Establish connection to the browser
	// await loginToInstagram(username, password); // Log in if needed
    db = await createUserDatabases(username);
	await updateFollowersAndFollowing(username); // Fetch and log followers/following
})();

//Loop:
//Get account data:
