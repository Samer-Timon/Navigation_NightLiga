/**********************************************************************
 *   GOOGLE-MAPS-LIKE INTERACTIVE MAP FOR TELEGRAM MINI APP
 *   Smooth pinch-zoom, inertia, clamped panning, auto centering,
 *   room progress integration.
 *********************************************************************/

/* ------------------------------
   CONFIG
------------------------------ */

const floors = [
  { id: 3, label: "3 этаж", src: "maps/3.png" },
  { id: 4, label: "4 этаж", src: "maps/4.png" },
];

let currentFloorIndex = 0;

/* ------------------------------
   DOM ELEMENTS
------------------------------ */

const mapImage = document.getElementById("mapImage");
const mapInner = document.getElementById("mapInner");
const mapViewport = document.getElementById("mapViewport");

const prevFloorBtn = document.getElementById("prevFloorBtn");
const nextFloorBtn = document.getElementById("nextFloorBtn");
const floorLabel = document.getElementById("floorLabel");

const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const resetViewBtn = document.getElementById("resetViewBtn");
const zoomLabel = document.getElementById("zoomLabel");

const roomMarkers = Array.from(document.querySelectorAll(".room-marker"));

/* ------------------------------
   ZOOM AND PAN STATE
------------------------------ */

let scale = 1;
let translateX = 0;
let translateY = 0;

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.25;
const PINCH_EXPONENT = 0.2; // Google Maps-like curve

/* ------------------------------
   PAN / PINCH / INERTIA STATE
------------------------------ */

let isPanning = false;
let isPinching = false;

let startPanX = 0;
let startPanY = 0;
let startTranslateX = 0;
let startTranslateY = 0;

let startPinchDistance = 0;
let startPinchScale = 1;
let pinchCenter = { x: 0, y: 0 };

let velocityX = 0;
let velocityY = 0;
let lastPanX = 0;
let lastPanY = 0;
let lastPanTime = 0;
let inertiaActive = false;

/* ------------------------------
   TELEGRAM API
------------------------------ */

let tg = null;
let userId = null;
let teamId = null;
const API_BASE = "/api"; 

function initTelegram() {
  if (!window.Telegram || !Telegram.WebApp) return;

  tg = Telegram.WebApp;
  tg.ready();

  const unsafe = tg.initDataUnsafe || {};
  if (unsafe.user) userId = unsafe.user.id;

  const startParam = unsafe.start_param;
  if (startParam?.startsWith("team_"))
    teamId = startParam.replace("team_", "");
}

/* ------------------------------
   LOAD PROGRESS
------------------------------ */

let completedRooms = new Set();

async function loadProgress() {
  if (!userId && !teamId) return;

  const params = new URLSearchParams();
  if (userId) params.append("user_id", userId);
  if (teamId) params.append("team_id", teamId);

  try {
    const response = await fetch(`${API_BASE}/progress?${params}`);
    if (!response.ok) return;

    const data = await response.json();
    completedRooms = new Set(data.completed_rooms || []);
    updateRoomMarkers();
  } catch (e) {
    console.error(e);
  }
}

