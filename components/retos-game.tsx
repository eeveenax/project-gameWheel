"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, FormEvent } from "react";
import {
  Anchor,
  ArrowRight,
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  Crown,
  Dices,
  Flag,
  Map,
  Minus,
  Plus,
  RotateCcw,
  Ship,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { loadLocalPlayers, saveLocalPlayers } from "@/lib/local-player-storage";
import type { LocalPlayer } from "@/lib/local-player-storage";

type Player = LocalPlayer;
type TileType =
  | "normal"
  | "start"
  | "challenge"
  | "points"
  | "minus"
  | "finish";
type Tile = { type: TileType; label: string; points: number };
type WheelOption = {
  id: string;
  label: string;
  kind: "points" | "challenge";
  points?: number;
  task?: string;
};

const colors = [
  "#f4c95d",
  "#84c6b4",
  "#f1997e",
  "#a9a0d8",
  "#80b9cb",
  "#dc91a9",
  "#b7c875",
  "#e2ad71",
];

const routeTypes: TileType[] = [
  "start", // 01
  "normal", // 02
  "points", // 03 (+1)
  "normal", // 04
  "minus", // 05 (-1)
  "normal", // 06
  "normal", // 07
  "challenge", // 08 (Reto 1)
  "normal", // 09
  "points", // 10 (+1)
  "normal", // 11
  "minus", // 12 (-1)
  "normal", // 13
  "points", // 14 (+1)
  "normal", // 15
  "normal", // 16
  "minus", // 17 (-1)
  "challenge", // 18 (Reto 2)
  "normal", // 19
  "points", // 20 (+1)
  "normal", // 21
  "minus", // 22 (-1)
  "normal", // 23
  "points", // 24 (+1)
  "normal", // 25
  "normal", // 26
  "minus", // 27 (-1)
  "challenge", // 28 (Reto 3)
  "normal", // 29
  "points", // 30 (+1)
  "normal", // 31
  "minus", // 32 (-1)
  "normal", // 33
  "points", // 34 (+1)
  "normal", // 35
  "challenge", // 36 (Reto 4)
  "normal", // 37
  "minus", // 38 (-1)
  "normal", // 39
  "finish", // 40 (Tesoro)
];

const safeRouteTypes = routeTypes.reduce<Tile["type"][]>((acc, type, index) => {
  const prevType = acc[index - 1];
  const isOppositeAdjacent =
    (prevType === "points" && type === "minus") ||
    (prevType === "minus" && type === "points");

  acc.push(isOppositeAdjacent ? "normal" : type);
  return acc;
}, []);

const tiles: Tile[] = safeRouteTypes.map((type) => ({
  type,
  label:
    type === "start"
      ? "Salida"
      : type === "finish"
        ? "¡Tesoro!"
        : type === "challenge"
          ? "Casilla sorpresa"
          : type === "points"
            ? "Premio +1"
            : type === "minus"
              ? "Pierde 1"
              : "Ruta libre",
  points: type === "points" ? 1 : type === "minus" ? -1 : 0,
}));

const wheelOptions: WheelOption[] = [
  { id: "minus-one", label: "−1 punto", kind: "points", points: -1 },
  { id: "minus-two", label: "−2 puntos", kind: "points", points: -2 },
  { id: "plus-one", label: "+1 punto", kind: "points", points: 1 },
  {
    id: "partner",
    label: "Tu pareja elige",
    kind: "challenge",
    task: "Tu pareja de esta ronda elige un reto para ti.",
  },
  {
    id: "crew",
    label: "El resto elige",
    kind: "challenge",
    task: "El resto de la tripulación se pone de acuerdo y elige tu reto.",
  },
  {
    id: "karaoke",
    label: "Karaoke",
    kind: "challenge",
    task: "Canta el estribillo de una canción elegida por todos los tripulantes.",
  },
  {
    id: "humming",
    label: "Tarareo",
    kind: "challenge",
    task: "Tararea una canción sin decir palabras, tu compañero tiene que adivinarla en 20 segundos.",
  },
  {
    id: "mime",
    label: "Mímica",
    kind: "challenge",
    task: "Representa una película o un animal sin hablar hasta que alguien lo adivine.",
  },
  {
    id: "paper",
    label: "Avión de papel",
    kind: "challenge",
    task: "Construye un avión con un folio y lánzalo para que llegue a la meta.",
  },
  {
    id: "cups",
    label: "Vasos",
    kind: "challenge",
    task: "Apila 5 vasos en 15 segundos y luego encesta una bolita de papel en uno.",
  },
];

// Geometría de la ruleta: cada opción ocupa un gajo del mismo tamaño,
// en el mismo orden que el array, empezando arriba y en sentido horario.
const SPIN_DURATION_MS = 3200;
const SEGMENT_ANGLE = 360 / wheelOptions.length;
const wheelGradient = `conic-gradient(${wheelOptions
  .map((_, index) => {
    const color = colors[index % colors.length];
    return `${color} ${index * SEGMENT_ANGLE}deg ${(index + 1) * SEGMENT_ANGLE}deg`;
  })
  .join(", ")})`;

/**
 * Calcula la nueva rotación acumulada para que el gajo `index`
 * quede justo debajo del puntero (arriba, 0°).
 */
function rotationForIndex(currentRotation: number, index: number) {
  const segmentCenter = (index + 0.5) * SEGMENT_ANGLE;
  // Pequeña variación dentro del gajo para que no pare siempre en el centro
  const jitter = (Math.random() - 0.5) * SEGMENT_ANGLE * 0.6;
  const target = (((360 - segmentCenter - jitter) % 360) + 360) % 360;
  const current = ((currentRotation % 360) + 360) % 360;
  const delta = (target - current + 360) % 360;
  return currentRotation + 360 * 5 + delta; // 5 vueltas completas + ajuste
}

const initialPlayers: Player[] = [
  { id: 1, name: "Sofía", color: colors[0], score: 0, position: 0 },
  { id: 2, name: "Mateo", color: colors[1], score: 0, position: 0 },
  { id: 3, name: "Lucía", color: colors[2], score: 0, position: 0 },
];

async function compressPhoto(file: File) {
  const supportedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!supportedTypes.includes(file.type))
    throw new Error("Elige una imagen JPG, PNG o WEBP.");
  if (file.size > 12 * 1024 * 1024)
    throw new Error("La foto debe pesar menos de 12 MB.");

  const bitmap = await createImageBitmap(file);
  if (bitmap.width * bitmap.height > 50_000_000) {
    bitmap.close();
    throw new Error("La imagen tiene demasiada resolución.");
  }

  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("No se pudo preparar la foto.");
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.82);
}

