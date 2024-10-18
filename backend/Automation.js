const fs = require('fs');
const { createUserDatabases, updateFollowersAndFollowing, getRandomMutual } = require('./database');
const BrowserSession = require('./BrowserSession');

class Automation {
    constructor(username, password, debug = true) {
        this.username = username;
        this.password = password;
        this.db = null;
        this.session = null;
        this.wsEndpoint = null;
        this.debug = debug;
    }

    /**
     * Initializes the automation process by reading WebSocket info, creating a database,
     * and setting up the browser session.
     */
    async initialize() {
        try {
            // Read WebSocket endpoint from the file
            this.wsEndpoint = fs.readFileSync('../ws.txt', 'utf-8');

            // Create the user database
            this.db = await createUserDatabases(this.username);

            // Initialize a new browser session
            this.session = new BrowserSession(this.username, this.wsEndpoint, this.db);

            // Connect to the browser
            await this.session.connectToBrowser();
        } catch (err) {
            console.error("Error during initialization:", err);
            throw err;
        }
    }

    /**
     * Runs the main automation tasks, including logging into Instagram
     * and fetching followers/following.
     */
    async run() {
        try {
            let followers, following;

            

            

            if (this.debug) {
                // If in debug mode, read followers and following from text files
                followers = fs.readFileSync('./followers.txt', 'utf-8').split(",");
                following = fs.readFileSync('./following.txt', 'utf-8').split(",");
            } else {
                // Log into Instagram and fetch the followers/following lists
                await this.session.loginToInstagram(this.password);
                [followers, following] = await this.session.fetchFollowersAndFollowing();
            }

            // Optionally: Update followers and following in the database
            // await updateFollowersAndFollowing(this.db, followers, following);

            //unfollow or unrequest users who haven't accepted / followed back in time.
            // await checkUnfollow();

            // Get a random mutual from the database
            let mutual = await getRandomMutual(this.db);
            console.log("Random Mutual:", mutual);


            await this.session.getFollowers(mutual,20);

            //browse users that mutually do not follow, and see if they have enough mutuals

            // You can continue the logic for other tasks, such as:
            // - Getting followers from a mutual's profile
            // - Unfollowing people who haven't followed back
            // - Browsing users that haven't been looked at, etc.
        } catch (err) {
            console.error("An error occurred during the automation process:", err);
        }
    }
}

module.exports = Automation
