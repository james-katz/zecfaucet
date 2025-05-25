import { useEffect, useState, useRef } from 'react';
import { toast } from 'react-hot-toast';
import httpCommon from '../../http-common';
import './index.css';

export default function VoucherModal({ visible, onClose, onSuccess }) {        
    const [voucherCode, setVoucherCode] = useState('');

    const handleVoucherInputChange = (e) => {
        setVoucherCode(e.target.value);
    }

    const checkAndApplyVoucher = () => {
        httpCommon.get(`voucher?code=${voucherCode}`).then((res) => {
            if(res.data) {
                if(res.data.status == 200) {
                    toast.success(res.data.message);
                    setVoucherCode('');
                    onSuccess({code: voucherCode});
                }
                else {
                    toast.error(res.data.message);
                    setVoucherCode('');
                    onClose();
                }
            }            
        }).catch(() => {
            toast.error("Service unavailable");
            onClose();
        });        
    }

    useEffect(() => {
        document.body.style.overflow = visible ? 'hidden' : 'auto';
        return () => {
            document.body.style.overflow = 'auto';
        };        
    }, [visible]);

    if (!visible) return null;

    return (
        <div className="pow-overlay">
            <div className="pow-modal">
                <h2>ZecFaucet coupon</h2>        
                <p className="pow-text">
                    Coupons are a great way to enhance your experience on ZecFaucet by unlocking bonus rewards
                </p>
                <h3>🏷️ Got a Coupon?</h3>
                <p className="pow-text">
                    If you have a coupon code, please enter it in the input below to activate its benefits.
                </p>     
                <input 
                    type="text"
                    onChange={handleVoucherInputChange}
                    className="faucet-input"/>
                <div className="pow-buttons">
                    <button onClick={onClose} className="btn-decline">Cancel</button>
                    <button onClick={checkAndApplyVoucher} className="btn-accept">Apply</button>
                </div>
            </div>
        </div>
    );
}