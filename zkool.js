const { GraphQLClient, gql } = require('graphql-request');

class ZkoolClient {
  constructor(endpoint, options = {}) {
    this.client = new GraphQLClient(endpoint, options);
    this.accountId = 1;
    this.syncTask = undefined;
  }

  async #request(document, variables, requestHeaders) {
    return this.client.request(document, variables, requestHeaders);
  }

  /**
   * Initialize wallet backend; resolves when ready.
   * @returns {Promise<any>}
  */
  async init() {
    return new Promise(async (resolve, reject) => {
      const rep = await this.#request(
        gql`
          query PingApiVersion {
            apiVersion
          }
        `
      );

      if(rep.apiVersion) {
        console.log("Zkool client initialized.");
        this.syncTask = this.spawnSyncTask();        
        resolve();
      }
      else {
        reject();
      }
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
  async createNewAccount(key, accountIndex, birth = 0, accountName, passphrase = "") {
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
    return result;
  }

  /**
   * List available accounts.
   * @returns {Promise<any>}
  */
  async getAccounts() {
    return this.#request(
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
  }

  /**
   * Get account by id.
   * @param {int} accountId
   * @returns {Promise<any>}
  */
  async getAccountById(accountId = this.accountId) {
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
    return result.accounts[0];
  }

  /**
   * Get account seed or UFVK.
   * @param {int} accountId
   * @returns {Promise<any>}
  */
  async getAccountSeed(accountId = this.accountId) {
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
          id: accountId
        }
      }
    );
    return result.accounts[0];
  }

  /**
   * Fetch wallet address.
   * @param {int} accountId
   * @returns {Promise<any>}
  */
  async getAddress(accountId = this.accountId) {
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
        id: accountId
      }
    );
    return result.addressByAccount;
  }

  /**
   * Get total balance for an account.
   * @param {int} accountId
   * @returns {Promise<any>}
  */
  async getTotalBalance(accountId = this.accountId) {
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
        id: accountId      
      }
    );
    return result.balanceByAccount;
  }

  /**
   * List transactions for an account.
   * @param {int} accountId
   * @returns {Promise<any>}
  */
  async getTransactions(accountId = this.accountId) {
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
        id: accountId
      }
    );
    return result.transactionsByAccount
  }

  /**
   * Get transaction info.
   * @param {int} accountId
   * @param {string} txid
   * @returns {Promise<any>}
  */
  async getTransactionInfo(accountId = this.accountId, txid) {
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
        id: accountId,
        txid: txid
      }
    );
    return result.transactionById;
  }

  /**
   * Fetch the latest transaction id.
   * @param {int} accountId
   * @returns {Promise<any>}
  */
  async getLastTxId(accountId = this.accountId) {
    const result = await this.#request(
      gql`
        query GetLastTxId($id: Int!) {
          transactionsByAccount(idAccount: $id) {
            txid
          }
        }
      `, {
        id: accountId
      }
    );
    return result.transactionsByAccount[0];
  }

  /**
   * Fetch latest block height.
   * @returns {Promise<any>}
  */
  async getServerHeight() {
    const result = await this.#request(
      gql`
        query GetServerHeight {
          currentHeight
        }
      `
    );
    return result.currentHeight;
  }

  /**
   * Get account synched height.
   * @param {int} accountId
   * @returns {Promise<any>}
  */
  async getWalletHeight(accountId = this.accountId) {
    let result = await this.#request(
      gql`
        query GetWalletHeight($filter: AccountFilter!) {
          accounts(accountFilter: $filter) {
            height
          }
        }
      `, {
        filter: {
          id: accountId
        }
      }
    );
    return result.accounts[0].height;
  }

  /**
   * Submit a transaction payload.
   * @param {int} accountId
   * @param {object} sendJson
   * @returns {Promise<any>}
  */
  async sendTransaction(accountId = this.accountId, sendJson) {
    return this.#request(
      gql`
        mutation SendTransaction($id: Int!, $sendTos: [Recipient!]!) {
          pay(idAccount: $id, payment: { recipients: $sendTos })
        }
      `,
      { 
        id: accountId, 
        sendTos: sendJson.map((el) => {
          return {
            address: el.address,
            amount: el.amount,
            memo: el.memo
          }
        })
       }
    );
  }

  /**
   * Synchronize an account with the backend.
   * @param {int} accountId
   * @returns {Promise<any>}
  */
  async synchronize(accountId = this.accountId) {
    return this.#request(
      gql`
        mutation SynchronizeAccount($ids: [Int!]!) {
          synchronize(idAccounts: $ids)
        }
      `, {
        ids: accountId
      }
    );    
  }


  /**
   * Spawn a new sync task.
   * @param {int} accountId
   * @returns {Promise<any>}
  */
  spawnSyncTask(accountId = this.accountId) {
    const syncTimer = setInterval(async () => {
        const serverHeight = await this.getServerHeight();
        const accHeight =  await this.getWalletHeight(accountId);
        console.log(`Chain tip: ${serverHeight} | Wallet height: ${accHeight}`);
        if(serverHeight > accHeight) {
          console.log(`${serverHeight - accHeight} new blocks`);
          this.synchronize(accountId).then(async (res) => {
            console.log("Wallet is up to date", res);            
          }).catch((err) => {console.log(err)});        
        }
        else {
          console.log("No new blocks.");
        }
    }, 60 * 1000); 
    console.log("Sync task spawned.");
    return syncTimer;
  }
}

module.exports = { ZkoolClient, gql };
