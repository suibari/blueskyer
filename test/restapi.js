const { Blueskyer } = require('../index');
const HANDLE = process.env.BSKY_IDENTIFIER;

(async () => {
  const agent = new Blueskyer();
  await agent.login({
    identifier: process.env.BSKY_IDENTIFIER,
    password: process.env.BSKY_APP_PASSWORD,
  });
  await agent.createOrRefleshSession();

  // concatfollow
  const follows = await agent.getConcatFollows(HANDLE, 1000);
  console.log(follows.length);

  // concatfollower
  const followers = await agent.getConcatFollowers(HANDLE, 1000);
  console.log(followers.length);

  // relationships
  const relationships = await agent.getRelationships({
    actor: HANDLE,
    others: [HANDLE],
  })
  console.log(relationships);

  // engagement
  const profiles = await agent.getInvolvedEngagements(HANDLE, 36, 1000, 100, 3, 1);
  // console.log(profiles);
})();