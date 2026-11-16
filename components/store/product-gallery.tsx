"use client";

import { useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { hasPlaquePreview, plaqueDesign, type Product } from "../../lib/store-model";
import { Photo } from "./store-ui";

const WoodenPlaque = dynamic(() => import("./wooden-plaque").then((module) => module.WoodenPlaque));

function positionZoom(frame: HTMLButtonElement, x: number, y: number) {
  const { left, top, width, height } = frame.getBoundingClientRect();
  const percentage = (offset: number, size: number) => Math.min(100, Math.max(0, offset / size * 100));
  frame.style.setProperty("--photo-zoom-origin", `${percentage(x - left, width)}% ${percentage(y - top, height)}%`);
}

function ZoomablePhoto({ src, name, number }: { src: string; name: string; number: number }) {
  const [zoomed, setZoomed] = useState(false);

  function followPointer(event: PointerEvent<HTMLButtonElement>) {
    const frame = event.currentTarget;
    const hovered = event.pointerType !== "touch";
    if (hovered) positionZoom(frame, event.clientX, event.clientY);
    frame.toggleAttribute("data-hover-zoom", hovered);
  }

  function clearHover(event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.removeAttribute("data-hover-zoom");
  }

  function toggleZoom(event: MouseEvent<HTMLButtonElement>) {
    const frame = event.currentTarget;
    if (event.detail > 0) {
      if (frame.hasAttribute("data-hover-zoom")) return;
      positionZoom(frame, event.clientX, event.clientY);
    } else {
      frame.style.removeProperty("--photo-zoom-origin");
    }
    setZoomed((current) => !current);
  }

  return <button className="gallery-main photo-zoom" type="button" aria-label={`Ampliar foto ${number}`} aria-pressed={zoomed}
    onPointerEnter={followPointer} onPointerMove={followPointer} onPointerLeave={clearHover} onPointerCancel={clearHover}
    onClick={toggleZoom} onKeyDown={(event) => { if (event.key === "Escape") setZoomed(false); }}>
    <Photo src={src} alt={`${name} — foto ${number}`} eager />
  </button>;
}

export function ProductGallery({ product, scale, details, children }: { product: Product; scale: number; details: ReactNode; children?: ReactNode }) {
  const { images, name } = product;
  const design = hasPlaquePreview(product) ? plaqueDesign(product) : undefined;
  const [media, setMedia] = useState<Array<number | "plaque">>(() => {
    const photos = images.map((_, index) => index);
    return design ? ["plaque", ...photos] : photos;
  });
  const [main, ...thumbnails] = media;

  function swap(slot: number) {
    setMedia((current) => {
      const next = [...current];
      [next[0], next[slot]] = [next[slot], next[0]];
      return next;
    });
  }

  return <>
    <div className="detail-visual">
      {design && <div className="gallery-plaque" inert={main !== "plaque"}><WoodenPlaque scale={scale} design={design} /></div>}
      {typeof main === "number" && <ZoomablePhoto key={main} src={images[main]} name={name} number={main + 1} />}
      {main === undefined && <div className="gallery-main"><Photo /></div>}
    </div>
    <section className="detail-panel" aria-labelledby="product-title">
      {details}
      {thumbnails.length > 0 && <section className="product-photos" aria-label="Fotos da peça">
        <div className="product-photo-strip" data-overflow={thumbnails.length > 3 ? "" : undefined}>
          {thumbnails.map((item, index) => {
            const plaque = item === "plaque";
            const label = plaque ? "Mostrar placa em 3D" : `Mostrar foto ${item + 1}`;
            return <button key={index} type="button" className={`product-photo${plaque ? " product-photo-plaque" : ""}`}
              aria-label={label} title={label} onClick={() => swap(index + 1)}>
              {plaque ? <>
                <span className="product-photo-plaque-face" style={{ borderColor: design?.edgeColor }}>
                  <Photo src={design?.frontImage || "/referencia/placa-madeira.webp"} />
                </span>
                <span className="product-photo-badge" aria-hidden="true">3D</span>
              </> : <Photo src={images[item]} />}
            </button>;
          })}
        </div>
      </section>}
      {children}
    </section>
  </>;
}
