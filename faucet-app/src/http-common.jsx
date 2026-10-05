import axios from "axios";

export default axios.create({
  // Override with VITE_API_URL (e.g. "/api" to use the Vite dev proxy)
  baseURL: import.meta.env.VITE_API_URL || "https://zecfaucet.com:2653/api",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
  }
});