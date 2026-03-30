import React, { useEffect, useState, useRef } from 'react';
import './LoadingScreen.css';

interface Props {
    onFinished: () => void;
}

export const LoadingScreen: React.FC<Props> = ({ onFinished }) => {
    const [progress, setProgress] = useState(0);
    const [phase, setPhase] = useState<'loading' | 'done'>('loading');
    const barRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const start = Date.now();
        const duration = 2200;

        const timer = setInterval(() => {
            const elapsed = Date.now() - start;
            const pct = Math.min(100, Math.round((elapsed / duration) * 100));
            setProgress(pct);
            if (barRef.current) {
                barRef.current.style.width = `${pct}%`;
            }
            if (pct >= 100) {
                clearInterval(timer);
                setPhase('done');
                setTimeout(onFinished, 400);
            }
        }, 20);

        return () => clearInterval(timer);
    }, [onFinished]);

    return (
        <div className={`loading-screen${phase === 'done' ? ' loading-screen--done' : ''}`}>
            <div className="loading-screen__content">
                {/* BMW Logo mark */}
                <div className="loading-screen__logo">
                    <img
                        src="https://www.bmw.com/etc.clientlibs/settings/wcm/designs/bmwcom/base/resources/ci2020/img/logo-light.svg"
                        alt="BMW"
                        className="loading-screen__logo-img"
                    />
                </div>

                <h1 className="loading-screen__title">Freigabecockpit</h1>
                <p className="loading-screen__subtitle">COAP · High Voltage Storage · Software Approval</p>

                <div className="loading-screen__bar-wrap">
                    <div ref={barRef} className="loading-screen__bar" />
                </div>
                <span className="loading-screen__pct">{progress}%</span>
            </div>
        </div>
    );
};
