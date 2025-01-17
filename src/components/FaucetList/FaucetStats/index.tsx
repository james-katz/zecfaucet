import React from 'react';
import { Row, StatsContainer, StatsTitle, StatsValue } from './styles';

interface Stats {
  sent: number;
  claims: number;
}

interface FaucetStatsProps {
  stats: Stats;
  testnet: boolean;
}

const FaucetStats: React.FC<FaucetStatsProps> = ({ stats, testnet }) => {
  return (
    <Row>
    <h2>Faucet Statistics:</h2>
    <StatsContainer>
      <StatsTitle>Total {testnet ? "TAZ" : "ZEC"} sent</StatsTitle>
      <StatsValue>{stats.sent}</StatsValue>
    </StatsContainer>
    <StatsContainer>
      <StatsTitle>Total claims</StatsTitle>
      <StatsValue>{stats.claims}</StatsValue>
    </StatsContainer>
  </Row>
  );
}

export default FaucetStats;
