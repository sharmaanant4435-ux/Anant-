import React, { useState, useEffect, useMemo } from "react";
import { 
  X, 
  Delete, 
  Copy, 
  Check, 
  FileText 
} from "lucide-react";
import * as math from "mathjs";

interface SmartInfiniteCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSendToNotepad?: (content: string, title?: string) => void;
  initialExpression?: string;
  themeColor?: string;
}

export function SmartInfiniteCalculator({
  isOpen,
  onClose,
  onSendToNotepad,
  initialExpression = ""
}: SmartInfiniteCalculatorProps) {
  const [expression, setExpression] = useState<string>(initialExpression || "0");
  const [liveResult, setLiveResult] = useState<string>("");
  const [justCalculated, setJustCalculated] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // High-precision mathjs instance (64-digit arbitrary precision BigNumber)
  const mathInstance = useMemo(() => {
    return math.create(math.all, {
      number: "BigNumber",
      precision: 64
    });
  }, []);

  useEffect(() => {
    if (initialExpression) {
      setExpression(initialExpression);
      setJustCalculated(false);
    }
  }, [initialExpression]);

  // Live evaluation whenever expression changes
  useEffect(() => {
    const trimmed = expression.trim();
    if (!trimmed || trimmed === "0") {
      setLiveResult("");
      return;
    }

    // If it's just a raw number without any operator or parens, no separate live preview needed
    if (/^-?\d+(\.\d+)?$/.test(trimmed.replace(/,/g, ""))) {
      setLiveResult("");
      return;
    }

    // If it ends with an operator, wait for the next operand
    if (/[+\-−×*÷/^]$/.test(trimmed)) {
      return;
    }

    try {
      const sanitized = trimmed
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/−/g, "-")
        .replace(/,/g, "");

      const evaluated = mathInstance.evaluate(sanitized);
      if (evaluated !== undefined && evaluated !== null) {
        let resStr = evaluated.toString();
        // Format if purely numeric
        if (!isNaN(Number(resStr)) && !resStr.includes("e") && resStr.length < 18) {
          const parts = resStr.split(".");
          parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
          resStr = parts.join(".");
        }
        setLiveResult(resStr);
      }
    } catch {
      // Incomplete expression, silently ignore until user finishes typing
    }
  }, [expression, mathInstance]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleDigit(e.key);
      } else if (e.key === "+") {
        handleOperator("+");
      } else if (e.key === "-") {
        handleOperator("−");
      } else if (e.key === "*") {
        handleOperator("×");
      } else if (e.key === "/") {
        handleOperator("÷");
      } else if (e.key === ".") {
        handleDot();
      } else if (e.key === "%") {
        handlePercent();
      } else if (e.key === "(" || e.key === ")") {
        handleParentheses();
      } else if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        handleEquals();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, expression, liveResult, justCalculated]);

  const handleDigit = (digit: string) => {
    if (justCalculated) {
      setExpression(digit);
      setJustCalculated(false);
      return;
    }

    setExpression((prev) => {
      if (prev === "0") return digit;
      return prev + digit;
    });
  };

  const handleOperator = (op: string) => {
    setJustCalculated(false);
    setExpression((prev) => {
      if (prev === "0" && op === "−") return "−";
      // If ends with operator, replace operator
      if (/[+\-−×÷]\s*$/.test(prev)) {
        return prev.replace(/[+\-−×÷]\s*$/, `${op} `);
      }
      return `${prev} ${op} `;
    });
  };

  const handleDot = () => {
    if (justCalculated) {
      setExpression("0.");
      setJustCalculated(false);
      return;
    }

    setExpression((prev) => {
      const tokens = prev.split(" ");
      const lastToken = tokens[tokens.length - 1];
      if (lastToken.includes(".")) return prev;
      return prev + ".";
    });
  };

  const handleParentheses = () => {
    setJustCalculated(false);
    setExpression((prev) => {
      if (prev === "0") return "(";
      const openCount = (prev.match(/\(/g) || []).length;
      const closeCount = (prev.match(/\)/g) || []).length;
      if (openCount > closeCount && !/[(\s+\-−×÷]$/.test(prev)) {
        return prev + ")";
      }
      return prev + "(";
    });
  };

  const handlePercent = () => {
    setJustCalculated(false);
    setExpression((prev) => {
      if (prev === "0") return "0";
      return prev + " % ";
    });
  };

  const handlePlusMinus = () => {
    setExpression((prev) => {
      if (prev === "0") return "0";
      if (prev.startsWith("−")) return prev.slice(1);
      if (prev.startsWith("-")) return prev.slice(1);
      return "−" + prev;
    });
  };

  const handleClear = () => {
    setExpression("0");
    setLiveResult("");
    setJustCalculated(false);
  };

  const handleBackspace = () => {
    if (justCalculated) {
      handleClear();
      return;
    }

    setExpression((prev) => {
      if (prev.length <= 1 || prev === "0") return "0";
      if (prev.endsWith(" ")) {
        return prev.trimEnd().slice(0, -1).trimEnd() || "0";
      }
      const next = prev.slice(0, -1);
      return next === "" ? "0" : next;
    });
  };

  const handleEquals = () => {
    if (liveResult) {
      setExpression(liveResult.replace(/,/g, ""));
      setLiveResult("");
      setJustCalculated(true);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(liveResult || expression);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-14 sm:top-18 right-3 sm:right-6 z-50 w-[305px] sm:w-[325px] rounded-3xl bg-[#121217]/95 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl p-4 flex flex-col text-white select-none animate-in fade-in zoom-in-95 duration-150">
      
      {/* Top Header Row */}
      <div className="flex items-center justify-between pb-2 border-b border-white/5 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200 text-xs tracking-wider uppercase font-sans">
            Calculator
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
            64-Bit
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onSendToNotepad && (
            <button
              onClick={() => onSendToNotepad(`${expression} = ${liveResult || expression}`, "Calculation")}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-indigo-300 transition cursor-pointer"
              title="Save to Notepad"
            >
              <FileText size={14} />
            </button>
          )}

          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
            title="Copy Result"
          >
            {copied ? <Check size={14} className="text-indigo-400" /> : <Copy size={14} />}
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition ml-1 cursor-pointer"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Screen Display Area - Zero wasted space, exactly matches real phone calculator */}
      <div className="pt-3 pb-2 px-1 flex flex-col justify-end text-right">
        {/* Main Expression Input */}
        <div className="text-3xl sm:text-4xl font-light font-sans tracking-tight text-white break-all flex items-baseline justify-end w-full overflow-x-auto scrollbar-none leading-tight">
          <span>{expression}</span>
          <span className="w-[2px] h-7 bg-indigo-400 inline-block ml-1 animate-pulse" />
        </div>

        {/* Live Result Output + Backspace on the same row: zero vertical gap */}
        <div className="h-8 mt-1 flex items-center justify-between">
          <button
            onClick={handleBackspace}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-rose-400 transition cursor-pointer active:scale-90"
            title="Backspace"
          >
            <Delete size={18} />
          </button>

          {liveResult ? (
            <span className="text-lg sm:text-xl font-mono font-medium text-indigo-300 transition-opacity">
              = {liveResult}
            </span>
          ) : (
            <span className="text-xs text-transparent select-none">= 0</span>
          )}
        </div>
      </div>

      {/* Compact Circular Keypad Grid: 5 rows x 4 cols, No green theme */}
      <div className="grid grid-cols-4 gap-2 pt-1 font-sans">
        
        {/* Row 1 */}
        <button
          onClick={handleClear}
          className="h-12 sm:h-13 rounded-full bg-[#1e1e26] hover:bg-[#282834] active:scale-95 text-rose-400 font-semibold text-lg transition flex items-center justify-center cursor-pointer shadow-sm"
        >
          C
        </button>
        <button
          onClick={handleParentheses}
          className="h-12 sm:h-13 rounded-full bg-[#1e1e26] hover:bg-[#282834] active:scale-95 text-slate-300 font-medium text-lg transition flex items-center justify-center cursor-pointer shadow-sm"
        >
          ( )
        </button>
        <button
          onClick={handlePercent}
          className="h-12 sm:h-13 rounded-full bg-[#1e1e26] hover:bg-[#282834] active:scale-95 text-slate-300 font-medium text-lg transition flex items-center justify-center cursor-pointer shadow-sm"
        >
          %
        </button>
        <button
          onClick={() => handleOperator("÷")}
          className="h-12 sm:h-13 rounded-full bg-[#272836] hover:bg-[#343548] active:scale-95 text-indigo-300 font-medium text-xl transition flex items-center justify-center cursor-pointer shadow-sm"
        >
          ÷
        </button>

        {/* Row 2 */}
        {["7", "8", "9"].map((num) => (
          <button
            key={num}
            onClick={() => handleDigit(num)}
            className="h-12 sm:h-13 rounded-full bg-[#181820] hover:bg-[#23232e] active:scale-95 text-white font-normal text-xl transition flex items-center justify-center cursor-pointer shadow-sm"
          >
            {num}
          </button>
        ))}
        <button
          onClick={() => handleOperator("×")}
          className="h-12 sm:h-13 rounded-full bg-[#272836] hover:bg-[#343548] active:scale-95 text-indigo-300 font-medium text-xl transition flex items-center justify-center cursor-pointer shadow-sm"
        >
          ×
        </button>

        {/* Row 3 */}
        {["4", "5", "6"].map((num) => (
          <button
            key={num}
            onClick={() => handleDigit(num)}
            className="h-12 sm:h-13 rounded-full bg-[#181820] hover:bg-[#23232e] active:scale-95 text-white font-normal text-xl transition flex items-center justify-center cursor-pointer shadow-sm"
          >
            {num}
          </button>
        ))}
        <button
          onClick={() => handleOperator("−")}
          className="h-12 sm:h-13 rounded-full bg-[#272836] hover:bg-[#343548] active:scale-95 text-indigo-300 font-medium text-xl transition flex items-center justify-center cursor-pointer shadow-sm"
        >
          −
        </button>

        {/* Row 4 */}
        {["1", "2", "3"].map((num) => (
          <button
            key={num}
            onClick={() => handleDigit(num)}
            className="h-12 sm:h-13 rounded-full bg-[#181820] hover:bg-[#23232e] active:scale-95 text-white font-normal text-xl transition flex items-center justify-center cursor-pointer shadow-sm"
          >
            {num}
          </button>
        ))}
        <button
          onClick={() => handleOperator("+")}
          className="h-12 sm:h-13 rounded-full bg-[#272836] hover:bg-[#343548] active:scale-95 text-indigo-300 font-medium text-xl transition flex items-center justify-center cursor-pointer shadow-sm"
        >
          +
        </button>

        {/* Row 5 */}
        <button
          onClick={handlePlusMinus}
          className="h-12 sm:h-13 rounded-full bg-[#1e1e26] hover:bg-[#282834] active:scale-95 text-slate-300 font-medium text-base transition flex items-center justify-center cursor-pointer shadow-sm"
        >
          +/−
        </button>
        <button
          onClick={() => handleDigit("0")}
          className="h-12 sm:h-13 rounded-full bg-[#181820] hover:bg-[#23232e] active:scale-95 text-white font-normal text-xl transition flex items-center justify-center cursor-pointer shadow-sm"
        >
          0
        </button>
        <button
          onClick={handleDot}
          className="h-12 sm:h-13 rounded-full bg-[#1e1e26] hover:bg-[#282834] active:scale-95 text-white font-bold text-lg transition flex items-center justify-center cursor-pointer shadow-sm"
        >
          .
        </button>
        <button
          onClick={handleEquals}
          className="h-12 sm:h-13 rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xl transition flex items-center justify-center cursor-pointer shadow-lg shadow-indigo-600/30"
        >
          =
        </button>

      </div>

    </div>
  );
}
