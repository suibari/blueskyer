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

    try {
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
    } catch (e) {
      throw e;
    }
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

    try {
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
    } catch (e) {
      throw e;
    }
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

    try {
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
    } catch (e) {
      throw e;
    }
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

    try {
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
    } catch (e) {
      throw e;
    }
  }
  
  /**
   * AがBをフォローしているとき、BがAをフォローしていたらBのmutualをtrueに、そうでなければfalseにする
   * @param {Object} actor - アクター
   * @param {Object<Array>} follows - フォローの配列
   */
  async isMutual(did, didArray) {
    const ObjectArray = [];
  
    try {
      // didArrayを30ずつのグループに分割する
      for (let i = 0; i < didArray.length; i += 30) {
        const slicedDidArray = didArray.slice(i, i + 30);
        const relationships = await this.getRelationships({ actor: did, others: slicedDidArray });
    
        // リレーションシップをオブジェクト配列に変換して追加
        relationships.forEach((item, index) => {
          ObjectArray.push({
            mutual: (item.following && item.followedBy) ? true : false,
            did: slicedDidArray[index]
          });
        });
      }
    
      return ObjectArray;
    } catch (e) {
      throw e;
    }
  }

  /**
   * アクセストークンとリフレッシュトークンが未取得ならセッションを作成、既取得で期限切れならセッションをリフレッシュ
   */
  async createOrRefleshSession(identifier, password) {
    if ((!this.accessJwt) && (!this.refreshJwt)) {
      // 初回起動時にaccsessJwt取得
      const response = await this.login({
        identifier: identifier,
        password: password
      });
      this.accessJwt = response.data.accessJwt;
      this.refreshJwt = response.data.refreshJwt;
      // console.log(this.accessJwt)
      console.log("[INFO] created new session.");
    };
    try {
      const response = await this.getTimeline();
      if ((response.status == 400) && (response.data.error == "ExpiredToken")) {
        // accsessJwt期限切れ
        const response = await this.refreshSession();
        this.accessJwt = response.data.accessJwt;
        this.refreshJwt = response.data.refreshJwt;
        console.log("[INFO] token was expired, so refleshed the session.");
      };
    } catch (e) {
      throw e;
    }
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

    try {
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
    } catch (e) {
      throw e;
    }
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
      return data.relationships;

    } catch(e) {
      console.error('There was a problem with your fetch operation:', e);
      throw e;
    };
  }

  /**
   * didに指定したユーザがdidArrayに指定したユーザそれぞれをフォローしているか
   * @param {string} did 
   * @param {string<Array>} didArray 
   * @returns - フォローのBooleanとDIDを返すオブジェクト配列
   */
  async isFollow(did, didArray) {
    const ObjectArray = [];
  
    // didArrayを30ずつのグループに分割する
    for (let i = 0; i < didArray.length; i += 30) {
      const slicedDidArray = didArray.slice(i, i + 30);
      const relationships = await this.getRelationships({ actor: did, others: slicedDidArray });
  
      // リレーションシップをオブジェクト配列に変換して追加
      relationships.forEach((item, index) => {
        ObjectArray.push({
          following: item.following ? true : false,
          did: slicedDidArray[index]
        });
      });
    }
  
    return ObjectArray;
  }
}

module.exports = Blueskyer;