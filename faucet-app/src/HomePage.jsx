import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom'; // Importar useOutletContext

import httpCommon from './http-common';
import PageHeader from "./components/PageHeader";
import DonateSection from "./components/FaucetBalance";
import FaucetStats from "./components/FaucetStats";
import About from "./components/About";

// Este componente representa o conteúdo da página inicial
export default function HomePage() {
  const { coinName } = useOutletContext();

  return (
    <>
      <PageHeader coin={coinName}/>
      <DonateSection coin={coinName}/>
      <FaucetStats coin={coinName} />
      <About />
    </>
  );
}

