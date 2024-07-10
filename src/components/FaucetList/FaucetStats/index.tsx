import React from 'react';
import { Row, StatsContainer, StatsTitle, StatsValue } from './styles';

interface Stats {
  sent: number;
  claims: number;
}

interface FaucetStatsProps {
  stats: Stats;
}

const FaucetStats: React.FC<FaucetStatsProps> = ({ stats }) => {
  return (
    <Row>
    <h2>Faucet Statistics:</h2>
    <StatsContainer>
      <StatsTitle>Total ZEC sent</StatsTitle>
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
