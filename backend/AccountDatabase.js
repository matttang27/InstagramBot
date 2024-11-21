const sqlite3 = require("sqlite3").verbose();
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

	async getTable(tableName) {
		return new Promise((resolve, reject) => {
			this.db.all(`SELECT * FROM ${tableName};`, (err, rows) => {
			  if (err) return reject(err);
			  resolve(rows);
			});
		  });
	}

	/**
	 * Creates the databases for the username (if it doesn't exist)
	 */
	async createUserDatabases() {
		const dbName = this.username.replace(/[^a-zA-Z0-9]/g, "_"); // Sanitize username for use in filename
		const dbPath = `./databases/${dbName}.db`;

		return new Promise((resolve, reject) => {
			// Create a new directory for databases if it doesn't exist
			if (!fs.existsSync("./databases")) {
				fs.mkdirSync("./databases");
			}

			const createTable = (schema) =>
                new Promise((resolve, reject) => {
                    db.run(schema, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

			const db = new sqlite3.Database(dbPath, (err) => {
				if (err) {
					console.error("Error opening database:", err.message);
				}
				console.log(`Connected to the database for ${this.username}`);

				

				// Create the required tables
				db.serialize(async () => {
					await createTable(GENERAL_SCHEMA);
                    await createTable(ACCOUNTS_SCHEMA);
                    await createTable(HISTORY_SCHEMA);
                    await createTable(ACTIONS_SCHEMA);

					this.db = db;

					console.log("Databases created")
					resolve(db);
				});
			});
		});
	}

	/**
	 * Updates the databases:
	 * - total # of followers & following & new changes in history
	 * - follower / following status for each user in accounts
	 *
	 * @param {string[]} followersList
	 * @param {string[]} followingList
	 * @returns {Promise<void>}
	 */
	async updateFollowersAndFollowing(followersList, followingList) {
		console.log("Updating followers and following to db");
		let db = this.db;
		const followersSet = new Set(followersList);
		const followingSet = new Set(followingList);

		console.log("followers", followersList.toString());
		console.log("following", followingList.toString());

		//4 groups for accounts:
		//Mutual
		//onlyIFollow
		//onlyTheyFollow
		//neitherFollow - but still already in database

		//4 groups for history:
		//newFollowers
		//lostFollowers
		//newFollowing
		//lostFollowing

		return new Promise((resolve, reject) => {
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
					const unFollowing = [...origFollowing].filter(
						(user) => !followingSet.has(user)
					);

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

					db.run("COMMIT", (err) => {
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
						, (err) => {
							if (err) reject(err);
							else resolve();
							console.log("Finished updating followers and following");
						});
					});

					
				});
			});

			
			
		});
	}

	/**
	 * @returns {Promise<string>} the username of the random mutual
	 */
	async getRandomMutual() {
		return new Promise((resolve, reject) => {

			this.db.all("SELECT username FROM accounts WHERE i_follow = 1 AND follows_me = 1", [], (err, rows) => {
				if (err) {
					console.error("Error fetching:", err);
					reject(err);
				}
				
				
				if (rows.length > 0) {
					let mutuals = rows.map(account => account.username);
					let randomMutual = mutuals[Math.floor(Math.random() * mutuals.length)];
					resolve(randomMutual);
				} else {
					resolve(null); // No mutuals found
				}
			});
		});
	}

	async updateExpired(DAYS_LIMIT) {
		return new Promise((resolve, reject) => {
			const query = `SELECT * FROM accounts WHERE request_time != ""`;
			this.db.all(query, [], (err, rows) => {
				if (err) {
					console.error("Error fetching accounts:", err);
					reject(err);
					return;
				}

				if (rows.length > 0) {
					let expiredUsers = [];

					// Start transaction to batch update expired users
					this.db.run("BEGIN TRANSACTION");

					rows.forEach((user) => {
						const requestTime = Date.parse(user["request_time"]);
						const timeDifference = Date.now() - requestTime;

						// Check if the time difference exceeds the DAYS_LIMIT
						if (timeDifference > DAYS_LIMIT * 24 * 60 * 60 * 1000) {
							let updateQuery;
							if (user["follows_me"] === 0) {
								expiredUsers.push(user["username"]);

								// Update the user's request_time and blacklist status
								updateQuery = `UPDATE accounts SET request_time = "", blacklisted = 1 WHERE username = ?`;
							} else {
								//If they follow us, just reset request_time
								updateQuery = `UPDATE accounts SET request_time = "" WHERE username = ?`;
							}

							this.db.run(updateQuery, [user["username"]], (updateErr) => {
								if (updateErr) {
									console.error("Error updating user:", updateErr);
									reject(updateErr);
								}
							});
						}
					});

					// Commit the transaction after all updates are done
					this.db.run("COMMIT", (commitErr) => {
						if (commitErr) {
							console.error("Error committing transaction:", commitErr);
							reject(commitErr);
						} else {
							resolve(expiredUsers);
						}
					});
				} else {
					resolve([]); // No expired users found
				}
			});
		});
	}

	/**
	 * Adds a new action to the actions table
	 *
	 * @param {string} username- The username of the account associated with this action
	 * @param {string} action_type - The type of action performed (e.g., "follow", "unfollow", etc.)
	 * @returns {Promise<void>}
	 */
	async addAction(username, action_type) {
		return new Promise((resolve, reject) => {
			let time = Date.now().toString();
			const query = `INSERT INTO actions (account_username, action_type, time) VALUES (?, ?, ?)`;

			this.db.run(query, [username, action_type, time], function (err) {
				if (err) {
					console.error("Error adding action:", err.message);
					reject(err);
					return;
				}
				console.log(`Action added: ${action_type} for account_id ${username} at ${time}`);
				resolve();
			});
		});
	}

	async setProfileStatuses(profiles) {
		return new Promise((resolve, reject) => {
			this.db.serialize(() => {
				this.db.run("BEGIN TRANSACTION;", (beginErr) => {
					if (beginErr) {reject(beginErr)}
				});
	
				const updateQuery = `UPDATE accounts SET following_status = ? WHERE username = ?`;
				const stmt = this.db.prepare(updateQuery);
	
				let hasError = false; // Track if any error occurs during the updates
	
				profiles.forEach(([username, status]) => {
					stmt.run(status, username, (err) => {
						if (err) {
							console.error(`Error updating status for ${username}:`, err.message);
							hasError = true;
						} else {
							console.log(`Updated status for ${username} to ${status}.`);
						}
					});
				});
	
				stmt.finalize((finalizeErr) => {
					if (finalizeErr) {
						console.error("Error finalizing statement:", finalizeErr.message);
						reject(finalizeErr);
						return;
					}
	
					// Commit the transaction
					this.db.run("COMMIT;", (commitErr) => {
						if (commitErr || hasError) {
							console.error("Error committing transaction:", commitErr?.message || "Errors occurred during updates.");
							reject(commitErr || new Error("Some updates failed."));
						} else {
							console.log("All updates completed successfully.");
							resolve();
						}
					});
				});
			});
		});
	}
	
}

module.exports = AccountDatabase;
