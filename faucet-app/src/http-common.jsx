import axios from "axios";

export default axios.create({
  baseURL: "http://localhost:2653/api",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
  }
});