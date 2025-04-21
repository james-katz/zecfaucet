import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import httpCommon from '../../http-common';
import './index.css';

export default function FaucetStats({ testnet }) {
  const ref = useRef();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'], // when the section enters and leaves
  });

  const x = useTransform(scrollYProgress, [0, 0.5, 1], ['-100%', '0%', '0%']);

  const [coinName, setCoinName] = useState(testnet ? 'TAZ' : 'ZEC');
  const [totalSent, setTotalSent] = useState('Loading ...');
  const [totalClaims, setTotalClaims] = useState('Loading ...');

  const [topDonations, setTopDonations] = useState([
    { time: '2024-04-01', amount: 1.2345, memo: 'Zcash to the moon 🚀' }
  ]);

  useEffect(() => {
    // Function to get faucet stats
    const updateStats = () => {
      httpCommon.get('/stats').then((res) => {
        if(res.status === 200) {
          setTotalSent(`${res.data.sent.toLocaleString('en-US')} ${coinName}`);
          setTotalClaims(`${res.data.claims.toLocaleString('en-US')}`);
        }
      });
    }

    // Function to get faucet stats
    const updateDonations = () => {
      httpCommon.get('/txns').then((res) => {
        if(res.status === 200) {
          
          const donations = res.data.map((tx) => {
            return {
              date: new Date(tx.time).toLocaleDateString('en-US'),
              amount: tx.value,
              memo: tx.memo
            }
          });
          
          setTopDonations(donations);
        }
      });
    }
    
    // Update stats on mount
    updateStats();
    updateDonations();

    // update stats every 75 seconds
    const updateStatsTimerId = setInterval(() => {
      updateStats();
      updateDonations();
    }, 75 * 1000);

    // clear timer on unmount
    return () => { clearInterval(updateStatsTimerId) }
  }, []);

  return (
    <section className="stats-section snap-section" ref={ref}>
      <div className="stats-left">
        {/* 🎥 Animated overlay */}
        <motion.div className="yellow-swipe" style={{ x }} />
        <div className="stats-left-content">
          <h2>Faucet<br />Statistics</h2>
          <p>Total {coinName} sent</p>
          <h3>{totalSent}</h3>
          <p>Total claims</p>
          <h3>{totalClaims}</h3>
        </div>
      </div>

      <div className="stats-right">
        <div className="stats-right-content">
          <h2>Top Donations</h2>
          <table className="donations-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount ({coinName})</th>
                <th>Memo</th>
              </tr>
            </thead>
            <tbody>
              {topDonations.map((donation, idx) => (
                <tr key={idx}>
                  <td>{donation.date}</td>
                  <td>{donation.amount.toFixed(4)}</td>
                  <td title={donation.memo}
>{donation.memo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
