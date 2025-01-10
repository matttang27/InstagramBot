const sqlite3 = require("sqlite3").verbose();
const { open } = require('sqlite');
const fs = require("fs");
const { Database } = require("sqlite3");

const GENERAL_SCHEMA = `CREATE TABLE IF NOT EXISTS general (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instagram_username TEXT,
        settings TEXT,
        followers TEXT,
        following TEXT
      )`;

const ACCOUNTS_SCHEMA = `CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        last_updated TIMESTAMP,
        followers_count INTEGER,
        following_count INTEGER,
        mutuals_count INTEGER,
        posts_count INTEGER,
        following_status TEXT,
		request_time TIMESTAMP,
        blacklisted INTEGER DEFAULT 0,
        user_interacted INTEGER DEFAULT 0,
        follows_me INTEGER DEFAULT 0,
        i_follow INTEGER DEFAULT 0
      )`;

const HISTORY_SCHEMA = `CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        time TIMESTAMP,
        followers_count INTEGER,
        following_count INTEGER,
        new_followers TEXT,
        lost_followers TEXT,
        new_following TEXT,
        un_following TEXT

    )`;

const ACTIONS_SCHEMA = `CREATE TABLE IF NOT EXISTS actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_username TEXT,
        action_type TEXT,
        time TIMESTAMP
      )`;

//TODO: Make this extend db instead?
class AccountDatabase {
	constructor(username) {
		this.username = username;
		this.db = null;
	}

	/**
	 * Retrieves all rows from a specified table in the database.
	 *
	 * @param {string} tableName - The name of the table to query.
	 * @returns {Promise<Object[]>} A promise that resolves with an array of rows from the table, where each row is represented as an object.
	 *                              If the table is empty, resolves with an empty array.
	 *                              If an error occurs during the query, the promise is rejected with the error.
	 * @throws Will throw an error if the query fails, such as if the table does not exist.
	 **/
	async getTable(tableName) {
		return await this.db.all(`SELECT * FROM ${tableName}`);
	}

	/**
	 * Creates the databases for the current user (if they don't already exist).
	 *
	 * - The function sanitizes the username to generate a valid database file name.
	 * - Ensures that the `./databases` directory exists.
	 * - Creates a SQLite database file and initializes required tables using predefined schemas.
	 * - If the database or tables already exist, it does nothing.
	 *
	 * @returns {Promise<sqlite3.Database>} A promise that resolves with the SQLite database instance.
	 *
	 * @throws {Error} If there are issues with directory creation, database connection, or table initialization.
	 */
	async createUserDatabases() {
		const dbName = this.username.replace(/[^a-zA-Z0-9]/g, "_"); // Sanitize username for use in filename
		const dbPath = `./databases/${dbName}.db`;

		if (!fs.existsSync("./databases")) {
			fs.mkdirSync("./databases");
		}

		const db = await open({
			filename: dbPath,
			driver: sqlite3.Database
		});

		await db.exec(GENERAL_SCHEMA);
		await db.exec(ACCOUNTS_SCHEMA);
		await db.exec(HISTORY_SCHEMA);
		await db.exec(ACTIONS_SCHEMA);

		this.db = db;
		console.log(`Connected to the database for ${this.username}`);
		return db;
	}

