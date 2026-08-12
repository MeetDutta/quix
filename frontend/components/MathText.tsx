"use client";

import React, { useMemo } from "react";
import katex from "katex";

interface MathTextProps {
  text: string;
  className?: string;
}

export default function MathText({ text, className = "" }: MathTextProps) {
  const renderedContent = useMemo(() => {
    if (!text) return "";
    
    // Check if text has math formulas ($...$ or $$...$$)
    if (!text.includes("$")) {
      return text;
    }

    try {
      // 1. Process block math: $$...$$
      let processed = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
        try {
          return `<div class="my-2 overflow-x-auto">${katex.renderToString(math.trim(), { displayMode: true, throwOnError: false })}</div>`;
        } catch {
          return `$$${math}$$`;
        }
      });

      // 2. Process inline math: $...$
      processed = processed.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
        try {
          return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
        } catch {
          return `$${math}$`;
        }
      });

      return processed;
    } catch {
      return text;
    }
  }, [text]);

  if (!text.includes("$")) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  );
}
