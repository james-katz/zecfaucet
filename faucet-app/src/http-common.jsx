import axios from "axios";

export default axios.create({
  baseURL: "https://zecfaucet.com:2653/api",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
  }
});