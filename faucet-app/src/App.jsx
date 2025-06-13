import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom'; // Importar Outlet
import httpCommon from './http-common';
import { Toaster } from 'react-hot-toast';

export default function App() {
  const [faucetOffline, setFaucetOffline] = useState(false);
  const [coinName, setCoinName] = useState('');

  useEffect(() => {    
    httpCommon.get('/network').then((res) => {
      if(res.status === 200) {
        setCoinName(res.data.net === "test" ? "TAZ" : "ZEC");
      }
    }).catch((err) => {
      console.log(err);
      setFaucetOffline(true);
    });
  }, []);

  return (
    <>
      <Toaster position="bottom-center" reverseOrder={false} />
      {faucetOffline ? (
        <div style={styles.container}>
          <h1 style={styles.heading}>Faucet Offline</h1>
          <p style={styles.message}>
            Sorry, currently the faucet appears to be offline.<br />
            We're working on a solution. Please come back soon.
          </p>
        </div>
      ) : (
        <>
          {/* O Outlet renderizará o componente da rota filha (HomePage ou Dashboard) */}
          <main>
            <Outlet context={{ coinName }} /> {/* Passando coinName via context do Outlet */}
          </main>
        </>
      )}
    </>
  );
}

// Estilos permanecem os mesmos
const styles = {
  container: {
    height: '100vh',
    backgroundColor: '#f7f7f7',
    color: '#222',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '2rem',
    textAlign: 'center',
  },
  heading: {
    fontSize: '2.5rem',
    color: '#f2b200', // Zcash yellow
    marginBottom: '1rem',
  },
  message: {
    fontSize: '1.2rem',
    color: '#444',
    maxWidth: '500px',
    lineHeight: '1.6',
  },
};
