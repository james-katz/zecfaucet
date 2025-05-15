import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import Dashboard from './components/Dashboard'; // Importar o Dashboard
import HomePage from './HomePage.jsx'; // Criaremos este componente para a página inicial
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <Routes>
        {/* Rota principal que usa o layout do App.jsx */}
        <Route path="/" element={<App />}>
          {/* Rota Index (página inicial) dentro do layout */}
          <Route index element={<HomePage />} />
          {/* Rota parceria com PrivacyMap (página inicial) dentro do layout */}
          <Route path="privacymap" element={<HomePage />} />
          {/* Rota para o Dashboard dentro do layout */}
          <Route path="dashboard" element={<Dashboard />} />
        </Route>
        {/* Adicione outras rotas de nível superior aqui, se necessário */}
      </Routes>
    </Router>
  </React.StrictMode>
);