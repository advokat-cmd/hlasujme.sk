"use client";

import React, { useState } from "react";

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  pad?: number;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  hover?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  pad = 24,
  onClick,
  hover,
}) => {
  const [hovered, setHovered] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (onClick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: 14,
    padding: pad,
    cursor: onClick ? "pointer" : "default",
    boxShadow: hover && hovered
      ? "0 8px 24px -10px rgba(28,36,51,.18)"
      : "0 1px 2px rgba(28,36,51,.04)",
    transition: "box-shadow .18s, transform .18s",
    transform: hover && hovered ? "translateY(-2px)" : "none",
    ...style,
  };

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={cardStyle}
    >
      {children}
    </div>
  );
};
