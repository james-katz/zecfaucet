import { useEffect, useState, useRef } from 'react';
import './index.css';

export default function ProofOfWorkModal({ visible, onDecline, onSuccess, challenge }) {
    const [accepted, setAccepted] = useState(false);
    const [completed, setCompleted] = useState(false);    
    const [message, setMessage] = useState('');    
    const [difficulty, setDifficulty] = useState(0);    
    const [isVpn, setIsVpn] = useState(false);
    const [invertBtns, setInvertBtns] = useState(false);
    const [nonce, setNonce] = useState(0);
    const [hash, setHash] = useState(0);
    const [progress, setProgress] = useState('Initializing ...');
    const [duration, setDuration] = useState(0);
    const [hashRate, setHashRate] = useState(0);
    const stopSignal = useRef(false);
    const startTime = useRef(null);
    const workersRef = useRef([]);
    const totalNonce = useRef(0);
    const bestEffort = useRef({ nonce: 0, hash: 'f'.repeat(64) });
    const timerRef = useRef(null);
    const workerCount = navigator.hardwareConcurrency || 4;

    const declineChallenge = () => {
        setAccepted(false);        
        onDecline();
    }

    const startChallenge = () => {
        setAccepted(true);
        setDuration(0);
        setProgress('Initializing ...');
        setHashRate(0);        
        
        totalNonce.current = 0;
        bestEffort.current = { nonce: 0, hash: 'f'.repeat(64) };
        startTime.current = Date.now();

        const timeCap = isVpn ? 2*60*1000 : 60*1000;
        const minTime = 5000 + Math.random() * 2500;
        const maxTime = Math.min(timeCap, Math.floor(minTime * Math.pow(1.44, difficulty - 5)));

        // console.log(`Working on message ${message}`);
        // console.log(`With difficulty ${difficulty} and level ${level}`);

        for (let i = 0; i < workerCount; i++) {
            const worker = new Worker(new URL('./pow.worker.js', import.meta.url), { type: 'module' });
            workersRef.current.push(worker);

            worker.postMessage({ message, difficulty, offset: i, stride: workerCount });

            worker.onmessage = (e) => {
                const { type, data } = e.data;

                if (type === 'progress') {
                    totalNonce.current += data.delta;
                    const elapsed = (Date.now() - startTime.current) / 1000;
                    setProgress(data.hash);
                    setHashRate(Math.floor(totalNonce.current / elapsed));
                    
                    if (data.hash < bestEffort.current.hash) {            
                        bestEffort.current = { nonce: data.nonce, hash: data.hash };                                                
                    }
                }

                if (type === 'result') {
                    const elapsed = (Date.now() - startTime.current) / 1000;
                    setDuration(elapsed.toFixed(2));
                    setHashRate(Math.floor(totalNonce.current / elapsed));
                    setCompleted(true);                    
                    setNonce(data.nonce);
                    setHash(data.hash);   
                    workersRef.current.forEach(w => w.terminate());
                    workersRef.current = [];
                    clearTimeout(timerRef.current);
                }
            };
        }

        timerRef.current = setTimeout(() => {
            if (!completed) {
                setCompleted(true);
                const elapsed = (Date.now() - startTime.current) / 1000;
                setDuration(elapsed.toFixed(2));
                setHashRate(Math.floor(totalNonce.current / elapsed));
                setNonce(bestEffort.current.nonce);
                setHash(bestEffort.current.hash); 
                workersRef.current.forEach(w => w.terminate());
                workersRef.current = [];
            }
        }, maxTime);
    };
    
    const cancelChallenge = () => {
        workersRef.current.forEach(worker => worker.terminate());
        workersRef.current = [];
        setAccepted(false);
        setCompleted(false);
        setProgress('Cancelling ...');
        setDuration(0);
        setHashRate(0);
        onDecline();
    };
    
    const completeChallenge = () => {
        stopSignal.current = true;
        setAccepted(false);
        setCompleted(false);        
        setDuration(0);
        setHashRate(0);
        // console.log(hash)
        // console.log(nonce)
        onSuccess({ nonce, hash }); // should also send the solution hash
    }

    useEffect(() => {
        setMessage(challenge.msg);
        setDifficulty(challenge.difficulty);
        setIsVpn(challenge.vpn);
        
        setInvertBtns(Math.random() >= 0.5);

        document.body.style.overflow = visible ? 'hidden' : 'auto';
        return () => {
            document.body.style.overflow = 'auto';
        };        
    }, [visible, message, difficulty]);

    if (!visible) return null;

    return (
        <div className="pow-overlay">
        <div className="pow-modal">
            <h2>Prove you're a human</h2>        

            {!accepted && (
                <>
                    <p className="pow-text">
                        To avoid fraudulent claims, ZecFaucet requires users to solve a cryptographic challenge.
                        In the context of cryptocurrencies, this is usually called a <strong>Proof of Work</strong>.<br /><br />
                        Keep in mind this process can take a few seconds to minutes to complete and may incur in high CPU usage and added electricity costs.
                    </p>                    
                    <div className="pow-buttons">
                        {invertBtns ? (
                            <>
                                <button onClick={startChallenge} className="btn-accept">Accept Challenge</button>
                                <button onClick={declineChallenge} className="btn-decline">Decline</button>                        
                            </>
                        ) : (
                            <>
                                <button onClick={declineChallenge} className="btn-decline">Decline</button>
                                 <button onClick={startChallenge} className="btn-accept">Accept Challenge</button>
                            </>
                        )}                        
                    </div>
                </>
            )}

            {accepted && !completed && (
            <>
                <h3>Proof of Work is running.</h3>
                <div className="pow-text">                    
                    {/* <p><strong>Difficulty:</strong> { difficulty }</p> */}
                    <p><strong>Effort:</strong> {hashRate} Hashes/sec</p>
                    <p><strong>WARNING!</strong> Do not close this window.</p>
                </div>
                <div className="pow-status">
                    { progress }
                </div>
                <div className="pow-buttons">
                    <button onClick={cancelChallenge} className="btn-cancel">Cancel</button>
                </div>            
            </>
            )}

            {completed && (
            <>
                <div className="pow-text">
                    <h2><strong>✅ Success!</strong></h2>
                    <p>A solution was found in {duration} seconds</p>
                    <p>You can now claim from the faucet.</p>
                </div>
                <div className="pow-buttons">
                    <button onClick={completeChallenge} className="btn-send">Send ZEC Now</button>
                </div>
            </>
            )}
        </div>
        </div>
    );
}