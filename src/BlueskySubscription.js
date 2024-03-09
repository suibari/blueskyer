const WebSocket = require('websocket').w3cwebsocket;
const url = "wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos"

class BlueskySubscription {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.connectPromise = null;
    this.repoHandler = null;
  }

  async connect() {
    if (this.connected) {
      console.log('Already connected.');
      return;
    }

    if (this.connectPromise) {
      console.log('Connection attempt already in progress.');
      return this.connectPromise;
    }

    this.connectPromise = new Promise((resolve, reject) => {
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        console.log('WebSocket connection established.');
        this.connected = true;
        this.connectPromise = null;
        resolve();
      };

      this.socket.onmessage = async (event) => {
        if (event.data instanceof ArrayBuffer) {
          const message = new Uint8Array(event.data);
          try {
            await this.handleMessage(message);
          } catch (error) {
            console.error('Error handling message:', error);
          }
        }
      };

      this.socket.onclose = () => {
        console.log('WebSocket connection closed.');
        this.connected = false;
        this.socket = null;
        this.connectPromise = null;
        // Optional: Try reconnecting here
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
    });

    return this.connectPromise;
  }

  async handleMessage(message) {
    const { decode, decodeOptions } = await import('@ipld/dag-cbor');
    const { decodeFirst } = await import('cborg');
    const { CarReader } = await import('@ipld/car');

    const defs = decodeFirst(message, decodeOptions);
    if (defs[0].t === '#commit') {
      const commit = decode(defs[1]);
      const blocks = await CarReader.fromBytes(commit.blocks);
      for (const block of blocks._blocks) {
        const repo = decode(block.bytes);
        if (this.repoHandler) {
          this.repoHandler(repo);
        }
      }
    }
  }

  setRepoHandler(handler) {
    // ハンドラーを設定するメソッド
    this.repoHandler = handler;
  }

  send(message) {
    if (this.socket && this.connected) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.error('WebSocket connection not established or closed.');
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.connected = false;
      this.socket = null;
    }
  }
}

module.exports = BlueskySubscription;