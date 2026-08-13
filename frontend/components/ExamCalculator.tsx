"use client";

import React, { useState, useEffect } from "react";
import { X, Delete, Minus, Plus, Move, Sparkles, RefreshCw } from "lucide-react";

interface ExamCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExamCalculator({ isOpen, onClose }: ExamCalculatorProps) {
  const [display, setDisplay] = useState("0");
  const [formula, setFormula] = useState("");
  const [isEvaluated, setIsEvaluated] = useState(false);

  // Keyboard navigation when calculator is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;

      if (/^[0-9]$/.test(key)) {
        handleNumber(key);
      } else if (["+", "-", "*", "/"].includes(key)) {
        const opMap: Record<string, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };
        handleOperator(opMap[key] || key);
      } else if (key === "." || key === ",") {
        handleDecimal();
      } else if (key === "Enter" || key === "=") {
        e.preventDefault();
        handleEvaluate();
      } else if (key === "Backspace") {
        handleBackspace();
      } else if (key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, display, formula, isEvaluated]);

  if (!isOpen) return null;

  const handleNumber = (digit: string) => {
    if (isEvaluated || display === "0" || display === "Error") {
      setDisplay(digit);
      setIsEvaluated(false);
    } else {
      if (display.length < 15) {
        setDisplay(display + digit);
      }
    }
  };

  const handleDecimal = () => {
    if (isEvaluated || display === "Error") {
      setDisplay("0.");
      setIsEvaluated(false);
      return;
    }
    if (!display.includes(".")) {
      setDisplay(display + ".");
    }
  };

  const handleOperator = (op: string) => {
    if (display === "Error") return;
    setFormula(`${display} ${op} `);
    setDisplay("0");
    setIsEvaluated(false);
  };

  const handleClear = () => {
    setDisplay("0");
    setFormula("");
    setIsEvaluated(false);
  };

  const handleBackspace = () => {
    if (isEvaluated || display === "Error") {
      setDisplay("0");
      setIsEvaluated(false);
      return;
    }
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay("0");
    }
  };

  const handleToggleSign = () => {
    if (display === "0" || display === "Error") return;
    if (display.startsWith("-")) {
      setDisplay(display.slice(1));
    } else {
      setDisplay("-" + display);
    }
  };

  const handleSquareRoot = () => {
    if (display === "Error") return;
    const num = parseFloat(display);
    if (num < 0) {
      setDisplay("Error");
    } else {
      const res = Math.sqrt(num);
      setDisplay(String(Number(res.toFixed(8))));
      setFormula(`√(${display}) = `);
      setIsEvaluated(true);
    }
  };

  const handleSquare = () => {
    if (display === "Error") return;
    const num = parseFloat(display);
    const res = num * num;
    setDisplay(String(Number(res.toFixed(8))));
    setFormula(`sqr(${display}) = `);
    setIsEvaluated(true);
  };

  const handlePercent = () => {
    if (display === "Error") return;
    const num = parseFloat(display);
    const res = num / 100;
    setDisplay(String(Number(res.toFixed(8))));
    setIsEvaluated(true);
  };

  const handleEvaluate = () => {
    if (!formula || display === "Error") return;

    try {
      // Parse formula: "12.5 × " + "4"
      const parts = formula.trim().split(" ");
      if (parts.length < 2) return;

      const num1 = parseFloat(parts[0]);
      const op = parts[1];
      const num2 = parseFloat(display);

      if (isNaN(num1) || isNaN(num2)) {
        setDisplay("Error");
        return;
      }

      let result = 0;
      switch (op) {
        case "+":
          result = num1 + num2;
          break;
        case "−":
        case "-":
          result = num1 - num2;
          break;
        case "×":
        case "*":
          result = num1 * num2;
          break;
        case "÷":
        case "/":
          if (num2 === 0) {
            setDisplay("Error");
            setFormula(`${num1} ÷ 0 = `);
            setIsEvaluated(true);
            return;
          }
          result = num1 / num2;
          break;
        default:
          result = num2;
      }

      // Format result to prevent JS precision quirks (e.g. 0.1 + 0.2 = 0.30000000000000004)
      const cleanResult = Number(result.toFixed(8));
      setDisplay(String(cleanResult));
      setFormula(`${formula}${display} =`);
      setIsEvaluated(true);
    } catch {
      setDisplay("Error");
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fadeIn select-none shadow-2xl">
      <div className="bg-[#1C1917] text-[#FAF7F2] border border-[#44403C] rounded-2xl w-72 p-4 shadow-2xl space-y-3">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-[#292524] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#A8A29E]">
              Exam Calculator
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#A8A29E] hover:text-white hover:bg-[#292524] transition-colors"
            title="Close Calculator"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Display Screen */}
        <div className="bg-[#0C0A09] rounded-xl p-3 border border-[#292524] text-right space-y-0.5">
          <div className="text-[11px] font-mono text-[#78716C] h-4 truncate">
            {formula || "\u00A0"}
          </div>
          <div className="text-2xl font-extrabold font-mono text-white tracking-tight truncate">
            {display}
          </div>
        </div>

        {/* Keypad Grid */}
        <div className="grid grid-cols-4 gap-1.5 text-xs font-semibold">
          {/* Row 1: Scientific quick tools */}
          <button
            onClick={handleClear}
            className="py-2.5 rounded-lg bg-[#292524] hover:bg-[#44403C] text-rose-400 font-bold transition-colors"
          >
            C
          </button>
          <button
            onClick={handleSquareRoot}
            className="py-2.5 rounded-lg bg-[#292524] hover:bg-[#44403C] text-[#D6D3D1] transition-colors font-mono"
          >
            √x
          </button>
          <button
            onClick={handleSquare}
            className="py-2.5 rounded-lg bg-[#292524] hover:bg-[#44403C] text-[#D6D3D1] transition-colors font-mono"
          >
            x²
          </button>
          <button
            onClick={handleBackspace}
            className="py-2.5 rounded-lg bg-[#292524] hover:bg-[#44403C] text-[#A8A29E] flex items-center justify-center transition-colors"
            title="Backspace"
          >
            <Delete className="h-4 w-4" />
          </button>

          {/* Row 2 */}
          <button
            onClick={handlePercent}
            className="py-2.5 rounded-lg bg-[#292524] hover:bg-[#44403C] text-[#D6D3D1] transition-colors"
          >
            %
          </button>
          <button
            onClick={handleToggleSign}
            className="py-2.5 rounded-lg bg-[#292524] hover:bg-[#44403C] text-[#D6D3D1] transition-colors"
          >
            ±
          </button>
          <button
            onClick={() => handleOperator("÷")}
            className="py-2.5 rounded-lg bg-[#9A3412] hover:bg-[#C2410C] text-white font-bold transition-colors text-sm"
          >
            ÷
          </button>
          <button
            onClick={() => handleOperator("×")}
            className="py-2.5 rounded-lg bg-[#9A3412] hover:bg-[#C2410C] text-white font-bold transition-colors text-sm"
          >
            ×
          </button>

          {/* Row 3 */}
          <button
            onClick={() => handleNumber("7")}
            className="py-2.5 rounded-lg bg-[#1C1917] border border-[#292524] hover:bg-[#292524] text-white transition-colors"
          >
            7
          </button>
          <button
            onClick={() => handleNumber("8")}
            className="py-2.5 rounded-lg bg-[#1C1917] border border-[#292524] hover:bg-[#292524] text-white transition-colors"
          >
            8
          </button>
          <button
            onClick={() => handleNumber("9")}
            className="py-2.5 rounded-lg bg-[#1C1917] border border-[#292524] hover:bg-[#292524] text-white transition-colors"
          >
            9
          </button>
          <button
            onClick={() => handleOperator("−")}
            className="py-2.5 rounded-lg bg-[#9A3412] hover:bg-[#C2410C] text-white font-bold transition-colors text-sm"
          >
            −
          </button>

          {/* Row 4 */}
          <button
            onClick={() => handleNumber("4")}
            className="py-2.5 rounded-lg bg-[#1C1917] border border-[#292524] hover:bg-[#292524] text-white transition-colors"
          >
            4
          </button>
          <button
            onClick={() => handleNumber("5")}
            className="py-2.5 rounded-lg bg-[#1C1917] border border-[#292524] hover:bg-[#292524] text-white transition-colors"
          >
            5
          </button>
          <button
            onClick={() => handleNumber("6")}
            className="py-2.5 rounded-lg bg-[#1C1917] border border-[#292524] hover:bg-[#292524] text-white transition-colors"
          >
            6
          </button>
          <button
            onClick={() => handleOperator("+")}
            className="py-2.5 rounded-lg bg-[#9A3412] hover:bg-[#C2410C] text-white font-bold transition-colors text-sm"
          >
            +
          </button>

          {/* Row 5 */}
          <button
            onClick={() => handleNumber("1")}
            className="py-2.5 rounded-lg bg-[#1C1917] border border-[#292524] hover:bg-[#292524] text-white transition-colors"
          >
            1
          </button>
          <button
            onClick={() => handleNumber("2")}
            className="py-2.5 rounded-lg bg-[#1C1917] border border-[#292524] hover:bg-[#292524] text-white transition-colors"
          >
            2
          </button>
          <button
            onClick={() => handleNumber("3")}
            className="py-2.5 rounded-lg bg-[#1C1917] border border-[#292524] hover:bg-[#292524] text-white transition-colors"
          >
            3
          </button>
          <button
            onClick={handleEvaluate}
            className="row-span-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center text-lg transition-colors shadow-xs"
          >
            =
          </button>

          {/* Row 6 */}
          <button
            onClick={() => handleNumber("0")}
            className="col-span-2 py-2.5 rounded-lg bg-[#1C1917] border border-[#292524] hover:bg-[#292524] text-white transition-colors"
          >
            0
          </button>
          <button
            onClick={handleDecimal}
            className="py-2.5 rounded-lg bg-[#1C1917] border border-[#292524] hover:bg-[#292524] text-white font-bold transition-colors"
          >
            .
          </button>
        </div>
      </div>
    </div>
  );
}
