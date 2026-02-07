import React, { useEffect, useState, useRef } from 'react';

const PointerArrow = ({ startId, endId, color = '#d946ef', isHovered = false }) => {
  const [path, setPath] = useState('');
  const [arrowPosition, setArrowPosition] = useState({ x: 0, y: 0, angle: 0 });
  const rafRef = useRef(null);

  // Style configuration based on hover state
  const activeColor = '#d946ef'; // Neon Pink
  const inactiveColor = '#6b7280'; // Cool Gray 500

  const currentColor = isHovered ? activeColor : inactiveColor;
  const currentOpacity = isHovered ? 1.0 : 0.2; // Faint by default
  const currentStrokeWidth = isHovered ? 2.5 : 1.5;

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

    // Calculate start/end points relative to container
    // Start: center of the start element
    const startX = startRect.left + startRect.width / 2 - containerRect.left;
    const startY = startRect.top + startRect.height / 2 - containerRect.top;

    // End: slightly adjusted to point to the edge or center of target
    // For heap blocks, let's point to the left side or top depending on position
    const endX = endRect.left - containerRect.left;
    const endY = endRect.top + endRect.height / 2 - containerRect.top;

    // Improved logic: if target is to the right, point to left edge. 
    // If target is below, point to top edge, etc.
    // For now, let's default to pointing to the left edge of the heap block + some padding
    // But since `HeapBlock` is likely to the right, `endRect.left` is good.

    // Calculate control points for Bezier curve (curveness=0.5)
    // We want a nice "wire" look.
    const dist = Math.abs(endX - startX);

    // Control point 1 -> moves out horizontally from start
    const cp1X = startX + dist * 0.5;
    const cp1Y = startY;

    // Control point 2 -> comes in horizontally to end
    const cp2X = endX - dist * 0.5;
    const cp2Y = endY;

    // However, the prompt asked for a specific "curveness={0.5}" style logic
    // which usually implies a quadratic or cubic bezier that bends.
    // Let's use a cubic bezier that ensures it leaves start horizontally and enters end horizontally if possible,
    // or just a smooth curve.

    // Let's try a standard cubic bezier for "wire" look:
    // M startX startY C cp1X cp1Y, cp2X cp2Y, endX endY

    const pathData = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
    setPath(pathData);

    // Calculate arrow head angle at the end
    // Derivative of cubic bezier at t=1
    // Tangent vector scales with (end - cp2)
    const angle = Math.atan2(endY - cp2Y, endX - cp2X) * (180 / Math.PI);
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

    // Poll for updates (for dynamic content layout changes)
    const interval = setInterval(updateArrow, 50);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
      clearInterval(interval);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [startId, endId]);

  if (!path) return null;

  return (
    <g style={{ pointerEvents: 'none', transition: 'all 0.3s ease' }}>
      {/* Glow effect for neon look - only when hovered */}
      {isHovered && (
        <path
          d={path}
          fill="none"
          stroke={currentColor}
          strokeWidth="6"
          strokeOpacity="0.3"
          style={{ filter: 'blur(4px)', transition: 'stroke-opacity 0.3s' }}
        />
      )}

      {/* Main wire */}
      <path
        d={path}
        fill="none"
        stroke={currentColor}
        strokeWidth={currentStrokeWidth}
        strokeOpacity={currentOpacity}
        strokeLinecap="round"
        style={{ transition: 'all 0.3s ease' }}
      />

      {/* Arrow Head */}
      <polygon
        points="-8,-5 2,0 -8,5"
        fill={currentColor}
        opacity={currentOpacity}
        transform={`translate(${arrowPosition.x}, ${arrowPosition.y}) rotate(${arrowPosition.angle})`}
        style={{ transition: 'all 0.3s ease' }}
      />
    </g>
  );
};

export default PointerArrow;
