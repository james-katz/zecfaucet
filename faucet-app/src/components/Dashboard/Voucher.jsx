import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import httpCommon from '../../http-common';
import VoucherItem from './VoucherItem';

import './index.css';
import { toast } from 'react-hot-toast';

const PAGE_SIZE = 10;

export default function Voucher({ setLogin }) {
  const { coinName } = useOutletContext();
  const [newVoucherVisible, setNewVoucherVisible] = useState(false);

  const [voucherList, setVoucherList] = useState([]);
  const [hideApiVouchers, setHideApiVouchers] = useState(false);

  const [newVoucherCode, setNewVoucherCode] = useState('');
  const [newVoucherAmount, setNewVoucherAmount] = useState(0);
  const [newVoucherMemo, setNewVoucherMemo] = useState('');
  const [newVoucherSupply, setNewVoucherSupply] = useState(0);

  // Search & pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('code');
  const [sortAsc, setSortAsc] = useState(true);

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

    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');

    const newVoucher = {
      user: userId,
      code: newVoucherCode,
      payout: newVoucherAmount,
      memo: newVoucherMemo,
      supply: newVoucherSupply
    }

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
      // console.log(res.data)
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

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    setCurrentPage(1);
  };

  // Filtered, sorted, paginated list
  const processedList = useMemo(() => {
    let list = hideApiVouchers
      ? voucherList
      : voucherList.filter((v) => v.user?.username !== 'api');

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((v) =>
        v.code.toLowerCase().includes(q) ||
        v.memo.toLowerCase().includes(q) ||
        v.user?.username?.toLowerCase().includes(q)
      );
    }

    // Sort
    list = [...list].sort((a, b) => {
      let valA, valB;
      switch (sortField) {
        case 'code':
          valA = a.code.toLowerCase();
          valB = b.code.toLowerCase();
          break;
        case 'payout':
          valA = a.payout;
          valB = b.payout;
          break;
        case 'usage':
          valA = a.usageCount || 0;
          valB = b.usageCount || 0;
          break;
        case 'supply':
          valA = a.max_supply;
          valB = b.max_supply;
          break;
        default:
          valA = a.code;
          valB = b.code;
      }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [voucherList, hideApiVouchers, searchQuery, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(processedList.length / PAGE_SIZE));
  const paginatedList = processedList.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, hideApiVouchers]);

  // Summary stats
  const totalVouchers = processedList.length;
  const totalReserved = processedList.reduce((sum, v) => {
    const remaining = Math.max(0, v.max_supply - (v.usageCount || 0));
    return sum + remaining * v.payout;
  }, 0);
  const fullyUsed = processedList.filter(v => (v.usageCount || 0) >= v.max_supply).length;

  return (
    <section className="dashboard-section">
      <h2>ZecFaucet Coupons</h2>

      {/* Summary strip */}
      <div className="voucher-summary-strip">
        <div className="voucher-summary-item">
          <span className="voucher-summary-value">{totalVouchers}</span>
          <span className="voucher-summary-label">Total</span>
        </div>
        <div className="voucher-summary-item">
          <span className="voucher-summary-value">{fullyUsed}</span>
          <span className="voucher-summary-label">Depleted</span>
        </div>
        <div className="voucher-summary-item">
          <span className="voucher-summary-value">{totalReserved.toFixed(4)}</span>
          <span className="voucher-summary-label">Reserved ({coinName || 'ZEC'})</span>
        </div>
      </div>

      {/* Create button / form */}
      {!newVoucherVisible ? (
        <button
          className='create-btn'
          onClick={()=>{setNewVoucherVisible(true)}}
          >
            + New Coupon
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

      {/* Toolbar: search + filter */}
      <div className="voucher-toolbar">
        <div className="voucher-search-box">
          <span className="voucher-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by code, memo, or creator..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="voucher-search-input"
          />
          {searchQuery && (
            <button className="voucher-search-clear" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>
        <label className="voucher-filter">
          <input
            type="checkbox"          
            checked={hideApiVouchers}
            onChange={(e) => setHideApiVouchers(e.target.checked)}
          />
          Include API vouchers
        </label>
      </div>

      {/* Sort buttons */}
      <div className="voucher-sort-bar">
        <span className="voucher-sort-label">Sort by:</span>
        {[
          { key: 'code', label: 'Code' },
          { key: 'payout', label: 'Payout' },
          { key: 'usage', label: 'Usage' },
          { key: 'supply', label: 'Supply' },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`voucher-sort-btn ${sortField === key ? 'active' : ''}`}
            onClick={() => handleSort(key)}
          >
            {label} {sortField === key ? (sortAsc ? '▲' : '▼') : ''}
          </button>
        ))}
      </div>

      {/* Voucher list */}
      <div className='voucher-list'>
        {paginatedList.length === 0 && (
          <p className="voucher-empty">No coupons found.</p>
        )}
        {paginatedList.map(voucher => (
          <VoucherItem
            key={voucher.id}
            id={voucher.id}
            code={voucher.code}
            payout={voucher.payout}
            memo={voucher.memo}
            totalSupply={voucher.max_supply}
            usageCount={voucher.usageCount}
            creatorName={voucher.user.username}
            coinName={coinName}
            onSave={handleUpdateVoucher}
            onDelete={handleDeleteVoucher}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="voucher-pagination">
          <button
            className="voucher-page-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(1)}
          >«</button>
          <button
            className="voucher-page-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >‹</button>
          <span className="voucher-page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="voucher-page-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >›</button>
          <button
            className="voucher-page-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(totalPages)}
          >»</button>
        </div>
      )}
    </section>
  );
}
