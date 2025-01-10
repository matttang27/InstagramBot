const fs = require("fs");
const AccountDatabase = require("./AccountDatabase");
const BrowserSession = require("./BrowserSession");

/**
 * Automation class for managing Instagram account actions such as
 * following, unfollowing, and updating account data.
 */
class Automation {
	/**
	 * @param {string} username - Instagram username.
	 * @param {string} password - Instagram password.
	 */
	constructor(username, password) {
		/**
		 * @type {string} Instagram username.
		 */
		this.username = username;

		/**
		 * @type {string} Instagram password.
		 */
		this.password = password;

		/**
		 * @type {AccountDatabase|null} Database instance for account-related operations.
		 */
		this.db = null;

		/**
		 * @type {BrowserSession|null} Browser session for automation tasks.
		 */
		this.session = null;

		/**
		 * @type {string|null} WebSocket endpoint for connecting to the browser.
		 */
		this.wsEndpoint = null;

		/**
		 * @type {number} Number of days before a follow request expires.
		 */
		this.DAYS_LIMIT = 7;

		/**
		 * @type {number} Minimum mutual count to consider following a user.
		 */
		this.MUTUAL_LIMIT = 20;

		/**
		 * @type {number} Number of days before revisiting a profile to update mutuals.
		 */
		this.UPDATE_DAYS_LIMIT = 100;

		this.VIEW_LIMIT_PER_HOUR = 20;

		//Follow and unfollows
		this.USER_INTERACTIONS_PER_HOUR = 10;
		this.USER_INTERACTIONS_PER_DAY = 50;

		this.LOGINS_PER_DAY = 3;
	}

	/**
	 * Initializes the automation process by reading WebSocket info, creating a database,
	 * and setting up the browser session.
	 * @throws {Error} Throws an error if initialization fails.
	 */
	async initialize() {
		console.log("Initializing application...");
		// Read WebSocket endpoint from the file
		this.wsEndpoint = fs.readFileSync("../ws.txt", "utf-8");

		// Create the user database
		this.db = new AccountDatabase(this.username);
		await this.db.createUserDatabases();

		// Initialize a new browser session
		this.session = new BrowserSession(this.username, this.wsEndpoint);

		// Connect to the browser
		await this.session.connectToBrowser();

		// Log in to Instagram
		await this.session.loginToInstagram(this.password);
		await this.db.addAction(this.username, "login", new Date().toISOString());
	}

	/**
	 * Main automation loop. Performs the following actions:
	 * - Updates followers and following data.
	 * - Removes expired follow requests.
	 * - Follows new profiles with sufficient mutuals.
	 * - Visits and updates profiles that meet the UPDATE_DAYS_LIMIT.
	 * - Adds profiles from random mutuals' followers.
	 */
	async run() {
		while (true) {
			await this.updateDatabase();
			await this.checkRequests();
			await this.followEnoughMutuals();
			await this.visitProfiles();
			await this.addProfiles();
			console.log("LOOP FINISHED");
			await new Promise((r) => setTimeout(r, 2000)); // Pause between iterations
		}
	}

	/**
	 * Fetches the followers and following of the user, then
	 * updates the database with the latest followers and following data.
	 *
	 */
	async updateDatabase() {
		console.log("Updating Database:");
		let [followers, following] = await this.session.fetchFollowersAndFollowing();
		await this.db.addAction(this.username, "fetchLists");
		await this.db.updateFollowersAndFollowing(followers, following);
		console.log("Finished updating database");
	}

	/**
	 * Check follow requests over LIMIT days
	 * If they don't follow us
	 * 		Unfollow / Unrequest them
	 */
	async checkRequests() {
		console.log("Checking follow requests");
		let expiredUsers = await this.db.updateExpired(this.DAYS_LIMIT);
		console.log(`Expired users: `);

		console.log("Removing expired users...");
		for (const user of expiredUsers) {
			let type = await this.session.unfollowUser(user);
			await this.db.addAction(user, type);
		}
		console.log("Finished removing expired users");
	}

	/**
	 * Adds followers from a random mutual profile to the database.
	 */
	async addProfiles() {
		console.log("Adding profiles..");
		let mutual = await this.db.getRandomMutual();

		if (!mutual) {
			console.log("No mutuals found.");
			return;
		}

		console.log("Mutual selected:", mutual);
		let profiles = await this.session.getFollowers(mutual, 20);

		await this.db.setProfileStatuses(profiles);

		console.log("Profiles added to the database.");
	}

	/**
	 * Updates the data of a specified profile in the database.
	 * @param {string} username - Username of the profile to update.
	 * @throws {Error} Throws an error if the update fails.
	 */
	async updateProfile(username) {
		let data;
		try {
			data = await this.session.viewProfile(username);
		} catch (err) {
			console.error("Could not view profile of", username, err);
		}

		await this.db.addAction(username, "view");
		const query = `
  UPDATE accounts
  SET 
    posts_count = ?,
    followers_count = ?,
    following_count = ?,
    mutuals_count = ?,
    last_updated = ?
  WHERE username = ?;
`;
		await this.db.db.run(
			query,
			[
				data ? data.posts : 0,
				data ? data.followers : 0,
				data ? data.following : 0,
				data ? data.mutuals : 0,
				Date.now(),
				username,
			],
			(err) => {
				if (err) {
					console.error(err);
				}
			}
		);
	}

	/**
	 * Follows users with sufficient mutual connections who are not yet followed.
	 */
	async followEnoughMutuals() {
		const mutuals = await this.db.getMutuals();

		const query = `SELECT * FROM accounts WHERE i_follow = 0 AND follows_me = 0 AND mutuals_count > ? AND blacklisted = 0 AND request_time IS NULL`;
		const profilesToFollow = await this.db.db.all(query);

		console.log(`Profiles to Follow: ${profilesToFollow.map((p) => p.username)}`);

		for (const profile of profilesToFollow) {
			try {
				await this.updateProfile(profile.username);
				await this.session.followUser(profile.username);
				await this.db.db.run(`UPDATE accounts SET request_time = ? WHERE username = ?`, [
					Date.now(),
					profile.username,
				]);
				await this.db.addAction(profile.username, "follow");
				console.log(`followed ${profile.username}`);
			} catch (err) {
				console.error(err);
			}
		}
	}

	/**
	 * Visits profiles that require updates based on UPDATE_DAYS_LIMIT.
	 */
	async visitProfiles() {
		const query = `SELECT * FROM accounts WHERE i_follow = 0 AND follows_me = 0`;
		let profilesToUpdate = await this.db.db.all(query);

		console.log(`Profiles to Update: ${profilesToUpdate.map((p) => p.username)}`);

		profilesToUpdate = profilesToUpdate.filter((profile) => {
			let time = Date.parse(profile["last_updated"]);
			return (
				profile["last_updated"] === null ||
				Date.now() - time > this.UPDATE_DAYS_LIMIT * 24 * 60 * 60 * 1000
			);
		});

		console.log(`Profiles to Update: ${profilesToUpdate.map((p) => p.username)}`);
		for (const profile of profilesToUpdate) {
			try {
				await this.updateProfile(profile.username);
				console.log(`updated ${profile.username}`);
			} catch (err) {
				console.error(err);
			}
		}

		console.log(`Updated all profiles`);
	}
}

module.exports = Automation;
