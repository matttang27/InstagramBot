const fs = require('fs');
const { createUserDatabases, updateFollowersAndFollowing, getRandomMutual } = require('./database');
const BrowserSession = require('./BrowserSession');
const {randomDelay} = require('./helper');
const Automation = require('./automation')
/** Instagram login credentials (change accordingly) */
const USERNAME = "matttang27_hasnolife";
const PASSWORD = "********";
const DEBUGLIST = true; // Whether to fetch follower/following list from Instagram or txt files

(async function () {
    try {
        const automation = new Automation(USERNAME,PASSWORD,true);
        await automation.initialize();
        
        let followers, following;
        if (DEBUGLIST) {
            // If in debug mode, read followers and following from text files
            followers = fs.readFileSync('./followers.txt', 'utf-8').split(",");
            following = fs.readFileSync('./following.txt', 'utf-8').split(",");
        } else {
            // Log into Instagram and fetch the followers/following lists
            await automation.session.loginToInstagram(PASSWORD);
            [followers, following] = await automation.session.fetchFollowersAndFollowing();
        }

        //automation.session.viewProfile("matttang27");
        await automation.session.unfollowUser("matttang27");
        await randomDelay();
        await automation.session.followUser("g_thankap");
        await randomDelay();
        await automation.session.unfollowUser("g_thankap");
        //let mutual = await getRandomMutual(db);
        //console.log(mutual)
        // Update followers and following in the database
        //await updateFollowersAndFollowing(db, followers, following);

        //await session.getFollowers("ac_doge_1124",20);
    } catch (err) {
        console.error("An error occurred:", err);
    }
})();


/*
- Update followers and following
    - WORRY ABOUT DETECTING MANUAL STUFF AFTER YOU'VE FINISHED AUTOMATION
- Unfollow people who haven't followed back
    - Do this after
- Get a random mutual & look at all their followers, add to database
- Browse all users that neither follow haven't been looked at, and see if they have enough mutuals.
- If they do, request follow.
*/
