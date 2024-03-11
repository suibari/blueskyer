const { BskyAgent } = require('@atproto/api');
const service = 'https://bsky.social';

/**
 * BskyAgentクラスを継承したBlueskyerクラス
 * @extends BskyAgent
 */
class Blueskyer extends BskyAgent {
  /**
   * MyBskyAgentのインスタンスを初期化する
   */
  constructor() {
    super({service: service});
    return this;
  }

  /**
   * 指定されたユーザーの全てのフォロワーを取得する
   * @param {string} handleordid - ハンドルまたはDID
   * @param {int} threshold_follower - フォロワーしきい値
   * @returns {Promise<Array>} - フォロワーの配列
   */
  async getConcatFollowers(handleordid, threshold_follower) {
    let followers = [];
    
    const params = {
      actor: handleordid
    }

    let response = await this.getFollowers(params);
    followers = response.data.followers;

    while (('cursor' in response.data) && (threshold_follower > followers.length)) {
      const paramswithcursor = Object.assign(params, {
        cursor: response.data.cursor
      });

      response = await this.getFollowers(paramswithcursor);
      followers = followers.concat(response.data.followers);
    };
    return followers;
  }

  /**
   * 指定されたユーザーの全てのフォローを取得する
   * @param {string} handleordid - ハンドルまたはDID
   * @param {int} threshold_follow - フォローしきい値
   * @returns {Promise<Array>} - フォローの配列
   */
  async getConcatFollows(handleordid, threshold_follow) {
    let follows = [];
    
    const params = {
      actor: handleordid
    }

    let response = await this.getFollows(params);
    follows = response.data.follows;

    while (('cursor' in response.data) && (threshold_follow > follows.length)) {
      const paramswithcursor = Object.assign(params, {
        cursor: response.data.cursor
      });

      response = await this.getFollows(paramswithcursor);
      follows = follows.concat(response.data.follows);
    };
    return follows;
  }

  /**
   * 未読通知をリストアップする
   * @returns {Object<Array>} - 未読通知の配列
   */
  async listUnreadNotifications() {
    let notifications = [];

    const params = {
      limit: 100
    };

    let response = await this.listNotifications(params);
    for (let notification of response.data.notifications) {
      if (!notification.isRead) {
        notifications.push(notification);
      }
    }

    while ('cursor' in response.data) {
      const paramswithcursor = Object.assign(params, {
        cursor: response.data.cursor
      });

      response = await this.listNotifications(paramswithcursor);
      for (let notification of response.data.notifications) {
        if (!notification.isRead) {
          notifications.push(notification);
        }
      }
    }
    return notifications;
  }

