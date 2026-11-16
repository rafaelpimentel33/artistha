"use client";

import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { RotateCcw, RotateCw } from "lucide-react";
import { defaultPlaqueDesign, type PlaqueDesign } from "../../lib/store-model";
import styles from "./wooden-plaque.module.css";

type Angle = { x: number; y: number };
const frontAngle: Angle = { x: -12, y: 25 };
const woodLayers = Array.from({ length: 14 }, (_, index) => ({
  "--depth": index / 13 - 0.5,
  filter: `brightness(${0.83 + 0.15 * index / 13})`,
}) as CSSProperties);

export function WoodenPlaque({ scale, design = defaultPlaqueDesign, background }: { scale: number; design?: PlaqueDesign; background?: string }) {
  const [angle, setAngle] = useState(frontAngle);
  const [dragging, setDragging] = useState(false);
  const [failedImage, setFailedImage] = useState("");
  const pointer = useRef<{ id: number; x: number; y: number; distance: number } | null>(null);
  const instructionId = useId();

  function rotate(x: number, y: number) {
    setAngle((previous) => ({ x: previous.x + x, y: previous.y + y }));
  }

  function start(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || pointer.current) return;
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, distance: 0 };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = pointer.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    current.x = event.clientX;
    current.y = event.clientY;
    current.distance += Math.abs(dx) + Math.abs(dy);
    rotate(-dy * 0.6, dx * 0.6);
  }

  function stop(event: PointerEvent<HTMLButtonElement>) {
    const current = pointer.current;
    if (!current || current.id !== event.pointerId) return;
    pointer.current = null;
    setDragging(false);
    if (event.type === "pointerup" && current.distance < 5) rotate(0, 180);
  }

  function keyRotate(event: KeyboardEvent<HTMLButtonElement>) {
    const directions: Record<string, Angle> = { ArrowUp: { x: -12, y: 0 }, ArrowDown: { x: 12, y: 0 }, ArrowLeft: { x: 0, y: -12 }, ArrowRight: { x: 0, y: 12 } };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    rotate(direction.x, direction.y);
  }

  const horizontal = 38 * Math.sin(angle.y * Math.PI / 180);
  const vertical = 38 * Math.sin(angle.x * Math.PI / 180);
  const styling = {
    "--plate-scale": scale, "--artwork-fit": design.fit,
    "--plate-back": design.backColor, "--plate-edge": design.edgeColor,
    "--plate-background": background,
    "--light-x": `${50 + horizontal}%`, "--light-back-x": `${50 - horizontal}%`, "--light-y": `${50 + vertical}%`,
    "--plate-rotation": `rotateX(${angle.x}deg) rotateY(${angle.y}deg)`,
  } as CSSProperties;

  return <section className={styles.preview} aria-label="Modelo 3D da placa">
    <div className={`${styles.viewer}${dragging ? ` ${styles.dragging}` : ""}`} style={styling}>
      <button className={styles.stage} type="button" aria-label="Girar a placa de madeira em 3D" aria-describedby={instructionId}
        onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
        onKeyDown={keyRotate} onClick={(event) => { if (event.detail === 0) rotate(0, 180); }}>
        <span className={styles.plaque} aria-hidden="true">
          {woodLayers.map((layer, index) => <span key={index} className={styles.edge} style={layer} />)}
          <span className={`${styles.face} ${styles.front}`}>
            {design.frontImage && design.frontImage !== failedImage
              ? <img className={styles.artwork} src={design.frontImage} alt="" onError={() => setFailedImage(design.frontImage)} />
              : <span className={styles.guide}><strong>SUA IMAGEM</strong><span>frente</span></span>}
          </span>
          <span className={`${styles.face} ${styles.rear}`} />
        </span>
        <span className={styles.shadow} aria-hidden="true" />
      </button>
    </div>
    <div className={styles.rotation}>
      <p className="muted" id={instructionId}>Arraste para girar ou toque para virar.</p>
      <button className="icon-button" type="button" title="Virar a placa" aria-label="Virar a placa" onClick={() => rotate(0, 180)}><RotateCw size={18} /></button>
      <button className="icon-button" type="button" title="Restaurar a posição" aria-label="Restaurar a posição" onClick={() => setAngle(frontAngle)}><RotateCcw size={18} /></button>
    </div>
  </section>;
}
