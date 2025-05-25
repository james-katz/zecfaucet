import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import ProofOfWorkModal from '../ProofOfWorkModal';
import httpCommon from '../../http-common';
// import { useLocation } from 'react-router-dom';
import './index.css';
import VoucherModal from '../VoucherModal';

import { GoogleReCaptchaProvider, GoogleReCaptcha } from "react-google-recaptcha-v3";

export default function FaucetClaim( { applyVoucher } ) {
  const [userAddress, setUserAddress] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [challenge, setChallenge] = useState({});
  
  const [voucherModalVisible, setVoucherModalVisible] = useState(false);
  const [voucher, setVoucher] = useState('');

  const [captchaToken, setCaptchaToken] = useState("");
  const [refreshReCaptcha, setRefreshReCaptcha] = useState(false);

  // const { pathname } = useLocation();
  
  useEffect(() => {
    // if(pathname === '/vitorpio') {
    //   setVoucher('zcash2025');
    //   applyVoucher('zcash2025');
    // }
  },[]);

  const handleInputChange = (e) => {
    setUserAddress(e.target.value);
  };

  const handleVoucherModal = (e) => {
    e.preventDefault();
    setVoucher('');
    applyVoucher('');
    setVoucherModalVisible(true);
  }

  const onSuccessVoucher = ({code}) => {    
    setVoucher(code);
    applyVoucher(code);
    setVoucherModalVisible(false);
  }

  const handleSubmit = () => {
    if (!userAddress) return toast.error('Please enter a Zcash Unified address!');
    httpCommon.post('/challenge', { address: userAddress, voucher: voucher, token: captchaToken } ).then((res) => {
      if(res.data && res.data.status == 200) {        
        setChallenge({
          id: res.data.message.id,
          msg: res.data.message.message,
          difficulty: res.data.message.difficulty,
          vpn: res.data.message.vpn
        });
        setModalVisible(true);
        setRefreshReCaptcha(res.data.message.id);    
      }
      else if(res.data && res.data.message) {
        setRefreshReCaptcha(res.data.message);
        toast.error(res.data.message);
      }
      else {
        setRefreshReCaptcha(false);
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
  };

  const handleOnVerify = (getToken) => {
    setCaptchaToken(getToken);
  };

  return (
    <div className="faucet-claim">
      <a href="#" className="coupon-button" onClick={handleVoucherModal}>🏷️ Apply coupon {voucher ? `(${voucher.toUpperCase()})` : ``}</a>
      {/* <form> */}
      <input
        type="text"
        placeholder="Insert your wallet address here"
        value={userAddress}
        onChange={handleInputChange}
        className="faucet-input"
      />
      <button onClick={handleSubmit} className="faucet-button" disabled={captchaToken == ''}>
        {captchaToken == '' ? ("Please wait ..."):("SEND NOW")}
      </button>   
      {/* Google's reCaptcha v3 */}
      <GoogleReCaptchaProvider reCaptchaKey="6LckEEgrAAAAAO4sSoOtKsNtVlKFl6DyraY69LPe">
          <GoogleReCaptcha            
            onVerify={handleOnVerify}
            refreshReCaptcha={refreshReCaptcha}
          />
      </GoogleReCaptchaProvider>
      {/* </form> */}
      {/* Modals */}
      <ProofOfWorkModal
        visible={modalVisible}
        challenge={challenge}
        onDecline={() => setModalVisible(false)}
        onSuccess={handleSuccess}
      />

      <VoucherModal
        visible={voucherModalVisible}
        onClose={() => setVoucherModalVisible(false)}
        onSuccess={onSuccessVoucher}
      />
    </div>
  );
}