	/**
	 * Updates the database with the current follower and following information:
	 * - Updates the `accounts` table to reflect the follower/following status for each user.
	 * - Tracks historical changes in follower and following relationships in the `history` table.
	 *
	 * The function calculates:
	 * 1. **Accounts groups**:
	 *    - *Mutual*
	 *    - *onlyIFollow*
	 *    - *onlyTheyFollow*
	 *    - *neitherFollow*
	 * 2. **History groups**:
	 *    - *newFollowers*
	 *    - *lostFollowers*
	 *    - *newFollowing*
	 *    - *unFollowing*
	 *
	 * @param {string[]} followersList - List of usernames currently following the user.
	 * @param {string[]} followingList - List of usernames the user is currently following.
	 * @returns {Promise<void>} Resolves when the database has been successfully updated.
	 * @throws {Error} Rejects if there is any error during the update process.
	 *
	 *  @example
	 * const followersList = ['user1', 'user2', 'user3'];
	 * const followingList = ['user2', 'user3', 'user4'];
	 * await updateFollowersAndFollowing(followersList, followingList);
	 */
	async updateFollowersAndFollowing(followersList, followingList) {
		console.log("Updating followers and following to db");
		const followersSet = new Set(followersList);
		const followingSet = new Set(followingList);

		console.log("followers", followersList.toString());
		console.log("following", followingList.toString());

		try {
			// Get existing accounts
			const rows = await this.db.all("SELECT * FROM accounts");
			const allUsersInDB = rows.map(row => row.username);
	
			// Calculate groups
			const mutuallyFollow = followersList.filter(user => followingSet.has(user));
			const onlyIFollow = followingList.filter(user => !followersSet.has(user));
			const onlyTheyFollow = followersList.filter(user => !followingSet.has(user));
			const neitherFollows = allUsersInDB.filter(
				user => !followersSet.has(user) && !followingSet.has(user)
			);
	
			// Calculate changes
			const origFollowers = new Set(rows.filter(user => user.follows_me).map(user => user.username));
			const newFollowers = allUsersInDB.length === 0 ? [] : 
				followersList.filter(user => !origFollowers.has(user));
			const lostFollowers = [...origFollowers].filter(user => !followersSet.has(user));
	
			const origFollowing = new Set(rows.filter(user => user.i_follow).map(user => user.username));
			const newFollowing = allUsersInDB.length === 0 ? [] :
				followingList.filter(user => !origFollowing.has(user));
			const unFollowing = [...origFollowing].filter(user => !followingSet.has(user));
	
			// Begin transaction
			await this.db.exec('BEGIN TRANSACTION');
	
			// Update accounts
			const stmt = await this.db.prepare(`
				INSERT INTO accounts (username, follows_me, i_follow)
				VALUES (?, ?, ?)
				ON CONFLICT(username) 
				DO UPDATE SET 
					follows_me = excluded.follows_me,
					i_follow = excluded.i_follow
			`);
	
			for (const username of mutuallyFollow) {
				await stmt.run(username, 1, 1);
			}
			for (const username of onlyIFollow) {
				await stmt.run(username, 0, 1);
			}
			for (const username of onlyTheyFollow) {
				await stmt.run(username, 1, 0);
			}
			for (const username of neitherFollows) {
				await stmt.run(username, 0, 0);
			}
	
			await stmt.finalize();
	
			// Add history entry
			const currentTime = new Date().toISOString();
			await this.db.run(
				`INSERT INTO history (
					time, followers_count, following_count, 
					new_followers, lost_followers, 
					new_following, un_following
				) VALUES (?, ?, ?, ?, ?, ?, ?)`,
				[
					currentTime,
					followersList.length,
					followingList.length,
					newFollowers.join(","),
					lostFollowers.join(","),
					newFollowing.join(","),
					unFollowing.join(",")
				]
			);
	
			await this.db.exec('COMMIT');
			console.log("Finished updating followers and following");
	
		} catch (err) {
			await this.db.exec('ROLLBACK');
			throw err;
		}
	}

	/**
	 * Retrieves a list of mutual followers (users who follow you and you follow back).
	 *
	 * @returns {Promise<string[]>} A promise that resolves with an array of usernames who are mutual followers.
	 */
	async getMutuals() {
		const rows = await this.db.all(
            "SELECT username FROM accounts WHERE i_follow = 1 AND follows_me = 1"
        );
        return rows.map(row => row.username);
	}