function routeCoordinates(index: number, columns: number) {
  const row = Math.floor(index / columns);
  const step = index % columns;
  const column = row % 2 === 0 ? step : columns - 1 - step;
  return { row: row + 1, column: column + 1 };
}

function TreasureBoard({ players }: { players: Player[] }) {
  return (
    <div className="board-card">
      <div className="route-legend">
        <span>
          <CircleHelp size={24} /> Reto: abre la ruleta
        </span>
        <span>
          <span className="legend-dot legend-gold" /> +1 punto
        </span>
        <span>
          <span className="legend-dot legend-red" /> −1 punto
        </span>
      </div>
      <div
        className="board-path treasure-route"
        aria-label="Ruta serpenteante con 40 casillas"
      >
        <svg
          className="route-trail"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            className="route-trail-desktop"
            d="M 60 90 H 940 Q 970 90 970 115 V 275 Q 970 300 940 300 H 60 Q 30 300 30 325 V 485 Q 30 510 60 510 H 940 Q 970 510 970 535 V 695 Q 970 720 940 720 H 60 Q 30 720 30 745 V 905 Q 30 930 60 930 H 940"
          />
          <path
            className="route-trail-mobile"
            d="M 125 45 H 875 Q 950 45 950 80 V 140 Q 950 175 875 175 H 125 Q 50 175 50 210 V 305 Q 50 340 125 340 H 875 Q 950 340 950 375 V 470 Q 950 505 875 505 H 125 Q 50 505 50 540 V 635 Q 50 670 125 670 H 875 Q 950 670 950 705 V 800 Q 950 835 875 835 H 125 Q 50 835 50 870 V 965 Q 50 1000 125 1000 H 875"
          />
        </svg>
        {tiles.map((tile, index) => {
          const desktop = routeCoordinates(index, 8);
          const mobile = routeCoordinates(index, 4);
          const positionStyle = {
            "--desktop-row": desktop.row,
            "--desktop-column": desktop.column,
            "--mobile-row": mobile.row,
            "--mobile-column": mobile.column,
          } as CSSProperties;
          const tilePlayers = players.filter(
            (player) => player.position === index + 1,
          );
          return (
            <div
              key={index}
              className={`board-tile route-tile route-${tile.type}`}
              style={positionStyle}
              aria-label={`Casilla ${index + 1}: ${tile.label}`}
            >
              <span className="tile-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="tile-icon" aria-hidden="true">
                {tile.type === "challenge" ? (
                  <CircleHelp size={17} />
                ) : tile.type === "points" ? (
                  <Plus size={16} />
                ) : tile.type === "minus" ? (
                  <Minus size={16} />
                ) : tile.type === "finish" ? (
                  <Flag size={17} />
                ) : tile.type === "start" ? (
                  <Anchor size={16} />
                ) : (
                  <Compass size={15} />
                )}
              </span>
              {(tile.type === "points" || tile.type === "minus") && (
                <img
                  className="tile-animal"
                  src={
                    tile.type === "points"
                      ? "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/teddy.jpeg-XWDTchSauMPdi8xAw8iSDYQilkOSw6.png"
                      : "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/boli.jpeg-Ic3cbEUQTwJDY4jQEKg73vPVLNttWx.png"
                  }
                  alt={
                    tile.type === "points"
                      ? "Teddy acompaña este premio de un punto"
                      : "Boli acompaña esta casilla que resta un punto"
                  }
                />
              )}
              <span className="tile-label">{tile.label}</span>
              {tilePlayers.length > 0 && (
                <span className="tile-players">
                  {tilePlayers.map((player) => (
                    <span
                      key={player.id}
                      style={{ backgroundColor: player.color }}
                      title={player.name}
                    >
                      {player.name.slice(0, 1).toUpperCase()}
                    </span>
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="board-footer">
        <Compass size={24} />
        <p className="!text-[18px]">
          Sigue la ruta, prueba tu suerte.{" "}
          <strong>¡El botín espera al final!</strong>
        </p>
        <Sparkles size={24} />
      </div>
    </div>
  );
}

function PlayerPhotoPicker({
  player,
  disabled,
  onPhotoChange,
  onError,
}: {
  player: Player;
  disabled: boolean;
  onPhotoChange: (id: number, photo: string) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    try {
      onPhotoChange(player.id, await compressPhoto(file));
      onError("");
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "No se pudo cargar la foto.",
      );
    }
  }

  return (
    <div className="player-photo-control">
      <span className="avatar-color" style={{ backgroundColor: player.color }}>
        {player.photo ? (
          <img src={player.photo} alt={`Foto de ${player.name}`} />
        ) : (
          player.name.slice(0, 1).toUpperCase()
        )}
      </span>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        tabIndex={-1}
        onChange={handleChange}
        aria-label={`Seleccionar foto de ${player.name}`}
      />
      <button
        type="button"
        className="player-photo-edit"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        aria-label={`Editar foto de ${player.name}`}
        title="Editar foto"
      >
        <Camera size={12} />
      </button>
    </div>
  );
}

function PirateWheel({
  spinning,
  onSpin,
  onPass,
  canAfford,
  option,
  rotation,
}: {
  spinning: boolean;
  onSpin: () => void;
  onPass: () => void;
  canAfford: boolean;
  option: WheelOption | null;
  rotation: number;
}) {
  return (
    <div className="wheel-area">
      <div style={{ position: "relative", display: "inline-block" }}>
        {/* Puntero fijo: marca el gajo ganador */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -6,
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "10px solid transparent",
            borderRight: "10px solid transparent",
            borderTop: "18px solid #3b2a1a",
            zIndex: 3,
          }}
        />
        <div
          className="pirate-wheel"
          aria-label={`Ruleta de ${wheelOptions.length} retos y resultados`}
          style={{
            position: "relative",
            borderRadius: "50%",
            overflow: "hidden",
            background: wheelGradient,
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.15, 0.7, 0.2, 1)`
              : "none",
          }}
        >
          {wheelOptions.map((wheelOption, index) => (
            <span
              key={wheelOption.id}
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                transform: `rotate(${(index + 0.5) * SEGMENT_ANGLE}deg)`,
                pointerEvents: "none",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "6%",
                  left: "50%",
                  transform: "translateX(-50%)",
                  writingMode: "vertical-rl",
                  maxHeight: "36%",
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: 1,
                  color: "#2b1d10",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {wheelOption.label}
              </span>
            </span>
          ))}
          <span className="wheel-center" style={{ zIndex: 2 }}>
            <Anchor size={20} />
          </span>
        </div>
      </div>
      <div className="wheel-copy">
        <p className="eyebrow">
          {spinning
            ? "LA SUERTE ESTÁ ECHADA"
            : option
              ? "RESULTADO DE LA RULETA"
              : "CASILLA DE RETO"}
        </p>
        <h3>
          {spinning
            ? "¡La ruleta gira!"
            : (option?.label ?? "¿Qué reto te tocará?")}
        </h3>
        <p>
          {spinning
            ? "Que decida el mar…"
            : option?.kind === "points"
              ? "El marcador y la casilla se han actualizado con este resultado."
              : (option?.task ??
                "Elige si quieres pagar 1 punto para girar o pasar el turno.")}
        </p>
      </div>
      {!option && (
        <div className="wheel-actions">
          <button
            className="spin-button pirate-spin-button"
            onClick={onSpin}
            disabled={spinning || !canAfford}
          >
            <Dices size={17} />{" "}
            {spinning ? "Girando…" : "Girar · Pagar 1 punto"}
          </button>
          {!canAfford && (
            <p className="wheel-cost-note">
              Necesitas al menos 1 punto para tirar.
            </p>
          )}
          <button className="wheel-pass" onClick={onPass} disabled={spinning}>
            No tirar · Siguiente turno
          </button>
        </div>
      )}
    </div>
  );
}

export function RetosGame() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [playersReady, setPlayersReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState("");
  const newPhotoInputRef = useRef<HTMLInputElement>(null);
  const [activeId, setActiveId] = useState(1);
  const [newName, setNewName] = useState("");
  const [testPoints, setTestPoints] = useState("1");
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [landing, setLanding] = useState<Tile | null>(null);
  const [wheelResult, setWheelResult] = useState<WheelOption | null>(null);
  const [challengeCompleted, setChallengeCompleted] = useState(false);
  const [message, setMessage] = useState("");
  const [winners, setWinners] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadLocalPlayers()
      .then((savedPlayers) => {
        if (cancelled) return;
        setPlayers(savedPlayers ?? initialPlayers);
        setPlayersReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setPlayers(initialPlayers);
        setStorageError(
          error instanceof Error
            ? error.message
            : "No se pudo leer la partida local.",
        );
        setPlayersReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!playersReady) return;
    saveLocalPlayers(players)
      .then(() => setStorageError(""))
      .catch(() =>
        setStorageError("No se pudo guardar la partida en este dispositivo."),
      );
  }, [players, playersReady]);

  const active = players.find((player) => player.id === activeId);
  const leader = useMemo(
    () => Math.max(0, ...players.map((player) => player.score)),
    [players],
  );

  const winnerPoints = useMemo(
    () =>
      Math.max(
        0,
        ...players
          .filter((player) => winners.includes(player.name))
          .map((player) => player.score),
      ),
    [players, winners],
  );
  const finished = active?.position === 40;

  if (!playersReady) {
    return (
      <main className="game-page pirate-page">
        <div className="game-shell">
          <p className="local-loading" role="status">
            Cargando la partida guardada en este dispositivo…
          </p>
        </div>
      </main>
    );
  }

  async function handleNewPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    try {
      setNewPhoto(await compressPhoto(file));
      setPhotoError("");
    } catch (error) {
      setPhotoError(
        error instanceof Error ? error.message : "No se pudo cargar la foto.",
      );
    }
  }

  function updatePlayerPhoto(id: number, photo: string) {
    setPlayers((current) =>
      current.map((player) =>
        player.id === id ? { ...player, photo } : player,
      ),
    );
    setPhotoError("");
  }
  function applyScore(
    id: number,
    requestedScore: number,
    offerSurprise = true,
  ) {
    const clampedScore = Math.max(0, Math.min(40, requestedScore));
    const landedTile = clampedScore > 0 ? tiles[clampedScore - 1] : null;

    // Si cae en una casilla +1 o -1 (y no es la salida/meta), aplicamos también su efecto
    const tileBonus =
      offerSurprise && landedTile?.type === "points"
        ? 1
        : offerSurprise && landedTile?.type === "minus"
          ? -1
          : 0;

    const finalScore = Math.max(0, Math.min(40, clampedScore + tileBonus));
    const destination = finalScore > 0 ? tiles[finalScore - 1] : null;

    setPlayers((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, score: finalScore, position: finalScore }
          : item,
      ),
    );
    setActiveId(id);

    if (offerSurprise && destination?.type === "challenge") {
      setLanding(destination);
      setWheelResult(null);
      setChallengeCompleted(false);
    } else if (destination?.type === "finish") {
      setLanding(destination);
      const winner = players.find((item) => item.id === id);
      if (winner) setWinners([winner.name]);
    }

    return { destination, finalScore, tileBonus };
  }

  function selectPlayer(id: number) {
    setActiveId(id);
    setLanding(null);
    setWheelResult(null);
    setChallengeCompleted(false);
    setMessage("");
  }

  function addPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const player = {
      id: Date.now(),
      name,
      color: colors[players.length % colors.length],
      score: 0,
      position: 0,
      photo: newPhoto ?? undefined,
    };
    setPlayers((current) => [...current, player]);
    setActiveId(player.id);
    setNewName("");
    setNewPhoto(null);
    setPhotoError("");
    setLanding(null);
    setWheelResult(null);
    setChallengeCompleted(false);
    setMessage(`${name} se une a la tripulación con 0 puntos.`);
  }

  function advance() {
    if (!active || finished) return;
    const points = Number.parseInt(testPoints, 10);
    if (!Number.isFinite(points)) return;

    const steps = Math.max(-active.score, Math.min(points, 40 - active.score));
    if (steps === 0) return;

    const testScore = active.score + steps;
    const firstTile = testScore > 0 ? tiles[testScore - 1] : null;

    const scoreEffect =
      firstTile?.type === "points" ? 1 : firstTile?.type === "minus" ? -1 : 0;

    const score = Math.max(0, Math.min(40, testScore + scoreEffect));
    const destination = score > 0 ? tiles[score - 1] : null;

    setPlayers((current) =>
      current.map((player) =>
        player.id === activeId ? { ...player, score, position: score } : player,
      ),
    );
    setLanding(destination);
    setWheelResult(null);
    setChallengeCompleted(false);
    setTestPoints("1");

    const actionText =
      steps > 0
        ? `gana ${steps} puntos en la prueba`
        : `pierde ${Math.abs(steps)} puntos en la prueba`;

    if (destination?.type === "challenge") {
      setMessage(
        `${active.name} ha caído en una casilla sorpresa. Puede tirar pagando 1 punto o pasar el turno.`,
      );
    } else if (destination?.type === "finish") {
      setMessage(`¡${active.name} encontró el tesoro!`);
      setWinners([active.name]);
    } else if (scoreEffect > 0) {
      setMessage(`¡${active.name} ${actionText} y 1 punto extra por Teddy!`);
    } else if (scoreEffect < 0) {
      setMessage(`¡${active.name} ${actionText}! Boli resta 1 punto.`);
    } else if (steps < 0) {
      setMessage(
        `${active.name} pierde ${Math.abs(steps)} puntos y retrocede hasta la casilla ${score}.`,
      );
    } else {
      setMessage(
        `¡${active.name} suma ${steps} puntos y avanza hasta la casilla ${score}!`,
      );
    }
  }

  function spinWheel() {
    if (
      spinning ||
      landing?.type !== "challenge" ||
      wheelResult ||
      !active ||
      active.score < 1
    )
      return;

    const currentPlayerId = active.id;
    const currentPlayerName = active.name;
    const scoreAfterPayment = active.score - 1;

    // 1) Elegimos primero el índice ganador...
    const resultIndex = Math.floor(Math.random() * wheelOptions.length);
    const result = wheelOptions[resultIndex];

    applyScore(currentPlayerId, scoreAfterPayment, false);
    setSpinning(true);
    // 2) ...y giramos la ruleta para que pare exactamente en ese gajo
    setWheelRotation((current) => rotationForIndex(current, resultIndex));
    setMessage(`${currentPlayerName} paga 1 punto para girar la ruleta.`);

    window.setTimeout(() => {
      setSpinning(false);
      setWheelResult(result);

      if (result.kind === "points" && typeof result.points === "number") {
        const { finalScore } = applyScore(
          currentPlayerId,
          scoreAfterPayment + result.points,
          false,
        );

        setMessage(
          `${result.label}: ${currentPlayerName} ${
            result.points > 0 ? "gana" : "pierde"
          } ${Math.abs(result.points)} ${
            Math.abs(result.points) === 1 ? "punto" : "puntos"
          } y queda con ${finalScore} pts.`,
        );
      } else {
        setMessage(`¡Reto pirata para ${currentPlayerName}!`);
      }
    }, SPIN_DURATION_MS);
  }

  function completeChallenge() {
    if (!active || wheelResult?.kind !== "challenge" || challengeCompleted)
      return;
    // Pasamos 'false' para que superar un reto no active otra ruleta
    applyScore(active.id, active.score + 1, false);
    setMessage(`¡Reto superado! ${active.name} gana 1 punto.`);
    setChallengeCompleted(true);
  }

  function nextTurn() {
    if (!players.length) return;
    const index = players.findIndex((player) => player.id === activeId);
    selectPlayer(players[(index + 1) % players.length].id);
  }

  function celebrate() {
    if (players.length)
      setWinners(
        players
          .filter((player) => player.score === leader && player.score >= 40)
          .map((player) => player.name),
      );
  }

  function resetGame() {
    setPlayers((current) =>
      current.map((player) => ({ ...player, score: 0, position: 0 })),
    );
    setWinners([]);
    setLanding(null);
    setWheelResult(null);
    setChallengeCompleted(false);
    setTestPoints("1");
    setMessage("¡Partida nueva! Todos vuelven a la salida con 0 puntos.");
  }

  return (
    <main className="game-page pirate-page">
      <div className="game-shell">
        <header className="topbar pirate-topbar">
          <a
            className="brand pirate-brand"
            href="#inicio"
            aria-label="La tripulación del tesoro, inicio"
          >
            <span className="brand-mark">
              <Ship size={23} />
            </span>
            <span>
              la tripulación
              <br />
              del tesoro
            </span>
          </a>
          <div className="top-note">
            <Compass size={15} /> MAPA PIRATA
          </div>
          <button
            className="reset-button pirate-reset"
            onClick={resetGame}
            disabled={spinning}
          >
            <RotateCcw size={14} /> Nueva partida
          </button>
        </header>

        <section className="intro pirate-intro" id="inicio">
          <div className="intro-copy">
            <p className="eyebrow">
              <Compass size={14} /> CAPITÁN, ¡A PREPARAR LA BRÚJULA!
            </p>
            <h1>
              A la caza del
              <br />
              <span>gran tesoro.</span>
            </h1>
            <p className="intro-subtitle">
              Gana puntos en tus pruebas, avanza por la isla y descubre qué
              esconde cada casilla.
            </p>
          </div>
          <div
            className="intro-sticker pirate-sticker"
            aria-label="Mapa de 40 casillas"
          >
            <Compass size={28} />
            <span>40</span>
            <small>
              casillas
              <br />
              de aventura
            </small>
          </div>
        </section>

        <div className="game-layout pirate-layout">
          <section className="board-section" aria-labelledby="board-heading">
            <div className="section-heading pirate-section-heading">
              <div>
                <p className="eyebrow">EL MAPA DEL TESORO</p>
                <h2 id="board-heading">La ruta de la isla</h2>
              </div>
            </div>
            <TreasureBoard players={players} />
            {message && (
              <p className="game-notice pirate-notice" role="status">
                {message}
              </p>
            )}
            <div className="move-card">
              <div className="move-card-heading">
                <span className="move-compass">
                  <Compass size={20} />
                </span>
                <div>
                  <p className="eyebrow">
                    TURNO DE {active?.name.toUpperCase() ?? "LA TRIPULACIÓN"}
                  </p>
                  <h3>
                    {landing?.type === "challenge"
                      ? "¡Casilla de reto!"
                      : landing?.type === "points"
                        ? "¡Premio de Teddy!"
                        : landing?.type === "minus"
                          ? "¡Cuidado con Boli!"
                          : finished
                            ? "¡Tesoro encontrado!"
                            : "¿Cuántos puntos ganaste?"}
                  </h3>
                  <p>
                    {landing?.type === "challenge" && !wheelResult
                      ? "La ruleta se activa solo al caer aquí."
                      : (wheelResult?.task ??
                        "Introduce los puntos de tu prueba para avanzar por el mapa.")}
                  </p>
                </div>
              </div>
              {landing?.type === "challenge" ? (
                <PirateWheel
                  spinning={spinning}
                  onSpin={spinWheel}
                  onPass={nextTurn}
                  canAfford={Boolean(active && active.score > 0)}
                  option={wheelResult}
                  rotation={wheelRotation}
                />
              ) : (
                <form
                  className="advance-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    advance();
                  }}
                >
                  <label htmlFor="test-points">Puntos de la prueba</label>
                  <div className="advance-controls">
                    <input
                      id="test-points"
                      type="number"
                      min={-(active?.score ?? 0)}
                      max={Math.max(1, 40 - (active?.score ?? 0))}
                      value={testPoints}
                      onChange={(event) => setTestPoints(event.target.value)}
                      aria-label="Puntos ganados en la prueba"
                      disabled={finished || !players.length}
                    />
                    <span>casillas</span>
                    <button
                      className="spin-button advance-button"
                      type="submit"
                      disabled={
                        finished ||
                        !players.length ||
                        !Number.parseInt(testPoints, 10)
                      }
                    >
                      <ArrowRight size={17} />{" "}
                      {finished ? "¡En la meta!" : "Puntuar"}
                    </button>
                  </div>
                  <p className="position-hint">
                    {" "}
                    {active
                      ? active.position === 0
                        ? `${active.name} está en la salida con 0 puntos.`
                        : `${active.name} está en la casilla ${active.position} de 40.`
                      : "Añade jugadores para iniciar."}{" "}
                  </p>
                </form>
              )}
              {wheelResult?.kind === "challenge" && !challengeCompleted && (
                <button
                  className="challenge-complete"
                  onClick={completeChallenge}
                >
                  <Check size={16} /> Reto superado · ganar 1 punto
                </button>
              )}
              {landing &&
                (landing.type !== "challenge" ||
                  wheelResult?.kind === "points" ||
                  challengeCompleted) && (
                  <button className="next-turn-button" onClick={nextTurn}>
                    <ArrowRight size={15} /> Siguiente turno
                  </button>
                )}
            </div>
          </section>

          <aside
            className="players-section pirate-players"
            aria-labelledby="players-heading"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">LA TRIPULACIÓN</p>
                <h2 id="players-heading">
                  Piratas <span className="player-count">{players.length}</span>
                </h2>
              </div>
              <span className="leader-label">
                <Trophy size={14} /> {leader} pts para ganar
              </span>
            </div>
            <form className="add-player" onSubmit={addPlayer}>
              <input
                ref={newPhotoInputRef}
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                tabIndex={-1}
                onChange={handleNewPhotoChange}
                aria-label="Seleccionar foto del nuevo pirata"
              />
              <button
                type="button"
                className="new-photo-picker"
                onClick={() => newPhotoInputRef.current?.click()}
                aria-label={
                  newPhoto
                    ? "Cambiar foto del nuevo pirata"
                    : "Añadir foto del nuevo pirata"
                }
                title="Añadir foto"
              >
                {newPhoto ? (
                  <img src={newPhoto} alt="Vista previa de la foto" />
                ) : (
                  <Camera size={17} />
                )}
              </button>
              <label className="sr-only" htmlFor="player-name">
                Nombre del nuevo pirata
              </label>
              <input
                id="player-name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Nombre del pirata…"
                maxLength={24}
              />
              <button
                type="submit"
                aria-label="Añadir pirata"
                disabled={spinning || !newName.trim()}
              >
                <Plus size={18} />
              </button>
            </form>
            {(photoError || storageError) && (
              <p className="photo-error" role="status">
                {photoError || storageError}
              </p>
            )}
            <div className="player-list">
              {players.map((player, index) => (
                <article
                  className={`player-card ${activeId === player.id ? "player-active" : ""}`}
                  key={player.id}
                >
                  <PlayerPhotoPicker
                    player={player}
                    disabled={spinning}
                    onPhotoChange={updatePlayerPhoto}
                    onError={setPhotoError}
                  />
                  <button
                    className="player-main"
                    onClick={() => selectPlayer(player.id)}
                    disabled={spinning}
                    aria-label={`Elegir a ${player.name}${activeId === player.id ? ", turno actual" : ""}`}
                  >
                    <span className="player-info">
                      <strong>{player.name}</strong>
                      <span>
                        {activeId === player.id
                          ? "Al timón"
                          : player.position === 0
                            ? "En la salida"
                            : `Casilla ${player.position} · ${index === 0 ? "¡A jugar!" : "Lista"}`}
                      </span>
                    </span>
                  </button>
                  <div className="score-display">
                    <strong>{player.score}</strong>
                    <span>PTS</span>
                  </div>
                  <button
                    className="remove-player"
                    onClick={() => {
                      const remaining = players.filter(
                        (item) => item.id !== player.id,
                      );
                      setPlayers(remaining);
                      if (activeId === player.id && remaining.length)
                        selectPlayer(remaining[0].id);
                    }}
                    aria-label={`Quitar a ${player.name}`}
                    disabled={spinning}
                  >
                    <X size={14} />
                  </button>
                </article>
              ))}
            </div>
            {!players.length && (
              <p className="empty-players">
                Añade a tu primera persona para zarpar.
              </p>
            )}
            <div className="score-tip pirate-tip justify-center">
              <span>
                <Anchor size={50} />
              </span>
            </div>
            {players.length > 0 && (
              <button
                className="winner-button pirate-winner"
                onClick={celebrate}
              >
                <Crown size={17} /> ¿Quién se lleva el botín?{" "}
                <ChevronRight size={16} />
              </button>
            )}
          </aside>
        </div>
        <footer className="page-footer pirate-footer">
          <span>
            LA RUTA ES DE LA TRIPULACIÓN · EL TESORO ES PARA QUIEN LO ENCUENTRE
          </span>
          <span>
            <Anchor size={13} aria-hidden="true" />{" "}
            <strong>¡Wena suerte!</strong>
          </span>
        </footer>
      </div>
      {winners.length > 0 && (
        <div
          className="winner-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="winner-title"
        >
          <div className="confetti" aria-hidden="true">
            {Array.from({ length: 30 }, (_, index) => (
              <i
                key={index}
                style={{
                  left: `${(index * 37) % 100}%`,
                  animationDelay: `${(index % 9) * 0.17}s`,
                  backgroundColor: colors[index % colors.length],
                }}
              />
            ))}
          </div>
          <div className="winner-modal pirate-modal">
            <button
              className="winner-close"
              onClick={() => setWinners([])}
              aria-label="Cerrar celebración"
            >
              <X size={18} />
            </button>
            <div className="winner-crown">
              <Crown size={32} />
            </div>
            <p className="eyebrow">¡BOTÍN A LA VISTA!</p>
            <h2 id="winner-title">
              {winners.length > 1
                ? "¡Capitanes empatados!"
                : "¡Tesoro encontrado!"}
            </h2>
            <p className="winner-names">{winners.join(" y ")}</p>
            <p className="winner-points">
              {winnerPoints} {winnerPoints === 1 ? "punto" : "puntos"} en la
              aventura
            </p>
            <button className="spin-button" onClick={() => setWinners([])}>
              ¡A celebrar!
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
