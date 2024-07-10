import React, { useState } from 'react';
import GlobalStyle from './GlobalStyles';
import FaucetApp from './components/page/FaucetApp';

const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <>
      <GlobalStyle darkMode={darkMode} />
      <FaucetApp darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
    </>
  );
};

export default App;