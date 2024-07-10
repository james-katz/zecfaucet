import React from 'react';
import { DonateHeading, DonationAddress, DonationQR, FaucetBalanceSpan, Heading2, QRCodeImage, Row } from './styles';

interface FaucetBalanceProps {
  balance: number;
  donate: string;
}

const FaucetBalance: React.FC<FaucetBalanceProps> = ({ balance, donate }) => {
    return (
        <Row>
          <Heading2>Faucet balance:</Heading2>
          <FaucetBalanceSpan>{balance} ZEC</FaucetBalanceSpan>
    
          <DonateHeading>Donate to ZecFaucet.com:</DonateHeading>
          <DonationQR>
            <QRCodeImage src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&color=231f20&data=${donate}`} alt="QR Code" />
            <DonationAddress>{donate}</DonationAddress>
          </DonationQR>
        </Row>
      );
    };

export default FaucetBalance;
