import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import ProofOfWorkModal from '../ProofOfWorkModal';
import httpCommon from '../../http-common';
import { useLocation } from 'react-router-dom';
import './index.css';

export default function FaucetClaim( { applyVoucher } ) {
  const [userAddress, setUserAddress] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [challenge, setChallenge] = useState({});
  
  const [voucher, setVoucher] = useState('');

  const { pathname } = useLocation();
  
  useEffect(() => {
    if(pathname === '/privacymap') {
      setVoucher('zcash2025');
      applyVoucher('zcash2025');
    }
  },[]);

  const handleInputChange = (e) => {
    setUserAddress(e.target.value);
  };

  const handleSubmit = () => {
    if (!userAddress) return toast.error('Please enter a Zcash Unified address!');
    httpCommon.post('/challenge', { address: userAddress, voucher: voucher } ).then((res) => {
      if(res.data && res.data.status == 200) {        
        setChallenge({
          id: res.data.message.id,
          msg: res.data.message.message,
          difficulty: res.data.message.difficulty,
          vpn: res.data.message.vpn
        });
        setModalVisible(true);        
      }
      else if(res.data && res.data.message) {
        toast.error(res.data.message);
      }
      else {
        toast.error("Service unavailable.");
      }
    });
  };

  const handleSuccess = ({ nonce, hash }) => {
    setModalVisible(false);
    const token = {
      id: challenge.id,
      nonce: nonce,
      hash: hash,
      voucher: voucher
    };    
    // console.log(token);

    httpCommon.post('/add', { address: userAddress, token: token } ).then((res) => {
          if(res.data && res.data.status == 200) {
            toast.success(res.data.message);
          }
          else if(res.data && res.data.message) {
            toast.error(res.data.message);
          }
        });
  }

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
      <ProofOfWorkModal
        visible={modalVisible}
        challenge={challenge}
        onDecline={() => setModalVisible(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
