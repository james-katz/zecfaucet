import { useRef, useState, useEffect } from 'react';
import SliderCaptcha from 'rc-slider-captcha';
import { toast } from 'react-hot-toast';
import httpCommon from '../../http-common';
import './index.css';

const DESIGN_W = 320;
const DESIGN_H = 205;

export default function SliderCaptchaBox({ onPassed, onReset }) {
  const tokenRef = useRef(null);  
  const [key, setKey] = useState(0);
  const [bgSize, setBgSize] = useState({ width: DESIGN_W, height: DESIGN_H });
  const [scale, setScale] = useState(1);

  useEffect(() => {
      const screenWidth = window.innerWidth;
      const captchaWidth = screenWidth > 900 ? 800 : 320;
      const scl = captchaWidth / DESIGN_W;      
      setBgSize({ width: captchaWidth, height: DESIGN_H * scl });
      setScale(scl);
  }, [key]);

  return (
    <div className="captcha-wrap">
      <SliderCaptcha
        // key={key}
        request={async () => {
          const { data } = await httpCommon.post('/captcha/start');
          tokenRef.current = data.id;

          return { bgUrl: data.bgUrl, puzzleUrl: data.puzzleUrl };
        }}
        onVerify={async (payload) => {
          // payload.x: the computed puzzle movement in px at the rendered size
          const { data } = await httpCommon.post('/captcha/verify', {
            id: tokenRef.current,
            x: payload.x,
            scale: scale,
            duration: payload.duration,
            trail: payload.trail,
          });
          if (data.success) {
            setTimeout(() => {
              tokenRef.current = null;
              // setKey(key + 1);              
              onReset?.();
            }, 60 * 1000);

            onPassed?.(tokenRef.current);            
            return Promise.resolve();
          }
          return Promise.reject(new Error(data.reason || 'verify_failed'));
        }}
        tipText={{default: "Slide to solve the puzzle", loading: "Loading ...", errors: "Please try again"}}
        mode="float"
        bgSize={{ width: bgSize.width, height: bgSize.height }}
        puzzleSize={{ width: 60 * scale }}
        autoRefreshOnError
        limitErrorCount="3"
      />
    </div>
  );
}