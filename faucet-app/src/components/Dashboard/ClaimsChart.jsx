import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const placeholderData = [
  { name: 'Dia 1', claims: 30 },
  { name: 'Dia 2', claims: 45 },
  { name: 'Dia 3', claims: 28 },
  { name: 'Dia 4', claims: 55 },
  { name: 'Dia 5', claims: 62 },
  { name: 'Dia 6', claims: 48 },
  { name: 'Dia 7', claims: 70 },
];

export default function ClaimsChart({ data }) {
  // Se 'data' for nulo ou vazio, pode mostrar uma mensagem ou usar os dados de exemplo
  const chartData = data && data.length > 0 ? data : [];

  return (
    <div className="chart-container">
      <h4>Faucet claims in the last 7 days</h4>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={chartData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="claims" stroke="#f2b200" activeDot={{ r: 8 }} name="Claims" />
          {/* Você pode adicionar mais linhas se tiver mais dados, ex: valor enviado por dia */}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

