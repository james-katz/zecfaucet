import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import App from './App.jsx';
import Dashboard from './components/Dashboard'; // Importar o Dashboard
import HomePage from './HomePage.jsx'; // Criaremos este componente para a página inicial
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<HomePage />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="test" element={<HomePage />} />
          <Route path=":voucherCode" element={<HomePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  </React.StrictMode>
);
