import { useState } from 'react';
import './index.css';

export default function FaucetClaim() {
  const [userAddress, setUserAddress] = useState('');

  const handleInputChange = (e) => {
    setUserAddress(e.target.value);
  };

  const handleSubmit = () => {
    if (!wallet) return alert('Please enter a wallet address!');
    console.log('Claiming faucet for wallet:', userAddress);
    // 👉 You can call your backend/faucet API here
  };

  return (
    <div className="faucet-claim">
      <input
        type="text"
        placeholder="Insert your wallet address here"
        value={userAddress}
        onChange={handleInputChange}
        className="faucet-input"
      />
      <button onClick={handleSubmit} className="faucet-button">
        SEND NOW
      </button>
    </div>
  );
}
