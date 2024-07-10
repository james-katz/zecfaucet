import styled from "styled-components";

export const Row = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

export const Heading2 = styled.h2`
left: 1px;
  font-size: 1.5em;
  margin-bottom: 10px;
`;

export const FaucetBalanceSpan = styled.span`
  font-size: 1.2em;
  font-weight: bold;
`;

export const DonateHeading = styled.h4`
  font-size: 1.2em;
  margin-top: 20px;
`;

export const DonationQR = styled.div`
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

export const QRCodeImage = styled.img`
  width: 100%;
  max-width: 200px;
  height: auto;
  margin-bottom: 10px;
`;

export const DonationAddress = styled.span`
  font-size: 0.9em;
  font-family: monospace;
  word-break: break-all;
`;
