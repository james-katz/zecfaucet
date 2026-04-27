const { GraphQLClient, gql } = require('graphql-request');

class ZkoolClient {
  constructor(endpoint, options = {}) {
    this.client = new GraphQLClient(endpoint, options);
    this.accountId = 1;
    this.syncLock = false;
    this.syncTask = undefined;
    this.isSending = false;
    this.syncIntervalMs = 60 * 1000;
    this.maxSyncRetries = 3;
    this.syncRetryCount = 0;
  }

  get accountId() {
    return this._accountId;
  }

  set accountId(value) {
    this._accountId = value;
  }

  async #request(document, variables, requestHeaders) {
    return this.client.request(document, variables, requestHeaders);
  }

  #logError(methodName, error) {
    console.log(`[ZkoolClient.${methodName}]`, error);
  }

  #resolveDefault(defaultValue) {
    return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
  }

  async #safeCall(methodName, defaultValue, fn) {
    try {
      const result = await fn();
      return result ?? this.#resolveDefault(defaultValue);
    }
    catch (error) {
      this.#logError(methodName, error);
      return this.#resolveDefault(defaultValue);
    }
  }

  #defaultAccount(accountId = this.accountId) {
    return {
      aindex: 0,
      dindex: 0,
      birth: 0,
      height: 0,
      name: '',
      balance: 0,
      id: accountId ?? this.accountId
    };
  }

  #defaultSeed() {
    return {
      seed: '',
      passphrase: '',
      birth: 0,
      aindex: 0
    };
  }

  #defaultAddress() {
    return {
      ua: '',
      orchard: '',
      sapling: '',
      transparent: ''
    };
  }

  #defaultBalance() {
    return {
      transparent: 0,
      sapling: 0,
      orchard: 0,
      total: 0
    };
  }

  #defaultTransactionInfo(txid = '') {
    return {
      height: 0,
      txid: txid,
      value: 0,
      notes: [],
      outputs: [],
      spends: []
    };
  }

  /**
   * Initialize wallet backend; resolves when ready.
   * @param {boolean} shouldSpawnSyncTask
   * @returns {Promise<any>}
  */
  async init(shouldSpawnSyncTask = true) {
    return this.#safeCall('init', false, async () => {
      const rep = await this.#request(
        gql`
          query PingApiVersion {
            apiVersion
          }
        `
      );

      if(!rep?.apiVersion) {
        return false;
      }

      console.log('Zkool client initialized.');
      if(shouldSpawnSyncTask) {
        this.syncTask = this.spawnSyncTask();
      }
      return true;
    });
  }

  /**
   * Create new account.
   * @param {string} key
   * @param {int} accountIndex
   * @param {int} birth
   * @param {string} accountName
   * @param {string} passphrase
   * @returns {Promise<any>}
  */
  async createNewAccount(key, accountIndex, birth = 0, accountName, passphrase = '') {
    return this.#safeCall('createNewAccount', { createAccount: null }, async () => {
      const result = await this.#request(
        gql`
          mutation CreateNewAccount($newAccount: NewAccount!) {
            createAccount(
              newAccount: $newAccount
            )
          }
        `, {
          newAccount: {
            key: key,
            aindex: accountIndex,
            birth: birth,
            name: accountName,
            passphrase: passphrase,
            useInternal: false
          }
        }
      );
      return result ?? { createAccount: null };
    });
  }

  /**
   * List available accounts.
   * @returns {Promise<any>}
  */
  async getAccounts() {
    return this.#safeCall('getAccounts', { accounts: [] }, async () => {
      const result = await this.#request(
        gql`
          query GetAccounts {
            accounts {
              aindex
              dindex
              birth
              height
              name
              balance
              id
            }
          }
        `
      );
      return result ?? { accounts: [] };
    });
  }

  /**
   * Get account by id.
   * @param {int} accountId
   * @returns {Promise<any>}
  */
  async getAccountById(accountId) {
    return this.#safeCall('getAccountById', () => this.#defaultAccount(accountId), async () => {
      const result = await this.#request(
        gql`
          query GetAccount($filter: AccountFilter!) {
            accounts(accountFilter: $filter) {
              aindex
              dindex
              birth
              height
              name
              balance
              id
            }
          }
        `, {
          filter: {
            id: accountId
          }
        }
      );
      return result?.accounts?.[0] ?? this.#defaultAccount(accountId);
    });
  }

  /**
   * Get the current account info.
   * @returns {Promise<any>}
  */
  async getAccountInfo() {
    return this.#safeCall('getAccountInfo', () => this.#defaultAccount(this.accountId), async () => {
      return this.getAccountById(this.accountId);
    });
  }

  /**
   * Get account seed or UFVK.
   * @returns {Promise<any>}
  */
  async getAccountSeed() {
    return this.#safeCall('getAccountSeed', () => this.#defaultSeed(), async () => {
      const result = await this.#request(
        gql`
          query GetAccount($filter: AccountFilter!) {
            accounts(accountFilter: $filter) {
              seed
              passphrase
              birth
              aindex
            }
          }
        `, {
          filter: {
            id: this.accountId
          }
        }
      );
      return result?.accounts?.[0] ?? this.#defaultSeed();
    });
  }

  /**
   * Fetch wallet address.
   * @returns {Promise<any>}
  */
  async getAddress() {
    return this.#safeCall('getAddress', () => this.#defaultAddress(), async () => {
      const result = await this.#request(
        gql`
          query GetAddress($id: Int!) {
            addressByAccount(idAccount: $id) {
              ua
              orchard
              sapling
              transparent
            }
          }
        `, {
          id: this.accountId
        }
      );
      return result?.addressByAccount ?? this.#defaultAddress();
    });
  }

  /**
   * Generate new wallet addresses for current account.
   * @returns {Promise<any>}
  */
  async newAddresses() {
    return this.#safeCall('newAddresses', () => this.#defaultAddress(), async () => {
      const result = await this.#request(
        gql`
          mutation NewAddresses($id: Int!) {
            newAddresses(idAccount: $id) {
              orchard
              sapling
              transparent
              ua
            }
          }
        `, {
          id: this.accountId
        }
      );
      return result?.newAddresses ?? this.#defaultAddress();
    });
  }

  /**
   * Get total balance for an account.
   * @returns {Promise<any>}
  */
  async getTotalBalance() {
    return this.#safeCall('getTotalBalance', () => this.#defaultBalance(), async () => {
      const result = await this.#request(
        gql`
          query GetTotalBalance($id: Int!) {
            balanceByAccount(idAccount: $id) {
            transparent
            sapling
            orchard
            total
            }
          }
        `, {
          id: this.accountId
        }
      );
      return result?.balanceByAccount ?? this.#defaultBalance();
    });
  }

  /**
   * List transactions for an account.
   * @returns {Promise<any>}
  */
  async getTransactions() {
    return this.#safeCall('getTransactions', [], async () => {
      const result = await this.#request(
        gql`
          query GetTransactions($id: Int!) {
            transactionsByAccount(idAccount: $id) {
              txid
              value
              fee
              time
              height
            }
          }
        `, {
          id: this.accountId
        }
      );
      return result?.transactionsByAccount ?? [];
    });
  }

  /**
   * Get transaction info.
   * @param {string} txid
   * @returns {Promise<any>}
  */
  async getTransactionInfo(txid) {
    return this.#safeCall('getTransactionInfo', () => this.#defaultTransactionInfo(txid), async () => {
      const result = await this.#request(
        gql`
          query GetTransactionInfo($id: Int!, $txid: String!) {
            transactionById(idAccount: $id, txid: $txid) {
              height
              txid
              value
              notes {
                address
                memo
                value
                pool
              }
              outputs {
                value
                memo
                address
                pool
              }
              spends {
                address
                diversifier
                memo
                pool
                value
              }
            }
          }
        `, {
          id: this.accountId,
          txid: txid
        }
      );
      return result?.transactionById ?? this.#defaultTransactionInfo(txid);
    });
  }

  /**
   * Fetch the latest transaction id.
   * @returns {Promise<any>}
  */
  async getLastTxId() {
    return this.#safeCall('getLastTxId', { txid: null }, async () => {
      const result = await this.#request(
        gql`
          query GetLastTxId($id: Int!) {
            transactionsByAccount(idAccount: $id) {
              txid
            }
          }
        `, {
          id: this.accountId
        }
      );
      return result?.transactionsByAccount?.[0] ?? { txid: null };
    });
  }

  /**
   * Fetch latest block height.
   * @returns {Promise<any>}
  */
  async getServerHeight() {
    return this.#safeCall('getServerHeight', 0, async () => {
      const result = await this.#request(
        gql`
          query GetServerHeight {
            currentHeight
          }
        `
      );
      return result?.currentHeight ?? 0;
    });
  }

  /**
   * Get account synched height.
   * @returns {Promise<any>}
  */
  async getWalletHeight() {
    return this.#safeCall('getWalletHeight', 0, async () => {
      const result = await this.#request(
        gql`
          query GetWalletHeight($filter: AccountFilter!) {
            accounts(accountFilter: $filter) {
              height
            }
          }
        `, {
          filter: {
            id: this.accountId
          }
        }
      );
      return result?.accounts?.[0]?.height ?? 0;
    });
  }

  /**
   * Submit a transaction payload.
   * @param {object} sendJson
   * @returns {Promise<any>}
  */
  async sendTransaction(sendJson) {
    return this.#safeCall('sendTransaction', { pay: null }, async () => {
      const recipients = (Array.isArray(sendJson) ? sendJson : [sendJson])
        .filter(Boolean)
        .map((el) => {
          return {
            address: el?.address ?? '',
            amount: el?.amount ?? 0,
            memo: el?.memo ?? ''
          };
        });

      if(recipients.length === 0) {
        return { pay: null };
      }

      const result = await this.#request(
        gql`
          mutation SendTransaction($id: Int!, $sendTos: [Recipient!]!) {
            pay(idAccount: $id, payment: { recipients: $sendTos })
          }
        `,
        {
          id: this.accountId,
          sendTos: recipients
        }
      );
      return result ?? { pay: null };
    });
  }

  /**
   * Synchronize an account with the backend.
   * @returns {Promise<any>}
  */
  async synchronize() {
    return this.#safeCall('synchronize', { synchronize: false }, async () => {
      const result = await this.#request(
        gql`
          mutation SynchronizeAccount($ids: [Int!]!) {
            synchronize(idAccounts: $ids)
          }
        `, {
          ids: this.accountId
        }
      );
      return result ?? { synchronize: false };
    });
  }

  /**
   * Spawn a new sync task.
   * @returns {Promise<any>}
  */
  spawnSyncTask() {
    if(this.syncTask) {
      clearInterval(this.syncTask);
    }

    const syncTimer = setInterval(async () => {
      if(this.syncLock) {
        console.log('Already have a sync task running');
        return;
      }

      this.syncLock = true;

      try {
        const serverHeight = await this.getServerHeight();
        const accHeight = await this.getWalletHeight();
        console.log(`Chain tip: ${serverHeight} | Wallet height: ${accHeight}`);

        if(serverHeight <= accHeight) {
          this.syncRetryCount = 0;
          console.log('No new blocks.');
          return;
        }

        if(this.syncRetryCount >= this.maxSyncRetries) {
          console.log('Sync retry limit reached. Skipping this cycle.');
          return;
        }

        console.log(`${serverHeight - accHeight} new blocks`);
        this.synchronize().then((res) => {
          this.syncRetryCount = 0;
          console.log('Wallet sync completed.', res);
        }).catch((error) => {
          this.#logError('spawnSyncTask', error);
          this.syncRetryCount += 1;

          if(this.syncRetryCount >= this.maxSyncRetries) {
            console.log('Sync retry limit reached after errors.');
          }
        });
        return;
      }
      catch (error) {
        this.#logError('spawnSyncTask', error);
        this.syncRetryCount += 1;

        if(this.syncRetryCount >= this.maxSyncRetries) {
          console.log('Sync retry limit reached after errors.');
        }
      }
      finally {
        this.syncLock = false;
      }
    }, this.syncIntervalMs);

    console.log('Sync task spawned.');
    return syncTimer;
  }

}


module.exports = { ZkoolClient, gql };
