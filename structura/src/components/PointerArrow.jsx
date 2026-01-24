import React, { useEffect, useState, useRef } from 'react';

const PointerArrow = ({ startId, endId, color = '#06b6d4' }) => {
  const [path, setPath] = useState('');
  const [arrowPosition, setArrowPosition] = useState({ x: 0, y: 0, angle: 0 });
  const rafRef = useRef(null);

  const updateArrow = () => {
    const startEl = document.getElementById(startId);
    const endEl = document.getElementById(endId);

    if (!startEl || !endEl) return;

    const startRect = startEl.getBoundingClientRect();
    const endRect = endEl.getBoundingClientRect();

    // Get the parent container for relative positioning
    const container = document.getElementById('arrow-container');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();

    // Calculate positions relative to container
    const startX = startRect.left + startRect.width / 2 - containerRect.left;
    const startY = startRect.top + startRect.height / 2 - containerRect.top;
    const endX = endRect.left + endRect.width / 2 - containerRect.left;
    const endY = endRect.top + endRect.height / 2 - containerRect.top;

    // Calculate control points for curved arrow
    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Control point for smooth curve
    const curvature = 0.3;
    const controlX = startX + dx * 0.5 + dy * curvature;
    const controlY = startY + dy * 0.5 - dx * curvature;

    // Create quadratic bezier curve
    const pathData = `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
    setPath(pathData);

    // Calculate arrow head angle
    const angle = Math.atan2(endY - controlY, endX - controlX) * (180 / Math.PI);
    setArrowPosition({ x: endX, y: endY, angle });
  };

  useEffect(() => {
    updateArrow();
    
    // Update on window resize
    const handleResize = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateArrow);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    // Poll for updates (for dynamic content)
    const interval = setInterval(updateArrow, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
      clearInterval(interval);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [startId, endId]);

  if (!path) return null;

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeDasharray="5,5"
        opacity="0.8"
      />
      <polygon
        points="-6,-4 0,0 -6,4"
        fill={color}
        transform={`translate(${arrowPosition.x}, ${arrowPosition.y}) rotate(${arrowPosition.angle})`}
      />
    </g>
  );
};

export default PointerArrow;
