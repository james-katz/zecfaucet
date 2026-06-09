import { useState } from 'react';
import './index.css';

export default function VoucherItem({ id, code, payout, memo, totalSupply, usageCount, creatorName, coinName, onDelete, onSave }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editMemo, setEditMemo] = useState(memo);
  const [editPayout, setEditPayout] = useState(payout);
  const [editSupply, setEditSupply] = useState(totalSupply);

  const remaining = Math.max(0, totalSupply - (usageCount || 0));
  const isDepleted = remaining === 0;
  const usagePercent = totalSupply > 0 ? Math.min(100, ((usageCount || 0) / totalSupply) * 100) : 0;

  const handleSave = () => {
    onSave({ voucherId: id, code, payout: editPayout, maxSupply: editSupply, memo: editMemo });
    setExpanded(false); 
  };

  return (
    <div
      className={`voucher-item ${expanded ? 'expanded' : ''} ${isDepleted ? 'depleted' : ''}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="voucher-header">
        <div className="voucher-info">
          <span className="voucher-code">{code}</span>
          <span className="voucher-payout">{payout} {coinName || 'ZEC'}</span>
        </div>
        <div className="voucher-status-area">
          <div className="voucher-usage-bar-container">
            <div
              className={`voucher-usage-bar-fill ${isDepleted ? 'bar-depleted' : ''}`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <span className="voucher-usage-text">
            {usageCount || 0} / {totalSupply}
          </span>
        </div>
        <div className="voucher-header-actions">
          {isDepleted && <span className="voucher-badge-depleted">Depleted</span>}
          <span className="voucher-expand-icon">{expanded ? '▾' : '▸'}</span>
        </div>
      </div>

      <div className="voucher-memo-preview">{memo}</div>

      {expanded && (
        <div className="voucher-expanded" onClick={(e) => e.stopPropagation()}>
          <div className="voucher-meta">
            <div className="voucher-meta-item">
              <span className="voucher-meta-label">Creator</span>
              <span className="voucher-meta-value">{creatorName}</span>
            </div>
            <div className="voucher-meta-item">
              <span className="voucher-meta-label">Used</span>
              <span className="voucher-meta-value">{usageCount || 0} times</span>
            </div>
            <div className="voucher-meta-item">
              <span className="voucher-meta-label">Remaining</span>
              <span className="voucher-meta-value">{remaining}</span>
            </div>
          </div>
          <div className="voucher-edit">
            <label>
              Payout ({coinName || 'ZEC'}):
              <input type="number" step="0.0001" value={editPayout} onChange={(e) => setEditPayout(e.target.value)} />
            </label>
            <label>
              Total supply:
              <input type="number" step="1" value={editSupply} onChange={(e) => setEditSupply(e.target.value)} />
            </label>
            <label>
              Memo:
              <textarea value={editMemo} onChange={(e) => setEditMemo(e.target.value)} ></textarea>
            </label>
          </div>
          <div className="voucher-actions">
            {confirmDelete ? (
              <div className="voucher-confirm-delete">
                <span>Delete this coupon?</span>
                <button className="btn-danger" onClick={(e) => { e.stopPropagation(); onDelete(id); }}>Yes, delete</button>
                <button className="btn-cancel" onClick={(e)=>{e.stopPropagation(); setConfirmDelete(false)}}>No</button>
              </div>
            ):(
              <button className="btn-danger-outline" onClick={(e)=>{e.stopPropagation(); setConfirmDelete(true);}}>🗑 Delete</button>
            )}
            <div className="voucher-actions-right">
              <button className="btn-cancel" onClick={() => setExpanded(false)}>Cancel</button>
              <button className="btn-save" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
