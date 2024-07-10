import axios, { AxiosInstance } from "axios";

const instance: AxiosInstance = axios.create({
  baseURL: " https://zecfaucet.com:2653",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
  }
});

export default instance;
