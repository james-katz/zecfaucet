import { useState } from 'react';
import { toast } from 'react-hot-toast';
import httpCommon from '../../http-common';
import './index.css';

export default function LoginPage( {onLogin} ) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
  
    const handleLogin = async (e) => {
        e.preventDefault();
          
        httpCommon.post('/login', { username, password }).then((res) => {
            const {username, userId, token } = res.data;
            localStorage.setItem('authToken', token);
            localStorage.setItem('userId', userId);
            onLogin(); // update parent state
        }).catch (err => {
            console.log(err); 
            return toast.error('Username or password invalid!');
        });
    }
    
    return (
    <div className="login-container">
      <div className="login-box">
        <h2>Admin Login</h2>
        <form>
        <input
          type="text"
          placeholder="Username"
          className="login-input"
          autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          className="login-input"
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="login-button" onClick={handleLogin}>Login</button>
        </form>
      </div>
    </div>
  );
}