async function completeRoom(roomId) {
  if (!roomId) return;
  if (completedRooms.has(roomId)) return;

  completedRooms.add(roomId);
  updateRoomMarkers();

  try {
    await fetch(`${API_BASE}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room_id: roomId,
        user_id: userId,
        team_id: teamId,
        status: "completed",
      }),
    });
  } catch (e) {
    console.error(e);
  }
}

function updateRoomMarkers() {
  const floorId = floors[currentFloorIndex].id;

  roomMarkers.forEach((m) => {
    const floor = Number(m.dataset.floor);
    const roomId = m.dataset.roomId;

    m.style.display = floor === floorId ? "block" : "none";

    if (completedRooms.has(roomId)) m.classList.add("completed");
    else m.classList.remove("completed");
  });
}

/* ------------------------------
   FLOOR SWITCHING
------------------------------ */

function setFloor(index) {
  currentFloorIndex = index;
  const floor = floors[index];

  mapImage.src = floor.src;
  floorLabel.textContent = floor.label;

  mapImage.onload = () => {
    resetView(false);
    centerMap();
    updateRoomMarkers();
  };
}

function prevFloor() {
  const i = (currentFloorIndex - 1 + floors.length) % floors.length;
  setFloor(i);
}

function nextFloor() {
  const i = (currentFloorIndex + 1) % floors.length;
  setFloor(i);
}

/* ------------------------------
   CENTER MAP ON LOAD
------------------------------ */

function centerMap() {
  const rect = mapViewport.getBoundingClientRect();
  const imgRect = mapImage.getBoundingClientRect();

  translateX = (rect.width - imgRect.width) / 2;
  translateY = (rect.height - imgRect.height) / 2;

  applyTransform();
}

/* ------------------------------
   ZOOM & PAN TRANSFORM
------------------------------ */

function clampPan() {
  const view = mapViewport.getBoundingClientRect();
  const imgW = mapImage.naturalWidth * scale;
  const imgH = mapImage.naturalHeight * scale;

  const minX = view.width - imgW;
  const maxX = 0;
  const minY = view.height - imgH;
  const maxY = 0;

  translateX = Math.min(maxX, Math.max(minX, translateX));
  translateY = Math.min(maxY, Math.max(minY, translateY));
}

function applyTransform() {
  clampPan();
  mapInner.style.transform =
    `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  zoomLabel.textContent = `${Math.round(scale * 100)}%`;
}

function zoomTo(newScale, center) {
  const view = mapViewport.getBoundingClientRect();
  const minFitX = view.width / mapImage.naturalWidth;
  const minFitY = view.height / mapImage.naturalHeight;
  const minFit = Math.min(minFitX, minFitY);

  newScale = Math.max(newScale, minFit);
  newScale = Math.min(newScale, MAX_SCALE);

  if (center) {
    const rect = mapViewport.getBoundingClientRect();
    const cx = center.x - rect.left;
    const cy = center.y - rect.top;

    translateX = cx - (cx - translateX) * (newScale / scale);
    translateY = cy - (cy - translateY) * (newScale / scale);
  }

  scale = newScale;
  applyTransform();
}

function zoomIn() {
  zoomTo(scale * 1.2);
}

function zoomOut() {
  zoomTo(scale / 1.2);
}

function resetView(animated = true) {
  scale = 1;
  translateX = 0;
  translateY = 0;

  if (animated) {
    mapInner.style.transition = "transform 0.2s ease-out";
    applyTransform();
    setTimeout(() => (mapInner.style.transition = ""), 200);
  } else applyTransform();
}

/* ------------------------------
   PAN + INERTIA
------------------------------ */

function startInertia() {
  if (inertiaActive) return;
  inertiaActive = true;

  function step() {
    velocityX *= 0.92;
    velocityY *= 0.92;

    if (Math.abs(velocityX) < 0.001 && Math.abs(velocityY) < 0.001) {
      inertiaActive = false;
      return;
    }

    translateX += velocityX * 16;
    translateY += velocityY * 16;

    applyTransform();
    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

/* ------------------------------
   MOUSE EVENTS
------------------------------ */

mapViewport.addEventListener("mousedown", (e) => {
  isPanning = true;
  startPanX = e.clientX;
  startPanY = e.clientY;
  startTranslateX = translateX;
  startTranslateY = translateY;
  inertiaActive = false;
});

window.addEventListener("mousemove", (e) => {
  if (!isPanning || isPinching) return;

  const dx = e.clientX - startPanX;
  const dy = e.clientY - startPanY;

  translateX = startTranslateX + dx;
  translateY = startTranslateY + dy;

  const now = performance.now();
  const dt = now - lastPanTime;
  if (dt > 0) {
    velocityX = (translateX - lastPanX) / dt;
    velocityY = (translateY - lastPanY) / dt;
  }
  lastPanX = translateX;
  lastPanY = translateY;
  lastPanTime = now;

  applyTransform();
});

window.addEventListener("mouseup", () => {
  isPanning = false;
  startInertia();
});

/* Scroll wheel zoom */
mapViewport.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const direction = e.deltaY > 0 ? -1 : 1;
    zoomTo(scale * (direction > 0 ? 1.2 : 0.8), {
      x: e.clientX,
      y: e.clientY,
    });
  },
  { passive: false }
);

/* ------------------------------
   TOUCH EVENTS (pinch + pan)
------------------------------ */

mapViewport.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length === 1) {
      isPanning = true;
      isPinching = false;

      const t = e.touches[0];
      startPanX = t.clientX;
      startPanY = t.clientY;

      startTranslateX = translateX;
      startTranslateY = translateY;

      inertiaActive = false;
    } else if (e.touches.length === 2) {
      isPinching = true;
      isPanning = false;

      const [a, b] = e.touches;
      startPinchDistance = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      startPinchScale = scale;

      pinchCenter = {
        x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2,
      };
    }
  },
  { passive: false }
);

mapViewport.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();

    if (isPinching && e.touches.length === 2) {
      const [a, b] = e.touches;

      const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      const factor = dist / startPinchDistance;

      const newScale =
        startPinchScale * Math.pow(factor, PINCH_EXPONENT);

      zoomTo(newScale, pinchCenter);
    }

    if (isPanning && e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - startPanX;
      const dy = t.clientY - startPanY;

      translateX = startTranslateX + dx;
      translateY = startTranslateY + dy;

      const now = performance.now();
      const dt = now - lastPanTime;

      if (dt > 0) {
        velocityX = (translateX - lastPanX) / dt;
        velocityY = (translateY - lastPanY) / dt;
      }

      lastPanX = translateX;
      lastPanY = translateY;
      lastPanTime = now;

      applyTransform();
    }
  },
  { passive: false }
);

mapViewport.addEventListener("touchend", (e) => {
  if (e.touches.length === 0) {
    isPinching = false;
    isPanning = false;
    startInertia();
  }
});

/* Double-tap zoom */
let lastTap = 0;
mapViewport.addEventListener("touchend", (e) => {
  const now = Date.now();
  if (now - lastTap < 250 && e.changedTouches.length === 1) {
    const t = e.changedTouches[0];
    zoomTo(scale * 1.4, { x: t.clientX, y: t.clientY });
  }
  lastTap = now;
});

/* ------------------------------
   ROOM MARKERS CLICK
------------------------------ */

roomMarkers.forEach((m) => {
  m.addEventListener("click", (e) => {
    e.stopPropagation();
    completeRoom(m.dataset.roomId);
  });
});

/* ------------------------------
   BUTTON HANDLERS
------------------------------ */

prevFloorBtn.addEventListener("click", prevFloor);
nextFloorBtn.addEventListener("click", nextFloor);
zoomInBtn.addEventListener("click", zoomIn);
zoomOutBtn.addEventListener("click", zoomOut);
resetViewBtn.addEventListener("click", () => resetView(true));

/* ------------------------------
   INIT
------------------------------ */

function init() {
  initTelegram();
  setFloor(0);
  loadProgress();

  mapImage.onload = () => centerMap();
}

document.addEventListener("DOMContentLoaded", init);
