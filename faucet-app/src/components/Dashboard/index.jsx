import Dashboard from './Dashboard';
import logo from '../../images/zecfaucet_2.0.gif';
import './index.css';

export default function DashboardPage() {  
  return (        
    <div className="dashboard-wrapper">
        <div className='dashboard-side-menu'>
            <img src={logo} className='sidemenu-logo' />
            <div className='dashboard-side-menu-links'>
                <button>
                    Statistics
                </button>
                <button>
                    Vouchers
                </button>
            </div>
        </div>
        <div className='dashboard-content'>
            <Dashboard />
        </div>
    </div>      
  );
}
