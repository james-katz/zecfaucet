import React, { useState, useEffect } from 'react';

import Dashboard from './Dashboard';
import LoginPage from './LoginPage';
import Voucher from './Voucher';
import logo from '../../images/zecfaucet_2.0.gif';
import './index.css';

export default function DashboardPage() {  
    const [currentScreen, setCurrentScreen] = useState(0);
    const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('authToken'));

    const handleLoginSuccess = () => {
        setIsLoggedIn(true);
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
    };

    return (        
        <div className="dashboard-wrapper">
            <div className='dashboard-side-menu'>
                <img src={logo} className='sidemenu-logo' />
                <div className='dashboard-side-menu-links'>
                    <button onClick={()=>{setCurrentScreen(0)}}>
                        Statistics
                    </button>
                    <button onClick={()=>{setCurrentScreen(1)}}>
                        Vouchers
                    </button>
                    {isLoggedIn && (
                        <button style={{flex:1}} onClick={()=>{handleLogout()}}>
                            Logout
                        </button>
                    )}                    
                </div>
            </div>
            <div className='dashboard-content'>
                {currentScreen == 0 && (
                    <Dashboard />
                )}

                {currentScreen == 1 && (
                    <>
                        {isLoggedIn ? (
                            <>
                                <Voucher setLogin={setIsLoggedIn}/>                                
                            </>
                        ):(
                            <LoginPage onLogin={handleLoginSuccess}/>
                        )}
                    </>                    
                )}
                
            </div>
        </div>      
    );
}
