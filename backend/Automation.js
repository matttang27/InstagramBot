const fs = require('fs');
const AccountDatabase = require('./AccountDatabase');
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
            this.db = new AccountDatabase(this.username);

            await this.db.createUserDatabases();

            // Initialize a new browser session
            this.session = new BrowserSession(this.username, this.wsEndpoint, this.db);

            // Connect to the browser
            await this.session.connectToBrowser();

            await this.session.loginToInstagram(this.password);
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
            /*

            NOTE THAT UPDATING DATA IS NOT ACTION, VIEWING PROFILE IS
            (ACTION) means to add the action to the action table

            loginToInstagram (ACTION)
            LOOP:
            - updateFollowersAndFollowing (ACTION)
            - find all profiles in database where request_time != ""
                - if we have a request_time over the LIMIT days, set request_time back to ""
                    - if they are not in our followers, unfollow / unrequest (ACTION), and blacklist (ACTION)
            - find all profiles in database where i_follow = 0 and follows_me = 0 and mutuals > MUTUAL_LIMIT and blacklisted = 0
                - go to each profile (ACTION) (and update data cuz why not), and request follow (ACTION). Set request_time to now
            - find all profiles in database where i_follow = 0 and follows_me = 0, and last_updated > UPDATE_LIMIT days
                - visit each profile (ACTION) and update data in account database 
            - getRandomMutual, visit (ACTION) and run getFollowers (ACTION)
            */
            let followers, following;
            while (true) {
                
                

                let mutual = await this.db.getRandomMutual();
                console.log("Random Mutual:", mutual);


                await this.session.getFollowers(mutual,20);
            }
            
        } catch (err) {
            console.error("An error occurred during the automation process:", err);
        }
    }

    async updateDatabase() {
        let [followers, following] = await this.session.fetchFollowersAndFollowing();
        await this.db.addAction(-1,"fetchLists")
    }
}

module.exports = Automation
