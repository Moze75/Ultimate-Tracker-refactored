import React from 'react';

const BowIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M4 20c6-4 6-12 0-16" />
    <path d="M4 4l8 8L4 20" />
    <path d="M22 2l-8 8" />
    <path d="M22 2l-4 2" />
    <path d="M22 2l-2 4" />
  </svg>
);

export default BowIcon;