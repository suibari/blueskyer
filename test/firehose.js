const { BlueskySubscription } = require('../index');

const subscription = new BlueskySubscription();
subscription.setRepoHandler((repo) => {
  if (repo.$type) {
    console.log(repo);
  }
})
subscription.connect();