import React from 'react';

interface LogoProps {
    className?: string;
    size?: number;
    style?: React.CSSProperties;
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 32, style }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={style}
        >
            <defs>
                <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#2dd4bf" />
                </linearGradient>
                <filter id="logo-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>

            {/* Stylized C circle */}
            <path
                d="M75 25C68 18 58 14 48 14C29 14 14 29 14 48C14 67 29 82 48 82C58 82 68 78 75 71"
                stroke="url(#logo-gradient)"
                strokeWidth="12"
                strokeLinecap="round"
                filter="url(#logo-glow)"
            />

            {/* Terminal prompt symbol (chevron) */}
            <path
                d="M42 38L52 48L42 58"
                stroke="url(#logo-gradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Terminal underscore */}
            <line
                x1="58" y1="58" x2="72" y2="58"
                stroke="url(#logo-gradient)"
                strokeWidth="8"
                strokeLinecap="round"
            />

            {/* Connection status point */}
            <circle cx="82" cy="48" r="5" fill="url(#logo-gradient)" />
        </svg>
    );
};
