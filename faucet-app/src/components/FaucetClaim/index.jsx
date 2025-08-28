import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import ProofOfWorkModal from '../ProofOfWorkModal';
import httpCommon from '../../http-common';
import { useLocation } from 'react-router-dom';
import './index.css';
import VoucherModal from '../VoucherModal';
import SliderCaptchaBox from '../SliderCaptcha';

import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';

export default function FaucetClaim( { applyVoucher } ) {
  const [userAddress, setUserAddress] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [challenge, setChallenge] = useState({});
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  const [puzzleId, setPuzzleId] = useState("");

  const [voucherModalVisible, setVoucherModalVisible] = useState(false);
  const [voucher, setVoucher] = useState('');

  const [enableVoucher, setEnableVoucher] = useState(false);

  const [canClick, setCanClick] = useState(false);

  const { executeRecaptcha } = useGoogleReCaptcha();

  const { pathname } = useLocation();
  
  const handlePuzzleSolved = (id) => {
    setTimeout(() => {
      setPuzzleSolved(true);      
      setPuzzleId(id);
    }, 1000);    
  }

  const handleResetPuzzle = () => {
      setPuzzleSolved(false);
      setPuzzleId("");
      setCanClick(true);    
  }

  useEffect(() => {
    // if(pathname === '/test') {
      console.log('Enabling voucher...')
      setEnableVoucher(true);
    // }

    setCanClick(true);
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

  const handleSubmit = async() => {
    if (!userAddress) return toast.error('Please enter a Zcash Unified address!');
    
    setCanClick(false);

    const captchaToken = await executeRecaptcha('claim');

    httpCommon.post('/challenge', { address: userAddress, voucher: voucher, token: captchaToken, puzzle: puzzleId } ).then((res) => {
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
        setCanClick(true);
        toast.error(res.data.message);
      }
      else {
        setCanClick(true);
        toast.error("Service unavailable.");
      }
    });
  };

  const handleSuccess = ({ nonce, hash }) => {
    setModalVisible(false);
    setVoucher('');
    applyVoucher('');
    setUserAddress('');
    setCanClick(true);

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

  return (
    <div className="faucet-claim">
      {enableVoucher && (
        <a href="#" className="coupon-button" onClick={handleVoucherModal}>🏷️ Apply coupon {voucher ? `(${voucher.toUpperCase()})` : ``}</a>
      )}

      <input
        type="text"
        placeholder="Insert your wallet address here"
        value={userAddress}
        onChange={handleInputChange}
        className="faucet-input"
      />
      {puzzleSolved ? (
        <button onClick={handleSubmit} className="faucet-button" disabled={!canClick}>
          {canClick ? ("SEND NOW"):("Please wait ...")}        
        </button>
      ): (
        <SliderCaptchaBox onPassed={handlePuzzleSolved} onReset={handleResetPuzzle} />

      )}

      {/* Modals */}
      <ProofOfWorkModal
        visible={modalVisible}
        challenge={challenge}
        onDecline={() => {
            setCanClick(true);          
            setModalVisible(false);
          }
        }
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
