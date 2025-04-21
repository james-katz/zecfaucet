import './index.css';
import logo from '../../images/zecfaucet_2.0.gif';
import bgVideo from '../../images/ZFbackgound.mp4';
import FaucetClaim from '../FaucetClaim';
import { useEffect, useState } from 'react';
import httpCommon from '../../http-common';

export default function Header({coin}) {
  const [faucetPayout, setFaucetPayout] = useState({
    u_pay: 0,
    z_pay: 0,
    t_pay: 0
  });


  useEffect(() => {    

    httpCommon.get('/payout').then((res) => {
      if(res.data && res.data.status == 200) {        
        setFaucetPayout(res.data.payout)
      }
    });
  }, []);

  return (
    <div className="header-wrapper">
      {/* 🎥 Video Background */}
      <video
        className="header-video-bg"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src={bgVideo} type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* 🌐 Content */}
      <header className="header">
        <div className="header-logo-mobile">
          <img src={logo} alt="ZecFaucet logo" />
        </div>
        <div className="header-text">
          <h1 className="faucet-text">
            Welcome to<br />
            <strong>zecfaucet.com</strong>
          </h1>
          <p>Enter your Zcash address to</p>
          <p>receive {faucetPayout.u_pay} {coin}</p>
          <p className="warning">
            ZecFaucet only sends to Unified Addresses 
            <br />
            (addresses that start with the letter "u").
          </p>
          <p className="info-ua">Zcash Unified Addresses combine all address types into one, making privacy the default and easier to use.</p>
          {/* <ul className="receive-address">
            <li>
              * Receive {faucetPayout.u_pay} {coinName} if using Orchard address (starts with letter{' '}
              <code>u</code>)
            </li>
            <li>
              * Receive {faucetPayout.z_pay} {coinName} if using Sapling address (starts with letter{' '}
              <code>z</code>)
            </li>
          </ul> */}
        </div>

        <div className="header-logo">
          <img src={logo} alt="ZecFaucet logo" />
        </div>        
      </header>      
      <FaucetClaim />
    </div>
  );
}
