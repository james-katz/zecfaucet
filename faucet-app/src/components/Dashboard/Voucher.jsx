import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom'; // Importar useOutletContext
import httpCommon from '../../http-common';
import VoucherItem from './VoucherItem';

import './index.css';
import { toast } from 'react-hot-toast';

export default function Voucher({ setLogin }) {
  const { coinName } = useOutletContext();
  const [newVoucherVisible, setNewVoucherVisible] = useState(false);

  const [voucherList, setVoucherList] = useState([]);

  const [newVoucherCode, setNewVoucherCode] = useState('');
  const [newVoucherAmount, setNewVoucherAmount] = useState(0);
  const [newVoucherMemo, setNewVoucherMemo] = useState('');
  const [newVoucherSupply, setNewVoucherSupply] = useState(0);

  const handleCodeChange = (e) => {
    setNewVoucherCode(e.target.value);
  }

  const handleAmountChange = (e) => {
    setNewVoucherAmount(e.target.value);
  }

  const handleSupplyChange = (e) => {
    setNewVoucherSupply(e.target.value);
  }

  const handleMemoChange = (e) => {
    setNewVoucherMemo(e.target.value);
  }

  const createNewVoucher = async () => {
    
    if(!newVoucherCode) {
      return toast.error("Please inform a coupon code!")
    }

    if(!newVoucherAmount) {
      return toast.error("Please inform a coupon payout!")
    }

    if(!newVoucherMemo) {
      return toast.error("Please inform a coupon memo!")
    }

    if(!newVoucherSupply) {
      return toast.error("Please inform a coupon supply!")
    }

    const newVoucher = {
      user: 'zcash', //TODO: implement login
      code: newVoucherCode,
      payout: newVoucherAmount,
      memo: newVoucherMemo,
      supply: newVoucherSupply
    }

    const token = localStorage.getItem('authToken');

    httpCommon.post('/vouchers/create', newVoucher, {headers: {
      Authorization: `Bearer ${token}`
    }}).then((res) => {
      if(res.status === 200) {
        setNewVoucherCode('');
        setNewVoucherAmount(0);
        setNewVoucherMemo('');
        setNewVoucherSupply(0);
        setNewVoucherVisible(false);
        fetchVouchers();
        return toast.success("New coupon added successfully!");;
      }            
    }).catch(err => {return toast.error(err.message)});
  }   

  const fetchVouchers = () => {
    const token = localStorage.getItem('authToken');

    httpCommon.get('/vouchers', {headers: {
      Authorization: `Bearer ${token}`
    }}).then((res) => {
      setVoucherList(res.data);
      console.log(res.data)
    }).catch(err => {
      localStorage.setItem('authToken', '');
      setLogin(false);
      return toast.error(err.message)
    });
  }

  const handleUpdateVoucher = (voucher) => {    
    const token = localStorage.getItem('authToken');
    
    httpCommon.put(`/vouchers/update`, voucher, {headers: {
      Authorization: `Bearer ${token}`
    }}).then(res => {
      if(res.status === 200) {
        fetchVouchers();
        return toast.success("Coupon updated!");        
      }
    }).catch(err => {return toast.error(err.message)});
  }

  const handleDeleteVoucher = (id) => {
    const token = localStorage.getItem('authToken');

    httpCommon.delete(`/vouchers/delete/${id}`, {headers: {
      Authorization: `Bearer ${token}`
    }}).then(res => {
      if(res.status === 200) {
        fetchVouchers();
        return toast.success("Coupon deleted!");        
      }
    }).catch(err => {return toast.error(err.message)});
  }

  useEffect(() => {
    fetchVouchers();
  }, []);

  return (
    <section className="dashboard-section">
      <h2>ZecFaucet coupons</h2>
      {!newVoucherVisible ? (
        <button
          className='create-btn'
          onClick={()=>{setNewVoucherVisible(true)}}
          >
            New coupon
        </button>
      ):(
        <div className="new-coupon-widget">
          <h3>Create New Coupon</h3>          
          <input 
            type="text"
            placeholder="Coupon Code"
            className="coupon-input" 
            onChange={handleCodeChange}  
          />
          <input
            type="number"
            placeholder="Payout Amount (e.g. 0.03)"
            className="coupon-amount" 
            step="0.0001" 
            onChange={handleAmountChange}
          />
          <input
            type="number"
            placeholder="Coupon max supply (e.g. 100)"
            className="coupon-amount" 
            step="1" 
            onChange={handleSupplyChange}
          />
          <textarea 
            placeholder="Custom memo or description" 
            className="coupon-memo"
            value={newVoucherMemo}
            onChange={handleMemoChange}
          ></textarea>          
          <div className="coupon-actions">
            <button
              className="cancel-btn"
              onClick={()=>{setNewVoucherVisible(false)}}
              >
                Cancel
              </button>
            <button onClick={createNewVoucher} className="create-btn">Create</button>
          </div>
        </div>
      )}
      

      <div className='voucher-list'>
        {voucherList.map(voucher => (
          <VoucherItem
            key={voucher.id}
            id={voucher.id}
            code={voucher.code}
            payout={voucher.payout}
            memo={voucher.memo}
            totalSupply={voucher.max_supply}
            usageCount={voucher.usageCount}
            creatorName="Zcash Brasil"
            onSave={handleUpdateVoucher}
            onDelete={handleDeleteVoucher}
          />
        ))}
      </div>
    </section>
  );
}

