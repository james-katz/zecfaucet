import Dashboard from './Dashboard';
import './index.css';

export default function DashboardPage() {  
  return (        
    <div className="dashboard-wrapper">
        <div className='dashboard-side-menu'>
            <ul className='dashboard-side-menu-links'>
                <li>
                    Statistics
                </li>
                <li>
                    Vouchers
                </li>
            </ul>
        </div>
        <div className='dashboard-content'>
            <Dashboard />
        </div>
    </div>      
  );
}
