const AccountDatabase = require("./AccountDatabase"); // Adjust the path as needed
const fs = require("fs");
const {matchesSimplifiedProperties} = require('./helper');

const MSP = matchesSimplifiedProperties;


const createGetUser = (accounts) => {
  return (username) => accounts.find(account => account.username === username)
}

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

  describe("createUserDatabases", () => {
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
  })
  
  describe("updateFollowersAndFollowing", () => {
    test("should update followers and following correctly, only editing history on subsequent runs", async () => {
      let accounts, history, followersList, followingList;
      followersList = ["user1", "user2"];
      followingList = ["user2", "user3"];
      await db.updateFollowersAndFollowing(followersList, followingList);
  
      accounts = await db.getTable("accounts");
  
      expect(accounts.length).toBe(3);
      let getUser = createGetUser(accounts);
      expect(MSP(getUser("user1"),{follows_me: 1, i_follow: 0})).toBe(true);
      expect(MSP(getUser("user2"),{follows_me: 1, i_follow: 1})).toBe(true);
      expect(MSP(getUser("user3"),{follows_me: 0, i_follow: 1})).toBe(true);
  
      history = await db.getTable("history");
  
      expect(MSP(history,[{followers_count: 2, following_count: 2, lost_followers: '', new_followers: '', new_following: ''}],true)).toBe(true);
  
      
      followersList = ["user1", "user4"];
      followingList = ["user2", "user5"];
      await db.updateFollowersAndFollowing(followersList, followingList);
  
      accounts = await db.getTable("accounts");
      getUser = createGetUser(accounts);
      expect(accounts.length).toBe(5);
      
      expect(MSP(getUser("user1"),{follows_me: 1, i_follow: 0})).toBe(true);
      expect(MSP(getUser("user2"),{follows_me: 0, i_follow: 1})).toBe(true);
      expect(MSP(getUser("user3"),{follows_me: 0, i_follow: 0})).toBe(true);
      expect(MSP(getUser("user4"),{follows_me: 1, i_follow: 0})).toBe(true);
      expect(MSP(getUser("user5"),{follows_me: 0, i_follow: 1})).toBe(true);
  
      history = await db.getTable("history");
  
      expect(MSP(history,[{},{followers_count: 2, following_count: 2, lost_followers: 'user2', new_followers: 'user4', new_following: 'user5'}],true)).toBe(true);
    });
  })

  

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


  describe("updateExpired", () => {
    test("should search through the account database for expired requests, setting request_time to '', and blacklisting if they are not in our followers", async () => {
      const followersList = ["user1", "user2", "user4"];
      const followingList = ["user1", "user3"];
      await db.updateFollowersAndFollowing(followersList, followingList);
    
      const DAYS_LIMIT = 7;
      const expiredTime = new Date(Date.now() - (DAYS_LIMIT + 1) * 24 * 60 * 60 * 1000).toISOString();
    
      // Set an old request time for testing expiration
      await db.db.run(
          "UPDATE accounts SET request_time = ? WHERE username = 'user3' OR username = 'user4'",
          [expiredTime]);
    
      const expiredUsers = await db.updateExpired(DAYS_LIMIT);
    
      expect(expiredUsers).toContain("user3");
      expect(expiredUsers).not.toContain("user4");
    
      const accounts = await db.getTable("accounts");
      const getUser = createGetUser(accounts);

      expect(getUser("user3").blacklisted).toBe(1);
      expect(getUser("user4").blacklisted).toBe(0);
      expect(getUser("user3").request_time).toBe('');
      expect(getUser("user4").request_time).toBe('');
    });
  })
  
  
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

  describe("getTable", () => {
    test("should retrieve all rows from a valid table", async () => {
      await db.updateFollowersAndFollowing(["user1"], ["user2"]);
      const accounts = await db.getTable("accounts");
      expect(Array.isArray(accounts)).toBe(true);
      expect(accounts.length).toBe(2);
    });
  
    test("should throw error for invalid table", async () => {
      await expect(db.getTable("nonexistent")).rejects.toThrow();
    });
  });

  describe("error handling", () => {
    test("should handle database connection errors", async () => {
      const invalidDb = new AccountDatabase("test/invalid");
      await expect(invalidDb.createUserDatabases()).rejects.toThrow();
    });
    
    test("should handle transaction failures in updateFollowersAndFollowing", async () => {
      db.db.close();
      await expect(db.updateFollowersAndFollowing(["user1"], ["user2"])).rejects.toThrow();
    });
  });

  describe("edge cases", () => {
    test("should handle empty lists in updateFollowersAndFollowing", async () => {
      await db.updateFollowersAndFollowing([], []);
      const accounts = await db.getTable("accounts");
      expect(accounts.length).toBe(0);
    });
  
    test("should handle duplicates in follower/following lists", async () => {
      await db.updateFollowersAndFollowing(
        ["user1", "user1"], 
        ["user2", "user2"]
      );
      const accounts = await db.getTable("accounts");
      expect(accounts.length).toBe(2);
    })});
  
});
