const AccountDatabase = require("./AccountDatabase"); // Adjust the path as needed
const fs = require("fs");
const {matchesSimplifiedProperties} = require('./helper');

const MSP = matchesSimplifiedProperties;

describe("AccountDatabase", () => {
  /** @type {AccountDatabase} */
  let db;

  const dbPath = "./databases/testUser.db";

  beforeEach(async () => {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    db = new AccountDatabase("testUser");
    await db.createUserDatabases(); // Create the database and tables
  });

  afterEach(() => {
    // Cleanup logic if needed
    db.db.close();
    console.log("db closed")
  });

  //TODO: Tables are being created (obv), but this test does not work.
  test("should create tables successfully", async () => {
    const tables = await new Promise((resolve, reject) => {
      db.db.all("SELECT name FROM sqlite_master WHERE type='table';", (err, rows) => {
        if (err) return reject(err);
        console.log(rows);
        resolve(rows.map(row => row.name));
      });
    });

    console.log(tables);
    expect(tables).toContain("general");
    expect(tables).toContain("accounts");
    expect(tables).toContain("history");
    expect(tables).toContain("actions");
  });

  test("should update followers and following correctly", async () => {
    let accounts, history, followersList, followingList;
    followersList = ["user1", "user2"];
    followingList = ["user2", "user3"];
    await db.updateFollowersAndFollowing(followersList, followingList);

    accounts = await db.getTable("accounts");

    expect(accounts.length).toBe(3);
    const getUser = (username) => {
      return accounts.find(account => account.username === username)
    }
    expect(MSP(getUser("user1"),{follows_me: 1, i_follow: 0})).toBe(true);
    expect(MSP(getUser("user2"),{follows_me: 1, i_follow: 1})).toBe(true);
    expect(MSP(getUser("user3"),{follows_me: 0, i_follow: 1})).toBe(true);

    history = await db.getTable("history");

    expect(MSP(history,[{followers_count: 2, following_count: 2, lost_followers: '', new_followers: '', new_following: ''}],true)).toBe(true);

    
    followersList = ["user1", "user4"];
    followingList = ["user2", "user5"];
    await db.updateFollowersAndFollowing(followersList, followingList);

    accounts = await db.getTable("accounts");
    expect(accounts.length).toBe(5);
    
    expect(MSP(getUser("user1"),{follows_me: 1, i_follow: 0})).toBe(true);
    expect(MSP(getUser("user2"),{follows_me: 0, i_follow: 1})).toBe(true);
    expect(MSP(getUser("user3"),{follows_me: 0, i_follow: 0})).toBe(true);
    expect(MSP(getUser("user4"),{follows_me: 1, i_follow: 0})).toBe(true);
    expect(MSP(getUser("user5"),{follows_me: 0, i_follow: 1})).toBe(true);

    history = await db.getTable("history");

    expect(MSP(history,[{},{followers_count: 2, following_count: 2, lost_followers: 'user2', new_followers: 'user4', new_following: 'user5'}],true)).toBe(true);
  });

  //TODO: This function causes error in later tests (continues using db)

  describe('getRandomMutual', () => {
    test("should return a random mutual if mutuals exist", async () => {
      const followersList = ["user1", "user2", "user4"];
      const followingList = ["user3", "user4"];
      await db.updateFollowersAndFollowing(followersList, followingList);
      const randomMutual = await db.getRandomMutual();
      console.log(randomMutual)
      expect(randomMutual).toBe("user4"); // or check specific logic for no mutuals
    })

    test("should return null if no mutuals", async () => {
      const followersList = ["user1", "user2"];
      const followingList = ["user3", "user4"];
      await db.updateFollowersAndFollowing(followersList, followingList);
      const randomMutual = await db.getRandomMutual();
      expect(randomMutual).toBe(null); // or check specific logic for no mutuals
    });
  })
  

  test("should update expired accounts correctly", async () => {
    const followersList = ["user1", "user2"];
    const followingList = ["user1", "user3"];
    await db.updateFollowersAndFollowing(followersList, followingList);
  
    const DAYS_LIMIT = 1; // Set a short limit for test purposes
    const expiredTime = new Date(Date.now() - (DAYS_LIMIT + 1) * 24 * 60 * 60 * 1000).toISOString();
  
    // Set an old request time for testing expiration
    await new Promise((resolve, reject) => {
      db.db.run(
        "UPDATE accounts SET request_time = ?, follows_me = 0 WHERE username = 'user3'",
        [expiredTime],
        (err) => (err ? reject(err) : resolve())
      );
    });
  
    const expiredUsers = await db.updateExpired(DAYS_LIMIT);
  
    expect(expiredUsers).toContain("user3");
  
    const updatedUser = await new Promise((resolve, reject) => {
      db.db.get(
        "SELECT * FROM accounts WHERE username = 'user3'",
        [],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    });
  
    expect(updatedUser.blacklisted).toBe(1);
    expect(updatedUser.request_time).toBe("");
  });
  
  test("should add an action correctly", async () => {
    await db.addAction("user1", "follow");
  
    const actions = await new Promise((resolve, reject) => {
      db.db.all("SELECT * FROM actions WHERE account_username = ?", ["user1"], (err, rows) =>
        err ? reject(err) : resolve(rows)
      );
    });
  
    expect(actions.length).toBe(1);
    expect(actions[0].action_type).toBe("follow");
  });
  
  test("should set profile statuses correctly", async () => {
    const followersList = ["user1", "user2"];
    const followingList = ["user1"];
    await db.updateFollowersAndFollowing(followersList, followingList);
  
    await db.setProfileStatuses([
      ["user1", "Follow Back"],
      ["user2", "Follow"],
    ]);
  
    const updatedProfiles = await new Promise((resolve, reject) => {
      db.db.all("SELECT username, following_status FROM accounts", [], (err, rows) =>
        err ? reject(err) : resolve(rows)
      );
    });
  
    const user1 = updatedProfiles.find((profile) => profile.username === "user1");
    const user2 = updatedProfiles.find((profile) => profile.username === "user2");
  
    expect(user1.following_status).toBe("Follow Back");
    expect(user2.following_status).toBe("Follow");
  });

  
  
});
