import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom'; // Importar useOutletContext
import httpCommon from '../../http-common';
import ClaimsChart from './ClaimsChart';
import './index.css';

const MetricCard = ({ title, value, unit }) => (
  <div className="metric-card">
    <h4>{title}</h4>
    <p>{value} {unit}</p>
  </div>
);

export default function Dashboard() {
  const { coinName } = useOutletContext();

  const [stats, setStats] = useState({
    claimsPerHour: 'Loading ...', // Claims per hour
    totalClaims: 'Loading ...',   // Total claims
    totalSent: 'Loading ...',     // Total $ZEC sent
    totalReceived: 'Loading ...',     // Total $ZEC received
    faucetBalance: 'Loading ...', // Faucet balance  
    latestClaims: []  // Latest claims (last 7 days)
  });

  useEffect(() => {
    const fetchDashboardStats = () => {            
      httpCommon.get('/dashboard-stats') // Endpoint hipotético
        .then(res => {
          if (res.status === 200) {
            setStats({
              claimsPerHour: res.data.claimsPerHour,
              totalClaims: res.data.totalClaims.toLocaleString('en-US'),
              totalSent: res.data.totalSent.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 }),
              totalReceived: res.data.totalReceived.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 }),
              faucetBalance: res.data.faucetBalance.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 }),
              latestClaims: res.data.latestClaims
            });            
          }
        })
        .catch(err => {
          console.error("Erro ao buscar estatísticas do dashboard:", err);
          setStats({
            claimsPerHour: 'Error',
            totalClaims: 'Error',
            totalSent: 'Error',
            totalReceived: 'Error',
            faucetBalance: 'Error',
            latestClaims: []
          });
        });      
    };

    fetchDashboardStats();
    const intervalId = setInterval(fetchDashboardStats, 60000);

    return () => clearInterval(intervalId);
  }, []); // A dependência vazia está correta aqui

  return (
    <section className="dashboard-section">
      <h2>Faucet's Dashboard ({coinName || '...'})</h2>
      <div className="metrics-grid">
        <MetricCard title="Claims per hour" value={stats.claimsPerHour} />
        <MetricCard title="Total Claims" value={stats.totalClaims} />
        <MetricCard title={`Total Sent (${coinName || '...'})`} value={stats.totalSent} />
        <MetricCard title={`Total received (${coinName || '...'})`} value={stats.totalReceived} />
        <MetricCard title={`Faucet Balance (${coinName || '...'})`} value={stats.faucetBalance} />
      </div>
      <ClaimsChart data={stats.latestClaims} />
    </section>
  );
}

