import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom'; // Importar Outlet
import httpCommon from './http-common';
import { Toaster } from 'react-hot-toast';
import OfflineLanding from './components/OfflineLanding';

// How often to re-check backend status while showing the offline page
const STATUS_POLL_MS = 60 * 1000;

export default function App() {
  // 'checking' | 'online' | 'offline'
  const [faucetStatus, setFaucetStatus] = useState('checking');
  const [coinName, setCoinName] = useState('');
  const [faucetClosed, setFaucetClosed] = useState(false);

  useEffect(() => {    
    httpCommon.get('/network').then((res) => {
      if(res.status === 200) {
        setCoinName(res.data.net === "test" ? "TAZ" : "ZEC");
        setFaucetClosed(Boolean(res.data.closed));
        // `online` is false when the API is up but the Zkool backend is not
        setFaucetStatus(res.data.online === false ? 'offline' : 'online');
      }
    }).catch((err) => {
      console.log(err);
      setFaucetStatus('offline');
    });
  }, []);

  // While offline, poll the backend and reload once the faucet is back
  useEffect(() => {
    if (faucetStatus !== 'offline') return undefined;

    const timer = setInterval(() => {
      httpCommon.get('/network').then((res) => {
        if (res.status === 200 && res.data.online !== false) {
          window.location.reload();
        }
      }).catch(() => {});
    }, STATUS_POLL_MS);

    return () => clearInterval(timer);
  }, [faucetStatus]);

  // Avoid flashing the faucet UI before we know the backend status
  if (faucetStatus === 'checking') return null;

  return (
    <>
      <Toaster position="bottom-center" reverseOrder={false} />
      {faucetStatus === 'offline' ? (
        <OfflineLanding />
      ) : (
        <>
          {/* O Outlet renderizará o componente da rota filha (HomePage ou Dashboard) */}
          <main>
            <Outlet context={{ coinName, faucetClosed }} /> {/* Passando coinName via context do Outlet */}
          </main>
        </>
      )}
    </>
  );
}
