import { useState } from 'react';
import './index.css';

export default function VoucherItem({ id, code, payout, memo, totalSupply, usageCount, creatorName, onDelete, onSave }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editMemo, setEditMemo] = useState(memo);
  const [editPayout, setEditPayout] = useState(payout);
  const [editSupply, setEditSupply] = useState(totalSupply);

  const handleSave = () => {
    onSave({ voucherId: id, code, payout: editPayout, maxSupply: editSupply, memo: editMemo });
    setExpanded(false); 
  };

  return (
    <div className={`voucher-item ${expanded ? 'expanded' : ''}`} onClick={() => setExpanded(!expanded)}>
      <div className="voucher-info">
        <h3>{code}</h3>
        <p>{payout} ZEC — {memo}</p>
      </div>
      {confirmDelete ? (
        <>
          <h3>Are you sure you want to delete this coupon?</h3>
          <button className="voucher-delete" onClick={(e) => { e.stopPropagation(); onDelete(id); }}>Yes</button>
          <button className="voucher-delete" onClick={(e)=>{e.stopPropagation(); setConfirmDelete(false)}}>No</button>
        </>
      ):(
        <button className="voucher-delete" onClick={(e)=>{e.stopPropagation(); setConfirmDelete(true);}}>🗑 Delete</button>
      )}      
      
      {expanded && (
        <div className="voucher-expanded" onClick={(e) => e.stopPropagation()}>
          <div className="voucher-meta">                        
            <p><strong>Creator:</strong> {creatorName}</p>
            <p><strong>Used:</strong> {usageCount} times.</p>
          </div>
          <div className="voucher-edit">
            <label>
              Payout:
              <input type="number" value={editPayout} onChange={(e) => setEditPayout(e.target.value)} />
            </label>
            <label>
              Total supply:
              <input type="number" value={editSupply} onChange={(e) => setEditSupply(e.target.value)} />
            </label>
            <label>
              Memo:
              <textarea value={editMemo} onChange={(e) => setEditMemo(e.target.value)} > </textarea>
            </label>
          </div>
          <div className="voucher-actions">
            <button className="btn-cancel" onClick={() => setExpanded(false)}>Cancel</button>
            <button className="btn-save" onClick={handleSave}>Save</button>
          </div>
        </div>
      )}
    </div>
  );
}