	/**
	 * Retrieves a random mutual follower (a user who follows you and you follow back).
	 *
	 * @returns {Promise<string>} A promise that resolves with the username of a random mutual follower.
	 */
	async getRandomMutual() {
		try {
			const mutuals = await this.getMutuals();
			if (mutuals.length === 0) {
				return null;
			}
			const randomIndex = Math.floor(Math.random() * mutuals.length);
			return mutuals[randomIndex];
		} catch (err) {
			console.error("Error fetching random mutual:", err);
			throw err;
		}
	}
	
	/**
	 * Inserts or updates account information in the database.
	 *
	 * @param {Array.<[string, string]>} profiles - An array of profiles, where each profile is represented as a tuple [username, status].
	 * @returns {Promise<void>} A promise that resolves when the operation is complete.
	 * @throws {Error} If there is an error during the database operation.
	 */
	async insertAccounts(profiles) {
		await this.db.exec('BEGIN TRANSACTION');
        
        try {
            const stmt = await this.db.prepare(`
                INSERT INTO accounts (username, following_status)
                VALUES (?, ?)
                ON CONFLICT(username)
                DO UPDATE SET following_status = excluded.following_status
            `);

            for (const [username, status] of profiles) {
                await stmt.run(username, status);
            }
            
            await stmt.finalize();
            await this.db.exec('COMMIT');
        } catch (err) {
            await this.db.exec('ROLLBACK');
            throw err;
        }
	}
	
	

	/**
	 * searches for expired follow requests, setting request_time to "". If they don't follow us, blacklist and add to expiredUsers.
	 * @param {number} DAYS_LIMIT
	 * @returns {[string]} a list of users which did not follow back.
	 */
	//TODO: Set to null instead of ""? Or add another variable if we have already requested before?
	async updateExpired(DAYS_LIMIT) {
		const rows = await this.db.all(
            `SELECT * FROM accounts WHERE request_time != ""`
        );

        const expiredUsers = [];
        
        if (rows.length > 0) {
            await this.db.exec('BEGIN TRANSACTION');
            
            try {
                for (const user of rows) {
                    const requestTime = Date.parse(user.request_time);
                    const timeDifference = Date.now() - requestTime;

                    if (timeDifference > DAYS_LIMIT * 24 * 60 * 60 * 1000) {
                        if (user.follows_me === 0) {
                            expiredUsers.push(user.username);
                            await this.db.run(
                                `UPDATE accounts SET request_time = "", blacklisted = 1 WHERE username = ?`,
                                user.username
                            );
                        } else {
                            await this.db.run(
                                `UPDATE accounts SET request_time = "" WHERE username = ?`,
                                user.username
                            );
                        }
                    }
                }
                await this.db.exec('COMMIT');
            } catch (err) {
                await this.db.exec('ROLLBACK');
                throw err;
            }
        }
        return expiredUsers;
	}

	/**
	 * Adds a new action to the actions table
	 *
	 * @param {string} username- The username of the account associated with this action
	 * @param {string} action_type - The type of action performed (e.g., "follow", "unfollow", etc.)
	 * @returns {Promise<void>}
	 */
	async addAction(username, action_type) {
		const time = Date.now().toString();
        await this.db.run(
            `INSERT INTO actions (account_username, action_type, time) VALUES (?, ?, ?)`,
            [username, action_type, time]
        );
        console.log(`Action added: ${action_type} for account_id ${username} at ${time}`);
	}

	
	async setProfileStatuses(profiles) {
		await this.db.exec('BEGIN TRANSACTION');
        
        try {
            const stmt = await this.db.prepare(
                `UPDATE accounts SET following_status = ? WHERE username = ?`
            );

            for (const [username, status] of profiles) {
                await stmt.run(status, username);
                console.log(`Updated status for ${username} to ${status}.`);
            }

            await stmt.finalize();
            await this.db.exec('COMMIT');
        } catch (err) {
            await this.db.exec('ROLLBACK');
            throw err;
        }
	}
}

module.exports = AccountDatabase;
