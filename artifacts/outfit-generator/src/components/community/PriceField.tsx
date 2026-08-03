/**
 * PriceField — numeric price input + currency dropdown.
 * Only shown when visibility === 'for_sale'.
 */

import React from "react";
import { ChevronDown } from "lucide-react";
import { CURRENCIES, type Currency } from "@/lib/supabase";

interface PriceFieldProps {
  price: string;
  currency: Currency | "";
  onPriceChange: (v: string) => void;
  onCurrencyChange: (v: Currency) => void;
  disabled?: boolean;
}

export function PriceField({
  price,
  currency,
  onPriceChange,
  onCurrencyChange,
  disabled = false,
}: PriceFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-black/40">
        Sale Price
      </span>
      <div className="flex gap-2">
        {/* Currency dropdown */}
        <div className="relative w-28 flex-shrink-0">
          <select
            value={currency}
            disabled={disabled}
            onChange={(e) => onCurrencyChange(e.target.value as Currency)}
            className="w-full appearance-none border-2 border-black rounded-lg px-3 py-2 pr-7
                       text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-primary
                       cursor-pointer disabled:opacity-50"
          >
            <option value="">— —</option>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-black/40" />
        </div>

        {/* Price input */}
        <input
          type="number"
          min="0"
          step="0.01"
          value={price}
          disabled={disabled}
          onChange={(e) => onPriceChange(e.target.value)}
          placeholder="0.00"
          className="flex-1 border-2 border-black rounded-lg px-3 py-2 text-sm font-medium
                     bg-white focus:outline-none focus:ring-2 focus:ring-primary
                     placeholder:font-normal placeholder:text-black/25 disabled:opacity-50"
        />
      </div>
    </div>
  );
}
