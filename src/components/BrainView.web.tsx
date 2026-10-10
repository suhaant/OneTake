import React from 'react';

/** The 3D brain page in an iframe (web build). Native builds use BrainView.tsx. */
export default function BrainView({ url }: { url: string }) {
  return React.createElement('iframe', {
    src: url,
    title: 'Predicted brain response',
    style: { width: '100%', height: '100%', border: 0, display: 'block', backgroundColor: '#F2F9FE' },
  });
}
