# Zecfaucet
This is a very basic Zcash faucet.
It uses [zingolib-wrapper](https://github.com/james-katz/zingolib-wrapper) as  Zcash wallet backend.

## How to use it
1) Clone this repo, clone zingolib-wrapper and build zingolib-wrapper
```
$ git clone https://github.com/james-katz/zecfaucet.git
$ cd zecfaucet
$ git clone https://github.com/james-katz/zingolib-wrapper
$ cd zingolib-wrapper
$ npm install
$ npm run neon
```

You'll need rust, openssl-dev and a few other dependencies.

2) Change directory back to zecfaucet, configure and build the frontend.

Edit `src/http-common.js` and change `baseURL` to your ip address or domain.

Edit `/src/components/ReceiveZec.vue` and change `vue-hcaptcha sitekey` to your hcaptcha site key.
Edit `.env` and set `HCAPTCHA_SECRET` to your hcaptcha secret key.

Edit `server.js` if using https change `useHttps` to `true` and configure the certificates at the bottom of the file.

Build the Vue app for distribution
```
$ npm install
$ npm run build
```

Coopy `./dist` contents to webserver directory

Run the backend service
```
$ node server.js
```

or

Run a dev environment locally
```
$ npm run start:dev
```

---
This is actually a proof of concept, there's a few bugs, and the code could improve a lot. Please take a look at the issues and fell free to send a pull request. :)
