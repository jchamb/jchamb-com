import './style.css';

const CELL_SIZE = 50;
const PULL_DISTANCE = 600;
const PULL_STRENGTH = 0.4;
const EPSILON = 0.01; // minimal change threshold to avoid unnecessary DOM writes

interface GridPoint {
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  element: HTMLElement;
}

let mouseX = 0;
let mouseY = 0;
let lastMouseX = 0;
let lastMouseY = 0;
let isAnimating = false;
let rafId = 0;
const gridPoints: GridPoint[] = [];
const gridContainer = document.getElementById('bg')!;

/**
 * Generates and populates a grid of points within the container based on the current viewport size.
 *
 * This function calculates the number of rows and columns required to fill the viewport with equal-sized cells, creates
 * a div for each grid intersection, positions it absolutely, and stores metadata for later use.
 */
function generateGrid() {
  const rowMax = Math.ceil(window.innerHeight / CELL_SIZE) + 1;
  const colMax = Math.ceil(window.innerWidth / CELL_SIZE) + 1;

  for (let row = 0; row < rowMax; row++) {
    for (let col = 0; col < colMax; col++) {
      const x = col * CELL_SIZE;
      const y = row * CELL_SIZE;

      const element = document.createElement('div');
      element.textContent = '+';
      element.style.position = 'absolute';
      element.style.left = x + 'px';
      element.style.top = y + 'px';
      element.className = 'grid-point';

      gridContainer.appendChild(element);

      gridPoints.push({ x, y, offsetX: 0, offsetY: 0, element });
    }
  }
}

/**
 * Performs a single animation frame by updating the offsets of grid points based on mouse proximity
 * and smoothing their motion with decay when outside the pull range.
 *
 * The animation continues by requesting subsequent frames only if meaningful changes occurred or the
 * mouse has moved. When offsets change sufficiently, update the associated DOM elements’ transforms
 * and cache the applied values to avoid redundant writes.
 */
function animate() {
  let anyChange = false;
  const mouseMoved = Math.abs(mouseX - lastMouseX) > EPSILON || Math.abs(mouseY - lastMouseY) > EPSILON;

  gridPoints.forEach(point => {
    const dx = mouseX - (point.x + CELL_SIZE / 2);
    const dy = mouseY - (point.y + CELL_SIZE / 2);
    const distance = Math.sqrt(dx * dx + dy * dy);

    let targetX = 0;
    let targetY = 0;

    if (distance < PULL_DISTANCE) {
      const angle = Math.atan2(dy, dx);
      const force = (1 - distance / PULL_DISTANCE) * PULL_STRENGTH;
      targetX = Math.cos(angle) * force * CELL_SIZE;
      targetY = Math.sin(angle) * force * CELL_SIZE;
    }

    // Only update offsets when mouse moved or when we need to settle back to 0
    if (mouseMoved || Math.abs(point.offsetX) > EPSILON || Math.abs(point.offsetY) > EPSILON) {
      // Smoothly approach target
      const newOffsetX = point.offsetX + (targetX - point.offsetX) * 0.2;
      const newOffsetY = point.offsetY + (targetY - point.offsetY) * 0.2;

      // If out of pull range, decay towards 0 more aggressively
      if (distance >= PULL_DISTANCE) {
        // Apply decay only when not being pulled
        const decay = 0.9;
        point.offsetX = Math.abs(newOffsetX) > EPSILON ? newOffsetX * decay : 0;
        point.offsetY = Math.abs(newOffsetY) > EPSILON ? newOffsetY * decay : 0;
      } else {
        point.offsetX = Math.abs(newOffsetX) > EPSILON ? newOffsetX : 0;
        point.offsetY = Math.abs(newOffsetY) > EPSILON ? newOffsetY : 0;
      }

      // Only write to DOM if transform meaningfully changed
      if (
        Math.abs(point.offsetX - parseFloat(point.element.dataset['ox'] || '0')) > EPSILON ||
        Math.abs(point.offsetY - parseFloat(point.element.dataset['oy'] || '0')) > EPSILON
      ) {
        point.element.style.transform = `translate(${point.offsetX}px, ${point.offsetY}px)`;
        point.element.dataset['ox'] = String(point.offsetX);
        point.element.dataset['oy'] = String(point.offsetY);
        anyChange = true;
      }
    }
  });

  lastMouseX = mouseX;
  lastMouseY = mouseY;

  // Stop animating if nothing changed and mouse is idle
  if (!anyChange && !mouseMoved) {
    isAnimating = false;
    cancelAnimationFrame(rafId);
    return;
  }

  rafId = requestAnimationFrame(animate);
}

/**
 * Begins the animation loop if it is not already running by setting the
 * animation flag and scheduling the next frame via requestAnimationFrame.
 */
function startAnimation() {
  if (!isAnimating) {
    isAnimating = true;
    rafId = requestAnimationFrame(animate);
  }
}

// Initialize

generateGrid();

/***
 * Animate the grid of points based on mouse movement and touch input.
 * Listens for 'mousemove' and 'touchstart' events to update the mouse coordinates,
 * triggering the animation loop if not already active.
 */
document.addEventListener('mousemove', (e: MouseEvent) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  startAnimation();
});

document.addEventListener('touchstart', (e: TouchEvent) => {
  const touch = e.touches[0];
  if (touch) {
    mouseX = touch.clientX;
    mouseY = touch.clientY;
    startAnimation();
  }
});

/**
 * Regenerates the grid when the window is resized to ensure it fills the viewport.
 */
window.addEventListener('resize', () => {
  gridContainer.replaceChildren();
  gridPoints.length = 0;
  generateGrid();
  // If user is interacting, keep animation running; else remain idle
  if (isAnimating) startAnimation();
});