  /**
   * 投稿がメンションを含むかどうかを判定する
   * @param {Object} post - 投稿
   * @returns {boolean} - メンションを含むかどうか
   */
  isMention(post) {
    if ('facets' in post.record) {
      const facets = post.record.facets;
      for (const facet of facets) {
        for (const feature of facet.features) {
          if (feature.$type == 'app.bsky.richtext.facet#mention') {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * 投稿がリンクを含むかどうかを判定する
   * @param {Object} post - 投稿
   * @returns {boolean} - リンクを含むかどうか
   */
  isLinks(post) {
    if ('facets' in post.record) {
      const facets = post.record.facets;
      for (const facet of facets) {
        for (const feature of facet.features) {
          if (feature.$type == 'app.bsky.richtext.facet#link') {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * 投稿からリンクを抽出する
   * @param {Object} post - 投稿
   * @returns {Array<string>} - 抽出されたリンクの配列
   */
  getLinks(post) {
    let uriArray = [];
    if (this.isLinks(post)) {
      for (const facet of post.record.facets) {
        for (const feature of facet.features) {
          if (feature.$type == 'app.bsky.richtext.facet#link'){
            uriArray.push(feature.uri);
          }
        }
      }
    }
    console.log(uriArray);
    return uriArray;
  }

  /**
   * 指定された全てのアクターのプロフィールを取得する
   * @param {Array<string>} actors - アクターのDID配列
   * @returns {Promise<Array>} - プロフィールの配列
   */
  async getConcatProfiles(actors) {
    const batchSize = 25;
    let didArray = [];
    let actorsWithProf = [];

    for (const actor of actors) {
      didArray.push(actor);
    };
    for (let i = 0; i < didArray.length; i += batchSize) {
      const batch = didArray.slice(i, i + batchSize);
      const profiles = await this.getProfiles({actors: batch});
      actorsWithProf = actorsWithProf.concat(profiles.data.profiles);
    };
    // console.log(actorsWithProf)
    return actorsWithProf;
  }
  
  /**
   * AがBをフォローしているとき、BがAをフォローしていたらBのmutualをtrueに、そうでなければfalseにする
   * @param {Object} actor - アクター
   * @param {Object<Array>} follows - フォローの配列
   */
  async setMutual(actor, follows) {
    // 自分がフォローしている人が自分をフォローしていたらmutualをtrueに、そうでなければfalseにする
    for (const follow of follows) {
      const followsOfFollows = await this.getConcatFollows(follow.did);
      follow.mutual = false;
      for (const followOfFollows of followsOfFollows) {
        if (actor.did == followOfFollows.did) {
          follow.mutual = true;
          break;
        };
      };
    };
  }

  /**
   * アクセストークンとリフレッシュトークンが未取得ならセッションを作成、既取得で期限切れならセッションをリフレッシュ
   */
  async createOrRefleshSession() {
    if ((!this.accessJwt) && (!this.refreshJwt)) {
      // 初回起動時にaccsessJwt取得
      const response = await this.login({
        identifier: process.env.BSKY_IDENTIFIER,
        password: process.env.BSKY_APP_PASSWORD
      });
      this.accessJwt = response.data.accessJwt;
      this.refreshJwt = response.data.refreshJwt;
      // console.log(this.accessJwt)
      console.log("[INFO] created new session.");
    };
    const response = await this.getTimeline();
    if ((response.status == 400) && (response.data.error == "ExpiredToken")) {
      // accsessJwt期限切れ
      const response = await this.refreshSession();
      this.accessJwt = response.data.accessJwt;
      this.refreshJwt = response.data.refreshJwt;
      console.log("[INFO] token was expired, so refleshed the session.");
    };
  }

  /**
   * 指定したユーザのthreshold_tl分のフィードを取得する
   * @param {string} handleordid - user
   * @param {Promise<Array>} threshold_tl - フィードしきい値
   * @returns 
   */
  async getConcatAuthorFeed(handleordid, threshold_tl) {
    let feeds = [];
    let cursor;
    let response;

    response = await this.getAuthorFeed({actor: handleordid, limit: 100});
    feeds = feeds.concat(response.data.feed);
    cursor = response.data.cursor;
    while ((cursor) && (threshold_tl > feeds.length)) {
      response = await this.getAuthorFeed({actor: handleordid, limit: 100, cursor: cursor});
      feeds = feeds.concat(response.data.feed);
      cursor = response.data.cursor;
    };
    feeds = feeds.slice(0, threshold_tl);
    return feeds;
  }

  /**
   * 指定したユーザのthreshold_like分のいいねを取得する
   * @param {string} handleordid - user
   * @param {int} threshold_like - いいねしきい値
   * @returns 
   */
  async getConcatActorLikes(handleordid, threshold_like) {
    let likes = [];
    let cursor;

    try {
      let response = await this.getActorLikes({actor: handleordid, limit: 100});
      likes = likes.concat(response.data.feed);
      cursor = response.data.cursor;
      while ((cursor) && (response.data.feed.length > 0) && (threshold_like > likes.length)) {
        response = await this.getActorLikes({actor: handleordid, limit: 100, cursor: cursor});
        likes = likes.concat(response.data.feed);
        cursor = response.data.cursor;
      };
      likes = likes.slice(0, threshold_like);
      return likes;
    } catch(e) {
      return [];
    }
  }

  /**
   * 指定したユーザのthreshold_like分のいいねに対応したレコードを取得する
   * @param {string} handle - ハンドル名
   * @param {int} threshold_like - いいねしきい値
   * @returns 
   */
  async getConcatActorLikeRecords(handle, threshold_like) {
    let records = [];
    let cursor;

    try {
      let response = await this.listRecords({repo: handle, collection: "app.bsky.feed.like", limit: 100});
      records = records.concat(response.records);
      cursor = response.cursor;
      while ((cursor) && (threshold_like > records.length)) {
        response = await this.listRecords({repo: handle, collection: "app.bsky.feed.like", limit: 100, cursor: cursor});
        records = records.concat(response.records);
        cursor = response.cursor;
      };
      records = records.slice(0, threshold_like);
      return records;
    } catch(e) {
      return [];
    }
  }

  /**
   * 未実装API https://docs.bsky.app/docs/api/com-atproto-repo-list-records の実装
   * @param {Object} queryParams 
   * @returns
   */
  async listRecords(queryParams) {
    const options = {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.accessJwt}`,
      }
    };

    const url = new URL("https://bsky.social/xrpc/com.atproto.repo.listRecords");
    Object.keys(queryParams).forEach(key => url.searchParams.append(key, queryParams[key]));
    // console.log(url.toString())
    
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      };
      const data = await response.json();
      return data;

    } catch(e) {
      console.error('There was a problem with your fetch operation:', e);
      throw e;
    };
  }

  /**
   * 未実装API https://github.com/bluesky-social/atproto/blob/38656e71ff2faf9ea88b4ea650567814e7f1248d/lexicons/app/bsky/actor/defs.json の実装
   * @param {Object} queryParams - actor, others[] を指定
   * @returns
   */
  async getRelationships(queryParams) {
    const options = {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.accessJwt}`,
      }
    };

    // const url = new URL("https://bsky.social/xrpc/app.bsky.graph.getRelationships");
    const url = new URL("https://api.bsky.app/xrpc/app.bsky.graph.getRelationships");
    // 重複したキーを持つパラメータを追加する
    Object.entries(queryParams).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(val => url.searchParams.append(key, val));
      } else {
        url.searchParams.append(key, value);
      }
    });
    // console.log(url.toString())
    
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      };
      const data = await response.json();
      return data;

    } catch(e) {
      console.error('There was a problem with your fetch operation:', e);
      throw e;
    };
  }

  /**
   * 指定されたユーザが返信・いいねした数から、各ユーザに対するエンゲージメントのスコアを取得、上位順に並べたProfile配列を返す
   * @param {string} handle - ハンドル名
   * @param {int} threshold_nodes - 出力のProfile配列要素数
   * @param {int} threshold_tl - 取得するfeed数
   * @param {int} threshold_like - 取得するいいね数
   * @param {int} SCORE_REPLY - リプライで加点するエンゲージメントスコア
   * @param {int} SCORE_LIKE - いいねで加点するエンゲージメントスコア
   * @returns
   */
  async getInvolvedEngagements(handle, threshold_nodes, threshold_tl, threshold_like, SCORE_REPLY, SCORE_LIKE) {
    let didLike = [];
    let resultArray = [];
    let didArray = [];

    const feeds = await this.getConcatAuthorFeed(handle, threshold_tl);
    // console.log("[INFO] got " + feeds.length + " posts by " + handle);
    // const likes = await this.getConcatActorLikes(handle, threshold_like); // 現状、likeがとれるのはログインユーザだけ
    const records = await this.getConcatActorLikeRecords(handle, threshold_like);
    for (const record of records) {
      const uri = record.value.subject.uri;
      const did = uri.match(/did:plc:\w+/); // uriからdid部分のみ抜き出し
      didLike.push(did[0]);
    };
    // console.log("[INFO] got " + didLike.length + " likes by " + handle);
  
    // 誰に対してリプライしたかをカウント
    for (const [index, feed] of Object.entries(feeds)) {
      if (feed.reply) {
        if (handle != feed.reply.parent.author.handle) { // 自分に対するリプライは除外
          const replyTo = feed.reply.parent.author.did;
          let flagFound = false;
          for (const node of resultArray) {
            if (replyTo == node.did) {
              node.score = node.score + SCORE_REPLY;
              flagFound = true;
              break;
            };
          };
          if (!flagFound) {
            resultArray.push({did: replyTo, score: SCORE_REPLY});
          };
        };
      };
    };
    // for likes[]
    for (const did of didLike) {
      let flagFound = false;
      for (const node of resultArray) {
        if (did == node.did) {
          node.score = node.score + SCORE_LIKE;
          flagFound = true;
          break;
        };
      };
      if (!flagFound) {
        resultArray.push({did: did, score: SCORE_LIKE});
      };
    };
    // scoreで降順ソート
    resultArray.sort((a, b) => b.score - a.score);
    // オブジェクト配列からdidキーのみ抜いて配列化する
    didArray = resultArray.map(obj => obj.did);
    // 上位のみ抜き取る
    didArray = didArray.slice(0, threshold_nodes);
    // Profiles配列取得
    let friendsWithProf = [];
    if (didArray.length > 0) { // 誰にもリプライしてない人は実行しない
      friendsWithProf = await this.getConcatProfiles(didArray);
    };
    // エンゲージメントスコアを格納しておく
    for (const [index, friend] of Object.entries(friendsWithProf)) {
      friend.engagement = resultArray[index].score;
    };

    return friendsWithProf;
  }
}

module.exports = Blueskyer;