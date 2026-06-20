"use client";

import React, { useState, useEffect } from "react";

export function useNarrow(bp = 860) {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const checkNarrow = () => setIsNarrow(window.innerWidth < bp);
    
    // Initial check
    checkNarrow();
    
    window.addEventListener("resize", checkNarrow);
    return () => window.removeEventListener("resize", checkNarrow);
  }, [bp]);

  return isNarrow;
}

interface TableScrollProps {
  minWidth?: number;
  children: React.ReactNode;
}

export const TableScroll: React.FC<TableScrollProps> = ({ minWidth = 640, children }) => {
  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ minWidth }}>{children}</div>
    </div>
  );
};
