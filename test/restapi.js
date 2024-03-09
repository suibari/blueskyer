const { Blueskyer } = require('../index');

(async () => {
  const agent = new Blueskyer();
  await agent.login({
    identifier: process.env.BSKY_IDENTIFIER,
    password: process.env.BSKY_APP_PASSWORD,
  });
  await agent.createOrRefleshSession();
  const profiles = await agent.getInvolvedEngagements(process.env.BSKY_IDENTIFIER, 36, 1000, 100, 3, 1);
  console.log(profiles);
})();