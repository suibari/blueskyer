const { Blueskyer } = require('../index');
const HANDLE = process.env.BSKY_IDENTIFIER;

(async () => {
  const agent = new Blueskyer();
  await agent.login({
    identifier: process.env.BSKY_IDENTIFIER,
    password: process.env.BSKY_APP_PASSWORD,
  });
  await agent.createOrRefleshSession(process.env.BSKY_IDENTIFIER, process.env.BSKY_APP_PASSWORD);

  // concatfollow
  const follows = await agent.getConcatFollows(HANDLE, 1000);
  console.log(follows.length);

  // concatfollower
  const followers = await agent.getConcatFollowers(HANDLE, 1000);
  console.log(followers.length);

  // relationships
  const relationships = await agent.getRelationships({
    actor: process.env.BSKY_DID,
    others: [process.env.DID1, process.env.DID2],
  })
  console.log(relationships);

  // isFollow
  const followArray = await agent.isFollow(process.env.BSKY_DID, [process.env.DID1, process.env.DID2]);
  console.log(followArray);

  // isMutual
  const mutualArray = await agent.isMutual(process.env.BSKY_DID, [process.env.DID1, process.env.DID2, process.env.DID3]);
  console.log(mutualArray);  
})();