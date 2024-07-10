<template>    
    <div class="row">        
        <h3>Enter you Zcash address to receive up to {{ payout.u }} ZEC*:</h3>
        <h5>* Receive {{ payout.u }} ZEC if using Orchard address</h5>
        <h5>* Receive {{ payout.z }} ZEC if using Sapling address</h5>
        <h5>* ZecFaucet does not send to transparent addresses.</h5>
        <br/>
        <p>Don't have a Zcash wallet? Find the best wallet <a href="https://z.cash/wallets">here</a>.</p>
        <p><b>ZecFaucet recommended wallet:</b> <a href="https://electriccoin.co/zashi/">Zashi</a>.</p>

        <input class="user-address" type="text" v-model="address">
        <button class="receive-zec" @click="claim" v-bind:disabled="disable_btn">Send</button>
        <!-- <h5>We're experiencing technical difficulties, keep in mind that you may not receive your claim. We apologize for that.</h5> -->
        <div class="invalid-address" v-if="solveCaptcha">Please solve the captcha before claiming.</div>
        <div class="invalid-address" v-if="invalidCaptcha">Sorry, we couldn't verify you're not a robot.</div>
        <div class="invalid-address" v-if="syncing">It looks like the backend wallet is not synchronized! Please wait a few minutes and try again.</div>
        <div class="invalid-address" v-if="invalid">Invalid address! Please verify if you entered your Zcash address corectly and try again.</div>
        <div class="invalid-address" v-if="dry">It looks like the faucet wallet don't have enough funds :(</div>
        <div class="invalid-address" v-if="transparent">Sorry, ZecFaucet has discontinued claims to transparent addresses.</div>
        <div class="success" v-if="success">Success! Your address has been added to the payout queue. In a few minutes you will receive {{ receive }} ZEC.</div>
        <div class="greedy" v-if="greedy">Please wait {{ waitfor}} minutes before claiming again.</div>
        <vue-hcaptcha sitekey="b72d3642-0e4a-4ed5-b859-4f6100592d26" @verify="captcchaVerify" @expired="captchaExpired"></vue-hcaptcha>
    </div>    
    
</template>
  
<script>
import http from '../http-common';
import getBrowserFingerprint from 'get-browser-fingerprint';
import VueHcaptcha from '@hcaptcha/vue3-hcaptcha';
import '@/components/ReceiveZecStyles.css'
export default {
    name: 'ReceiveZec',
    props: {
        payout: Object
    },
    components: { VueHcaptcha },
    mounted: function() {
        const opt = {
            hardwareOnly: false,
            enableWebgl: true,
            debug: false
        }
        const fp = getBrowserFingerprint(opt);
        this.fingerprint = fp;
    },
    data: () =>({
        address: "",
        receive: 0.0,
        fingerprint: "",
        syncing: false,
        success: false,
        invalid: false,
        dry: false,
        greedy: false,
        transparent: false,
        waitfor: 0,
        disable_btn: false,
        token: '',
        solveCaptcha: false,
        invalidCaptcha: false,
        verified: false
    }),
    methods: {
        claim() {
            
            // Disable claim button
            this.disable_btn = true;     
            
            if(!this.verified) {
                this.solveCaptcha = true;
            }            
            else {
                http.post("/add", {address: this.address, fingerprint: this.fingerprint, token: this.token}).then((res) => {                
                    if(res.data === 'syncing') this.syncing = true;
                    else if(res.data.success === 'success') {
                        this.success = true;
                        this.receive = res.data.amount
                    
                    }
                    else if(res.data === 'faucet-dry') this.dry = true;
                    else if(res.data === 'transparent') this.transparent = true;
                    else if(res.data === 'invalid') this.invalid = true;
                    else if(res.data === 'invalid-token') this.invalidCaptcha = true;
                    else if(res.data.startsWith('greedy')) {
                        this.waitfor = res.data.split(" ")[1];
                        this.greedy = true;
                    }
                });
            }
            // Re-enable button and clear messages after 15 seconds
            setTimeout(()=> {
                    this.disable_btn = false;
                    this.syncing = false;
                    this.invalid = false;
                    this.success = false;
                    this.greedy = false;
                    this.dry = false;
                    this.transparent = false;
                    this.address = "";
                    this.solveCaptcha = false;
                    this.invalidCaptcha = false;                    
                }, 15 * 1000);
        },
        captcchaVerify(tokenStr) {
            this.verified = true;
            this.token = tokenStr;
        },
        captchaExpired() {
            this.verified = false;
        }
    }
}
</script>


