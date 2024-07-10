import React from 'react';
import { Container, Donations, List, Row, Table, Td, Th } from './styles';
interface TxDetails {
  amount: number;
  memos: string[];
}

interface Donation {
  txDetails: TxDetails[];
  time: number;
}

interface RecentDonationsProps {
  donations: Donation[];
}

const RecentDonations: React.FC<RecentDonationsProps> = ({ donations }) => {
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
                <Td>{donation.txDetails[0].amount} ZEC</Td>
                <Td>{new Date(donation.time * 1000).toLocaleDateString()}</Td>
                <Td>{donation.txDetails[0].memos ? donation.txDetails[0].memos[0] : 'No memo available'}</Td>
              </Row>
            ))}
          </tbody>
        </Table>
      </List>
    </Container>
  );
};

export default RecentDonations;
