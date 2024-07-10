import React, { useState, useEffect } from 'react'; 
import http from '../../../http-common';
import getBrowserFingerprint from 'get-browser-fingerprint';
import { Button, Container, FormContainer, Heading, Input, Message, P, Paragraph, SubHeading, SuccessMessage } from './styles';
import HCaptcha from '@hcaptcha/react-hcaptcha';

interface Payout {
  u: number;
  z: number;
}

interface ReceiveZecProps {
  payout: Payout;
  
}

const ReceiveZec: React.FC<ReceiveZecProps> = ({ payout }) => {
  const [address, setAddress] = useState<string>('');
  const [receive, setReceive] = useState<number>(0);
  const [fingerprint, setFingerprint] = useState<string>(''); 
  const [syncing, setSyncing] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [invalid, setInvalid] = useState<boolean>(false);
  const [dry, setDry] = useState<boolean>(false);
  const [greedy, setGreedy] = useState<boolean>(false);
  const [transparent, setTransparent] = useState<boolean>(false);
  const [waitfor, setWaitfor] = useState<number>(0);
  const [disableBtn, setDisableBtn] = useState<boolean>(false);
  const [token, setToken] = useState<string>('');
  const [solveCaptcha, setSolveCaptcha] = useState<boolean>(false);
  const [invalidCaptcha, setInvalidCaptcha] = useState<boolean>(false);
  const [verified, setVerified] = useState<boolean>(false);

  useEffect(() => {
    const opt = {
      hardwareOnly: false,
      enableWebgl: true,
      debug: false
    };
    const fp = getBrowserFingerprint(opt);
    setFingerprint(fp); 
  }, []);

  const handleClaim = () => {
    setDisableBtn(true);

    if (!verified) {
      setSolveCaptcha(true);
    } else {
      http.post("/add", { address, fingerprint, token }).then((res) => {
        if (res.data === 'syncing') setSyncing(true);
        else if (res.data.success === 'success') {
          setSuccess(true);
          setReceive(res.data.amount);
        } else if (res.data === 'faucet-dry') setDry(true);
        else if (res.data === 'transparent') setTransparent(true);
        else if (res.data === 'invalid') setInvalid(true);
        else if (res.data === 'invalid-token') setInvalidCaptcha(true);
        else if (res.data.startsWith('greedy')) {
          setWaitfor(parseInt(res.data.split(" ")[1]));
          setGreedy(true);
        }
      });
    }

    setTimeout(() => {
      setDisableBtn(false);
      setSyncing(false);
      setInvalid(false);
      setSuccess(false);
      setGreedy(false);
      setDry(false);
      setTransparent(false);
      setAddress('');
      setSolveCaptcha(false);
      setInvalidCaptcha(false);
    }, 15 * 1000);
  };

  const handleCaptchaVerify = (tokenStr: string | null) => {
    if (tokenStr !== null) {
      setVerified(true);
      setToken(tokenStr);
    }
  };
  
  const handleCaptchaExpired = () => {
    setVerified(false);
  };



  return (
    <Container>
      <Heading>Enter your Zcash address to receive up to {payout.u} ZEC:</Heading>
      <SubHeading>* Receive {payout.u} ZEC if using Orchard address</SubHeading>
      <SubHeading>* Receive {payout.z} ZEC if using Sapling address</SubHeading>
      <SubHeading>* ZecFaucet does not send to transparent addresses.</SubHeading>
      <Paragraph>Don't have a Zcash wallet? Find the best wallet <a href="https://z.cash/wallets">here</a>.</Paragraph>
      <P>ZecFaucet recommended wallet: <a href="https://electriccoin.co/zashi/">Zashi.</a></P>
      <Input type="text" value={address} onChange={(e) => setAddress(e.target.value)}  placeholder='Insert your wallet here!'/>
      <Message style={{ display: solveCaptcha ? 'block' : 'none' }}>Please solve the captcha before claiming.</Message>
      <Message style={{ display: invalidCaptcha ? 'block' : 'none' }}>Sorry, we couldn't verify you're not a robot.</Message>
      <Message style={{ display: syncing ? 'block' : 'none' }}>It looks like the backend wallet is not synchronized! Please wait a few minutes and try again.</Message>
      <Message style={{ display: invalid ? 'block' : 'none' }}>Invalid address! Please verify if you entered your Zcash address correctly and try again.</Message>
      <Message style={{ display: dry ? 'block' : 'none' }}>It looks like the faucet wallet don't have enough funds 🥹</Message>
      <Message style={{ display: transparent ? 'block' : 'none' }}>Sorry, ZecFaucet has discontinued claims to transparent addresses.</Message>
      <SuccessMessage style={{ display: success ? 'block' : 'none' }}>Success! Your address has been added to the payout queue. In a few minutes you will receive {receive} ZEC.</SuccessMessage>
      <Message style={{ display: greedy ? 'block' : 'none' }}>Please wait {waitfor} minutes before claiming again.</Message>
      <FormContainer>
      <HCaptcha
          sitekey="b72d3642-0e4a-4ed5-b859-4f6100592d26"
          onVerify={(token) => handleCaptchaVerify(token)}
          onExpire={() => handleCaptchaExpired()}
        />
        <Button onClick={handleClaim} disabled={disableBtn}>Send Now</Button>
      </FormContainer>
    </Container>
  );
};

export default ReceiveZec;
