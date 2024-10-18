const fs = require('fs');
const { createUserDatabases, updateFollowersAndFollowing } = require('./database');
const BrowserSession = require('./BrowserSession');

/** Instagram login credentials (change accordingly) */
const USERNAME = "matttang27_hasnolife";
const PASSWORD = "********";

const DEBUGLIST = true; // Whether to fetch follower/following list from Instagram or txt files

(async function () {
    try {
        // Read WebSocket endpoint from the file
        const wsEndpoint = fs.readFileSync('../ws.txt', 'utf-8');

        // Create the user database
        const db = await createUserDatabases(USERNAME);

        // Initialize a new browser session
        const session = new BrowserSession(USERNAME, wsEndpoint, db);

        // Connect to the browser
        await session.connectToBrowser();

        let followers, following;
        if (DEBUGLIST) {
            // If in debug mode, read followers and following from text files
            followers = fs.readFileSync('./followers.txt', 'utf-8').split(",");
            following = fs.readFileSync('./following.txt', 'utf-8').split(",");
        } else {
            // Log into Instagram and fetch the followers/following lists
            await session.loginToInstagram(PASSWORD);
            [followers, following] = await session.fetchFollowersAndFollowing();
        }

        // Update followers and following in the database
        //await updateFollowersAndFollowing(db, followers, following);

        await session.getFollowers("ac_doge_1124",20);
    } catch (err) {
        console.error("An error occurred:", err);
    }
})();


/*
- Update followers and following
    - WORRY ABOUT DETECTING MANUAL STUFF AFTER YOU'VE FINISHED AUTOMATION
- Unfollow people who haven't followed back
- Get a random mutual & look at all their followers
*/
