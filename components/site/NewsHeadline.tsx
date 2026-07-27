"use client";
import { useState } from "react";
import ImagePopup from "./ImagePopup";

// One news headline. When the item carries an image, clicking the headline
// does both things the terminal does: follows the article link (new tab) and
// raises the Image Popup window over this page. Items without an image are a
// plain link; items without a link are plain text.
export default function NewsHeadline({
  headline,
  href,
  image,
  venue,
}: {
  headline: string;
  href?: string;
  image?: string;
  venue?: string;
}) {
  const [open, setOpen] = useState(false);

  const label = image ? (
    <span className="inline-flex items-baseline gap-1.5">
      <span>{headline}</span>
      {/* affordance: this headline also has a photo behind it */}
      <span className="text-[10px] text-text-faint" aria-hidden="true">
        [img]
      </span>
    </span>
  ) : (
    headline
  );

  return (
    <>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => image && setOpen(true)}
          className="text-link no-underline hover:opacity-80"
        >
          {label}
        </a>
      ) : image ? (
        <button
          onClick={() => setOpen(true)}
          className="text-link no-underline hover:opacity-80"
        >
          {label}
        </button>
      ) : (
        <span className="text-text">{headline}</span>
      )}

      {open && image && (
        <ImagePopup
          src={image}
          caption={headline}
          credit={venue}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
