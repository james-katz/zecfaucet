import React from 'react';
import { PriceStyle } from './styles';

interface CoinTickerWidgetProps {
  coinId: string;
  currency: string;
  locale: string;
  height?: string;
  
}

const CoinTickerWidget: React.FC<CoinTickerWidgetProps> = ({ coinId, currency, locale, height = "200" }) => {
  return (
    <PriceStyle >
      <coingecko-coin-price-chart-widget  coin-id={coinId} currency={currency} height={height} locale={locale}></coingecko-coin-price-chart-widget>
    </PriceStyle>
  );
};

export default CoinTickerWidget;
