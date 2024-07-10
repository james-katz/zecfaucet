import React, { useState, useEffect } from 'react';
import http from '../../../http-common';
import ReceiveZec from '../../FaucetList/ReceiveZec';
import FaucetBalance from '../../FaucetList/FaucetBalance';
import zecFaucetImage from '../../../assets/zecfaucet1.png'; 
import CoinTickerWidget from '../../CoinTickerWidget';
import { Container, Description, Header, Image, Row, ToggleButton } from './styles';
import FaucetStats from '../../FaucetList/FaucetStats';
import RecentDonations from '../../FaucetList/RecentDonations';
import { FaSun, FaMoon } from 'react-icons/fa'; 

interface Payout {
  u: number;
  z: number;
  t: number;
}
interface Stats {
  sent: number;
  claims: number;
}

interface FaucetAppProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}


const FaucetApp: React.FC<FaucetAppProps> = ({darkMode, toggleDarkMode}) => {
  const [balance, setBalance] = useState<number>(0);
  const [payout, setPayout] = useState<Payout>({ u: 0, z: 0, t: 0 });
  const [donate, setDonate] = useState<string>('');
  const [donations, setDonations] = useState<[]>([]); 
  const [stats, setStats] = useState<Stats>({ sent: 0, claims: 0 });

  useEffect(() => {
    const getFaucetPayout = () => {
      http.get('/payout')
      .then((res) => {
        setPayout({
          u: res.data.u_pay,
          z: res.data.z_pay,
          t: res.data.t_pay
        });
      })
        .catch((error) => {
          console.error('Error fetching faucet payout:', error);
        });
    };

    const getDonateAddress = () => {
      http.get('/donate')
        .then((res) => {
          setDonate(res.data);
        })
        .catch((error) => {
          console.error('Error fetching donate address:', error);
        });
    };

    const getFaucetBalance = () => {
      http.get('/balance')
        .then((res) => {
          setBalance(res.data);
        })
        .catch((error) => {
          console.error('Error fetching faucet balance:', error);
        });
    };

    const getLatestDonations = () => {
      http.get('/txns')
        .then((res) => {
          setDonations(res.data);
        })
        .catch((error) => {
          console.error('Error fetching latest donations:', error);
        });
    };

    const getFaucetStats = () => {
      http.get('/stats')
        .then((res) => {
          setStats(res.data);
        })
        .catch((error) => {
          console.error('Error fetching faucet stats:', error);
        });
    };

    getFaucetPayout();
    getDonateAddress();
    getFaucetBalance();
    getLatestDonations();
    getFaucetStats();


    const updateFaucetBalanceInterval = setInterval(getFaucetBalance, 75 * 1000);
    const updateLatestDonationsInterval = setInterval(getLatestDonations, 75 * 1000);

    return () => {
      clearInterval(updateFaucetBalanceInterval);
      clearInterval(updateLatestDonationsInterval);
    };
  }, []);

  
  return (
    <Container >
      <ToggleButton onClick={toggleDarkMode}>
        {darkMode ? <FaSun /> : <FaMoon />} 
      </ToggleButton>
      <Image alt="ZecFaucet.com" src={zecFaucetImage} />
      <Header>Welcome to ZecFaucet.com</Header>

      <ReceiveZec payout={payout} />
      <FaucetBalance balance={balance} donate={donate} />
      <FaucetStats stats={stats}  />
      <RecentDonations donations={donations} />

      <Row>
        <CoinTickerWidget coinId="zcash" currency="usd" locale="pt" />
      </Row>

      <Description>ZecFaucet.com is not affiliated with ECC or Zcash Foundation.</Description>
    </Container>
  );
}

export default FaucetApp;
