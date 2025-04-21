import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import './index.css';
import httpCommon from '../../http-common';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';

export default function DonateSection({ coin }) {  
  const [ua, setUa] = useState('Loading ...');
  const [qr, setQr] = useState('');
  const [balance, setBalance] = useState('Loading ...');
  
  const ref = useRef();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 80%', 'end 20%'], // triggers when 80% into viewport
  });

  const x = useTransform(scrollYProgress, [0, 0.5, 1], ['-100%', '0%', '0%']);
 
  function handleCopy() {
    navigator.clipboard.writeText(ua);
    toast.success('Address copied to clipboard!');
  }

  useEffect(() => {
    // Get faucet address from backend
    httpCommon.get('/donate').then(res => {
      if (res.status == 200) {        
        setUa(res.data); 
        QRCode.toDataURL(ua).then(setQr);
      }      
    }).catch((err) => { console.log(err) });    

    // get balance of the faucet
    const updateBalance = () => {
      httpCommon.get('/balance').then(res => {
        if (res.status == 200) {        
          setBalance(`${res.data} ${coin}`);
        }      
      }).catch((err) => { console.log(err) });    
    }

    // Update balance on component mount
    updateBalance();

    // set a 75 seconds interval to update balance
    const balanceIntervalId = setInterval(() => {
      updateBalance();
    }, 75 * 1000);

    // clear interval on unmount
    return () => { clearInterval(balanceIntervalId) }
  }, [ua]);

  return (
    <section className="donate-section snap-section" ref={ref}>
      <div className="donate-left">
        {/* 🎥 Animated overlay */}
        <motion.div className="white-swipe" style={{ x }} />
        <div className="donate-left-content">
          <h2>Donate to <br /><strong>zecfaucet.com</strong></h2>
          <img src={qr} alt="ZecFaucet Shielded Address" className='donate-address'/>
          <h3>Faucet balance</h3>          
          <p>{balance}</p>
        </div>
      </div>

      <div className="donate-right">
        <div className='donate-right-content'>
          <h2>ZecFaucet Unified Address</h2>
          <code>
            {ua}
          </code>
          <button
            onClick={handleCopy}
            className="copy-button"
          >
            COPY ADDRESS
          </button>
        </div>
      </div>
    </section>
  );
}
