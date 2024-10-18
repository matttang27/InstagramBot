const { connectToBrowser, loginToInstagram, fetchFollowersAndFollowing } = require("./automation");
const { createUserDatabases, updateFollowersAndFollowing } = require("./database");
const fs = require('fs');

/** Instagram login credentials (change accordingly) */
const USERNAME = "********";
const PASSWORD = "********";

const DEBUGLIST = true; //Whether to fetch follower following list from instagram or txt files

(async function () {
    let wsEndpoint = fs.readFileSync('../ws.txt','utf-8')
	const [page, browser] = await connectToBrowser(wsEndpoint); // Establish connection to the browser
	// await loginToInstagram(page, username, password); // Log in if needed
	const db = await createUserDatabases(USERNAME);

    let followers, following;
    if (DEBUGLIST) {
        followers = fs.readFileSync('./followers.txt','utf-8').split(",")
        following = fs.readFileSync('./following.txt','utf-8').split(",")
    } else {
        [followers, following] = await fetchFollowersAndFollowing(page, USERNAME);
    }
	await updateFollowersAndFollowing(db, followers, following); // Fetch and log followers/following
})();

//Loop:
//Get account data:
