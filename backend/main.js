
const Automation = require('./automation')
/** Instagram login credentials (change accordingly) */

require('dotenv').config();


(async function () {
    const automation = new Automation(process.env.USERNAME,process.env.PASSWORD,true);
    await automation.initialize();
    await automation.run();
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




- initialize
    - create browser session, database
    - login to instagram
- run (loop)
    - update your followers and following in the database, using the instagram api at no cost
    - find all profiles in database where request_time > LIMIT days
    - 
*/