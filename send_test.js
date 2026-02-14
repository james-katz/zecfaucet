const { ZkoolClient } = require('./zkool');

const zkool = new ZkoolClient("http://127.0.0.1:8000/graphql");

zkool.init().then(async () => {
    console.log('Zkool GraphQL API initialed!');
    let rep = await zkool.getAccounts();
    // console.log(accounts);
    if(rep && rep.accounts && rep.accounts.length > 0) {
      console.log(`Number of accounts found: ${rep.accounts.length}`);
      let acc = await zkool.getAccountById(rep.accounts[0].id);
      console.log(acc);
      const bal = await zkool.getTotalBalance(acc.id);
      console.log(bal);
      if(bal.total >= 0.0006) {
        const txPayload = [{
          address: "u14y42h9mxtm7gjmg9l0qz8s6z4nkuefg585nlslfm37cphdznctaw8htye62q4tjx65jklff8eshuchjyaafqwc0ammnfwyalyp6kecx8cuga4hn9pcf4zasx3j4ls4yvw8pwg7ft63j2afxqvq0aks8t8mehhhss5ugrml85sskwh4wn",
          amount: 0.0005,
          memo: "testing zkool graphql"
        }];
       
        const rep = await zkool.sendTransaction(acc.id, txPayload);
        console.log(rep);
      }
    }
    else {
      const acc = await zkool.createNewAccount("pave useless aware mother gloom pink viable soon guard stay local hunt weird already swallow bright illegal symbol bus twist patrol expect response grace", 0, 2972090, "zkool", "");
      console.log(acc);
    }
  })
  .catch((err) => {
    console.error('init failed', err);
  });
