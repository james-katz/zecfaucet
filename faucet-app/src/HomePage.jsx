import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom'; // Importar useOutletContext

import httpCommon from './http-common';
import PageHeader from "./components/PageHeader";
import DonateSection from "./components/FaucetBalance";
import FaucetStats from "./components/FaucetStats";
import About from "./components/About";
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';

// Este componente representa o conteúdo da página inicial
export default function HomePage() {
  const { coinName, faucetClosed } = useOutletContext();

  return (
    <GoogleReCaptchaProvider
      reCaptchaKey="6LckEEgrAAAAAO4sSoOtKsNtVlKFl6DyraY69LPe">
        <PageHeader coin={coinName} faucetClosed={faucetClosed} />
        <DonateSection coin={coinName}/>
        <FaucetStats coin={coinName} />
        <About />
    </GoogleReCaptchaProvider>
  );
}
