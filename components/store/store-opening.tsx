"use client";

import { useEffect, useRef, type RefObject } from "react";
import { preload } from "react-dom";
import { ChevronDown } from "lucide-react";

const mosaic = "/referencia/artistha-mosaico-abertura.webp";
const logoFraction = .69;
const followTime = 46;
const settleDistance = .6;

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const ease = (value: number) => value * value * (3 - 2 * value);
const mix = (start: number, end: number, fraction: number) => start + (end - start) * fraction;

export function StoreOpening({ name, logo, brand }: { name: string; logo: string; brand: RefObject<HTMLAnchorElement | null> }) {
  preload(mosaic, { as: "image", fetchPriority: "high" });

  const openingRef = useRef<HTMLElement>(null);
  const sealRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opening = openingRef.current;
    const seal = sealRef.current;
    const floating = floatingRef.current;
    const link = brand.current;
    const header = link?.closest(".store-header");
    const artwork = link?.firstElementChild;
    if (!opening || !seal || !floating || !link || !header || !artwork) return;

    const image = artwork instanceof HTMLImageElement ? artwork : null;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const previous = header.previousElementSibling;
    const announcement = previous?.classList.contains("announcement") ? previous : null;
    let frame = 0;
    let previousTime = 0;
    let displayed: number | null = null;
    let snap = true;
    let active = false;
    let needsMeasure = true;

    const setActive = (next: boolean) => {
      if (next === active) return;
      active = next;
      opening.toggleAttribute("data-moving-logo", next);
      link.toggleAttribute("data-moving-logo", next);
      floating.toggleAttribute("data-active", next);
    };

    const measure = () => {
      const cover = opening.getBoundingClientRect();
      const circle = seal.getBoundingClientRect();
      const mark = artwork.getBoundingClientRect();
      if (!cover.height || !circle.width || !mark.width || !mark.height) return null;

      const scale = Math.max(1, circle.width * logoFraction / Math.max(mark.width, mark.height));
      const headerMarkY = mark.top - header.getBoundingClientRect().top + mark.height / 2;
      const announcementHeight = announcement?.getBoundingClientRect().height ?? 0;
      floating.style.width = `${mark.width}px`;
      floating.style.height = `${mark.height}px`;
      floating.style.setProperty("--floating-seal-size", `${circle.width / scale}px`);

      return {
        top: cover.top + window.scrollY,
        height: cover.height,
        startX: circle.left + circle.width / 2,
        startY: circle.top - cover.top + circle.height / 2,
        endX: mark.left + mark.width / 2,
        headerMarkY,
        announcementHeight,
        width: mark.width,
        markHeight: mark.height,
        scale,
      };
    };

    let layout: ReturnType<typeof measure> = null;
    const update = (now: number) => {
      frame = 0;
      if (needsMeasure) {
        layout = measure();
        needsMeasure = false;
      }

      if (!layout || (image && !image.naturalWidth)) {
        setActive(false);
        opening.style.removeProperty("--opening-progress");
        displayed = null;
        previousTime = 0;
        return;
      }

      const offset = window.scrollY - layout.top;
      const goal = clamp(offset / layout.height) * layout.height;
      const elapsed = previousTime ? Math.min(now - previousTime, 34) : 16.7;
      if (snap || displayed === null || offset > layout.height * 1.28) {
        displayed = goal;
        snap = false;
      } else {
        displayed = mix(displayed, goal, 1 - Math.exp(-elapsed / followTime));
      }
      if (Math.abs(goal - displayed) <= settleDistance) displayed = goal;
      const settling = displayed !== goal;
      previousTime = settling ? now : 0;

      if (displayed >= layout.height && !settling) {
        setActive(false);
        opening.style.setProperty("--opening-progress", "1");
        return;
      }

      const progress = clamp(displayed / layout.height);
      const travel = ease(progress);
      // Follow the sticky header after the mosaic leaves the viewport.
      const dockY = layout.headerMarkY + Math.max(0, layout.announcementHeight - Math.max(0, offset - layout.height));
      const x = mix(layout.startX, layout.endX, travel) - layout.width / 2;
      const y = mix(layout.startY, dockY, travel) - layout.markHeight / 2;
      const scale = mix(layout.scale, 1, travel);
      floating.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
      floating.style.setProperty("--floating-seal-opacity", String(1 - ease(clamp((progress - .66) / .28))));
      floating.style.setProperty("--floating-cream-opacity", String(1 - ease(clamp((progress - .74) / .24))));
      opening.style.setProperty("--opening-progress", String(progress));
      setActive(true);
      if (settling) schedule();
    };

    function schedule() {
      if (!frame && !motion.matches) frame = window.requestAnimationFrame(update);
    }

    function remeasure() {
      needsMeasure = true;
      schedule();
    }

    function restorePosition() {
      snap = true;
      remeasure();
    }

    const updateMotion = () => {
      if (!motion.matches) {
        restorePosition();
        return;
      }
      window.cancelAnimationFrame(frame);
      frame = 0;
      displayed = null;
      previousTime = 0;
      setActive(false);
      opening.style.removeProperty("--opening-progress");
    };

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(remeasure);
    for (const element of [opening, seal, artwork, header, announcement]) {
      if (element) observer?.observe(element);
    }
    image?.addEventListener("load", remeasure);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", remeasure);
    window.addEventListener("pageshow", restorePosition);
    motion.addEventListener("change", updateMotion);
    if (!motion.matches) update(performance.now());

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      image?.removeEventListener("load", remeasure);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("pageshow", restorePosition);
      motion.removeEventListener("change", updateMotion);
      setActive(false);
    };
  }, [brand, logo]);

  return <>
    <section className="store-opening" ref={openingRef} aria-label="Abertura da loja">
      <div className="store-opening-mosaic" aria-hidden="true" />
      <div className="store-opening-seal" ref={sealRef} aria-hidden="true">
        {logo
          ? <img src={logo} alt="" className="store-opening-logo" />
          : <span className="store-opening-name">{name}</span>}
      </div>
      <a className="store-opening-entry" href="#loja">Ver a vitrine <ChevronDown size={18} aria-hidden="true" /></a>
    </section>
    <div className="store-opening-floating" ref={floatingRef} aria-hidden="true">
      <span className="store-opening-floating-seal" />
      <span className="store-opening-floating-art">{logo ? <img src={logo} alt="" /> : name}</span>
      <span className="store-opening-floating-art store-opening-floating-cream">{logo ? <img src={logo} alt="" /> : name}</span>
    </div>
  </>;
}
