import React from 'react';
import { Container, Donations, List, Row, Table, Td, Th } from './styles';
interface TxDetails {
  amount: number;
  memos: string[];
}

interface Donation {
  value: number;
  time: number;
  memo: string;
}

interface RecentDonationsProps {
  donations: Donation[];
  testnet: boolean;

}

const RecentDonations: React.FC<RecentDonationsProps> = ({ donations, testnet }) => {
  return (
    <Container>
      <Donations>Recent donations:</Donations>
      <List>
        <Table>
          <thead>
          
              <Th>Donation <br /> Amount</Th>
              <Th>Datetime</Th>
              <Th>Memo</Th>
            
          </thead>
          <tbody>
            {donations.map((donation, i) => (
              <Row key={i}>
                <Td>{donation.value} {testnet ? "TAZ" : "ZEC"}</Td>
                <Td>{new Date(donation.time).toLocaleDateString()}</Td>
                <Td>{donation.memo}</Td>
              </Row>
            ))}
          </tbody>
        </Table>
      </List>
    </Container>
  );
};

export default RecentDonations;
