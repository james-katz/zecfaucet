<template>
  <div class="container">
    <img alt="ZecFaucet.com" src="./assets/zecfaucet1.png"> 
    <h1>Welcome to ZecFaucet.com</h1>  

    <ReceiveZec v-bind:payout="payout"/>

    <FaucetBalance v-bind:balance="balance" v-bind:donate="donate" />

    <FaucetStats v-bind:stats="stats" />

    <RecentDonations v-bind:donations="donations" />
    
    <div class="row">
      <!-- <h2>Zcash price:</h2> -->
      
        <coingecko-coin-ticker-widget coin-id="zcash" currency="usd" locale="en" ></coingecko-coin-ticker-widget>    
      
      <hr/>
    </div>
    <p>ZecFaucet.com is not afiliated with ECC or Zcash Foundation.</p>
  </div>
</template>

<script>
import FaucetBalance from './components/FaucetBalance.vue'
import FaucetStats from './components/FaucetStats.vue'
import ReceiveZec from './components/ReceiveZec.vue'
import RecentDonations from './components/RecentDonations.vue';
import http from './http-common';
import '@/styles.css'

export default {
  name: 'App',
  components: {
    FaucetBalance,
    FaucetStats,
    ReceiveZec,
    RecentDonations
},
  mounted: function() {
    this.getFaucetPayout();
    this.getDonateAddress();
    this.updateFaucetBalance();
    this.updateLatestDonations();
  },
  data: () => ({
    balance: 0,
    payout: {
      u: 0.0,
      z: 0.0,
      t: 0.0
    },
    donate: '',
    donations: [],
    stats: {}
  }),
  methods: {
    getFaucetPayout() {
      http.get('/payout').then((res) => {
        this.payout.u = res.data.u_pay;
        this.payout.z = res.data.z_pay;
        this.payout.t = res.data.t_pay;
      });
    },
    getDonateAddress() {
      http.get('/donate').then((res)=>{
        this.donate = res.data;
      });
    },
    getFaucetBalance() {
      http.get('/balance').then((res)=>{
        this.balance = res.data;
      });
    },
    updateFaucetBalance() {
      this.getFaucetBalance();
      setInterval(() => {
        this.getFaucetBalance();
      }, 75 * 1000);
    },
    getLatestDonations() {
      http.get('/txns').then((res)=>{
        this.donations = res.data;
      });
      http.get('/stats').then((res)=>{
        this.stats = res.data;
      });
    },
    updateLatestDonations() {
      this.getLatestDonations();
      setInterval(() => {
        this.getLatestDonations();
      }, 75 * 1000);
    }
  }
}
</script>


