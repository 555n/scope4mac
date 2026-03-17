#!/bin/bash
set -e

echo "=== Daydream Scope for Mac — Build ==="
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# --- 1. Check prerequisites ---
echo "[1/5] Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js required. Install: brew install node"
    exit 1
fi

if ! command -v uv &> /dev/null; then
    echo "ERROR: uv required. Install: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

if ! python3 -c "import torch; assert hasattr(torch.backends, 'mps')" 2>/dev/null; then
    echo "WARNING: PyTorch MPS not detected. Installing..."
    uv pip install torch torchvision
fi

echo "  Node: $(node --version)"
echo "  npm: $(npm --version)"
echo "  uv: $(uv --version)"
echo "  Python: $(python3 --version)"
echo ""

# --- 2. Install Python dependencies ---
echo "[2/5] Installing Python backend..."
uv sync
echo "  Done."
echo ""

# --- 3. Install frontend dependencies ---
echo "[3/5] Installing frontend..."
cd "$PROJECT_DIR/frontend"
npm install
cd "$PROJECT_DIR/app"
npm install
echo "  Done."
echo ""

# --- 4. Build frontend ---
echo "[4/5] Building frontend..."
cd "$PROJECT_DIR/frontend"
npm run build 2>/dev/null || echo "  (frontend build script may not exist — checking app build)"
cd "$PROJECT_DIR/app"
echo "  Done."
echo ""

# --- 5. Build macOS app ---
echo "[5/5] Building macOS .app + DMG..."
cd "$PROJECT_DIR/app"
npm run dist:mac

echo ""
echo "=== Build complete ==="
echo ""
echo "Output:"
ls -la "$PROJECT_DIR/app/dist/"*.dmg 2>/dev/null || echo "  DMG: check app/dist/"
ls -la "$PROJECT_DIR/app/dist/"*.zip 2>/dev/null || echo "  ZIP: check app/dist/"
echo ""
echo "To run directly (development mode):"
echo "  cd app && npm run dev"
echo ""
echo "To run the Python backend standalone:"
echo "  uv run daydream-scope --host 0.0.0.0 --port 8000"
