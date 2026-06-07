import React from "react";

interface StockBadgeProps {
  stock: number;
  className?: string;
}

const StockBadge = ({ stock, className = "" }: StockBadgeProps) => {
  if (stock >= 999) return null; // unlimited — no badge needed

  if (stock === 0) {
    return (
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-destructive/15 text-destructive border border-destructive/30 ${className}`}
      >
        Out of Stock
      </span>
    );
  }

  if (stock <= 5) {
    return (
      <span
        className={`inline-flex items-center rounded border border-status-warning bg-status-warning px-1.5 py-0.5 text-[10px] font-medium ${className}`}
      >
        Low Stock ({stock})
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border ${className}`}
    >
      {stock} in stock
    </span>
  );
};

export default StockBadge;
