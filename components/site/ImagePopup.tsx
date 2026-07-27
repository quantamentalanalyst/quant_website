"use client";
import { useEffect } from "react";

// Bloomberg terminal "Image Popup" window, reproduced: a light chrome title
// bar, the photo on a black field, an amber caption block, and a beveled
// Close button bottom-right. Deliberately un-modern — the terminal's popup is
// Win95-era chrome and that is the look being matched.
export default function ImagePopup({
  src,
  caption,
  credit,
  onClose,
}: {
  src: string;
  caption: string;
  credit?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image Popup"
    >
      <div
        className="w-full max-w-[620px] border border-[#8a8a8a] bg-[#050510] shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Title bar — terminal chrome, light on dark */}
        <div className="flex items-center border-b border-[#8a8a8a] bg-[#c8c8c8] px-2 py-[3px]">
          <span className="font-mono text-[12px] leading-[16px] text-[#101010]">
            Image Popup
          </span>
        </div>

        {/* Photo */}
        <div className="px-4 pb-3 pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={caption} className="block max-h-[60vh] w-full object-contain" />
        </div>

        {/* Caption block — Bloomberg renders these in amber */}
        <div className="px-4 pb-3 font-mono text-[12px] leading-[18px] text-accent">
          <div>{caption}</div>
          {credit && <div>{credit}</div>}
        </div>

        {/* Beveled Close button */}
        <div className="flex justify-end px-4 pb-4">
          <button
            onClick={onClose}
            className="border border-[#6f6f6f] border-b-[#4a4a4a] border-r-[#4a4a4a] border-l-[#e8e8e8] border-t-[#e8e8e8] bg-[#c8c8c8] px-6 py-[2px] font-mono text-[12px] leading-[18px] text-[#101010] hover:bg-[#d6d6d6] active:border-l-[#4a4a4a] active:border-t-[#4a4a4a]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
