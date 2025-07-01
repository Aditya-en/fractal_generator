const API_BASE = "https://fractal-proxy.adityasahani443.workers.dev";

const controls = [
  "type", "width", "height", "max_iter", "zoom", "rule",
  "colormap", "gamma", "c_real", "c_imag"
];

const $ = id => document.getElementById(id);
const spinner = $("spinner");
const output = $("output");
const typeSelect = $("type");
const juliaParams = $("julia-params");

// Presets configuration
const presets = {
  'mandelbrot-classic': {
    type: 'mandelbrot',
    width: 800,
    height: 800,
    max_iter: 300,
    zoom: 1.0,
    rule: 'z**2 + c',
    colormap: 'turbo',
    gamma: 0.3
  },
  'burning-ship': {
    type: 'mandelbrot',
    width: 600,
    height: 600,
    max_iter: 250,
    zoom: 0.8,
    rule: 'complex(abs(z.real), abs(z.imag))**2 + c',
    colormap: 'hot',
    gamma: 0.5
  },
  'nebula-mode': {
    type: 'julia',
    width: 800,
    height: 800,
    max_iter: 400,
    rule: 'z**3 + c',
    colormap: 'plasma',
    gamma: 0.2,
    c_real: -0.4,
    c_imag: 0.6
  },
  'julia-spiral': {
    type: 'julia',
    width: 600,
    height: 600,
    max_iter: 200,
    rule: 'z**2 + c',
    colormap: 'viridis',
    gamma: 0.4,
    c_real: -0.75,
    c_imag: 0.11
  },
  'electric-julia': {
    type: 'julia',
    width: 700,
    height: 700,
    max_iter: 300,
    rule: 'z**2 + c',
    colormap: 'cool',
    gamma: 0.6,
    c_real: 0.285,
    c_imag: 0.01
  }
};

// Event listeners
typeSelect.addEventListener("change", () => {
  juliaParams.classList.toggle("hidden", typeSelect.value !== "julia");
});

controls.forEach(id => {
  const el = $(id);
  if (el) {
    el.addEventListener("input", updateURLFromForm);
  }
});

function updateURLFromForm() {
  const params = new URLSearchParams();
  controls.forEach(id => {
    const el = $(id);
    if (el && !el.closest('.hidden')) {
      params.set(id, el.value);
    }
  });
  history.replaceState(null, "", "?" + params.toString());
}

function loadFormFromURL() {
  const params = new URLSearchParams(location.search);
  controls.forEach(id => {
    const el = $(id);
    if (el && params.has(id)) {
      el.value = params.get(id);
    }
  });
  if ($("type").value === "julia") {
    juliaParams.classList.remove("hidden");
  }
}

function loadPreset(presetName) {
  const preset = presets[presetName];
  if (!preset) return;

  Object.keys(preset).forEach(key => {
    const el = $(key);
    if (el) {
      el.value = preset[key];
    }
  });

  if (preset.type === "julia") {
    juliaParams.classList.remove("hidden");
  } else {
    juliaParams.classList.add("hidden");
  }

  updateURLFromForm();
  generateFractal();
  showToast(`Loaded preset: ${presetName.replace('-', ' ').toUpperCase()}`);
}
const MAX_ITER = 1000;
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;

async function generateFractal() {
  const type = $("type").value;
  const width = +$("width").value;
  const height = +$("height").value;
  const maxIter = +$("max_iter").value;

  if (maxIter > MAX_ITER) {
    showToast(`Max iterations allowed is ${MAX_ITER}`, 'error');
    return;
  }
  if (width > MAX_WIDTH || height > MAX_HEIGHT) {
    showToast(`Max resolution is ${MAX_WIDTH}x${MAX_HEIGHT}`, 'error');
    return;
  }

  const payload = {
    width,
    height,
    max_iter: maxIter,
    escape_radius: 100,
    rule: $("rule").value,
    colormap: $("colormap").value,
    gamma: +$("gamma").value
  };

  if (type === "mandelbrot") {
    payload.x_center = 0.0;
    payload.y_center = 0.0;
    payload.zoom = +$("zoom").value;
  }

  if (type === "julia") {
    payload.c_real = +$("c_real").value;
    payload.c_imag = +$("c_imag").value;
    payload.x_range = [-2, 2];
    payload.y_range = [-2, 2];
  }

  // Show loading state
  output.style.opacity = 0.3;
  output.style.filter = "blur(6px)";
  spinner.classList.remove("hidden");

  try {
    const response = await fetch(`${API_BASE}/generate/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (data.image) {
      output.onload = () => {
        output.style.opacity = 1;
        output.style.filter = "blur(0)";
        spinner.classList.add("hidden");
      };
      output.src = data.image;
      
      // Store current image data for download
      window.currentFractalData = {
        imageUrl: data.image,
        params: payload,
        type: type,
        timestamp: Date.now()
      };
      
    } else {
      showToast("Error generating fractal: " + JSON.stringify(data), 'error');
      spinner.classList.add("hidden");
    }
  } catch (err) {
    showToast("Network error: " + err.message, 'error');
    spinner.classList.add("hidden");
  }
}

function downloadImage() {
  if (!window.currentFractalData) {
    showToast("No fractal to download. Generate one first!", 'error');
    return;
  }

  const link = document.createElement('a');
  link.href = window.currentFractalData.imageUrl;
  link.download = `fractal-${window.currentFractalData.type}-${Date.now()}.png`;
  link.click();
  
  showToast("Download started!");
}

function saveToFavorites() {
  if (!window.currentFractalData) {
    showToast("No fractal to save. Generate one first!", 'error');
    return;
  }

  const name = prompt("Enter a name for this fractal:", `${window.currentFractalData.type}-${Date.now()}`);
  if (!name) return;

  const favorites = getFavorites();
  const favoriteData = {
    id: Date.now(),
    name: name,
    imageUrl: window.currentFractalData.imageUrl,
    params: getCurrentParams(),
    timestamp: Date.now()
  };

  favorites.push(favoriteData);
  
  // Keep only last 20 favorites to avoid storage issues
  if (favorites.length > 20) {
    favorites.splice(0, favorites.length - 20);
  }
  
  saveFavorites(favorites);
  loadFavorites();
  showToast(`Saved "${name}" to favorites!`);
}

function shareImage() {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    showToast("URL copied to clipboard!");
  }).catch(() => {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = url;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showToast("URL copied to clipboard!");
  });
}

function getCurrentParams() {
  const params = {};
  controls.forEach(id => {
    const el = $(id);
    if (el && !el.closest('.hidden')) {
      params[id] = el.value;
    }
  });
  return params;
}

function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem('fractalFavorites') || '[]');
  } catch {
    return [];
  }
}

function saveFavorites(favorites) {
  localStorage.setItem('fractalFavorites', JSON.stringify(favorites));
}

function loadFavorites() {
  const favorites = getFavorites();
  const container = $('favorites-container');
  
  if (favorites.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #888; font-size: 0.9rem;">No favorites saved yet</p>';
    return;
  }

  container.innerHTML = favorites.map(fav => `
    <div class="favorite-item" onclick="loadFavorite(${fav.id})">
      <button class="delete-favorite" onclick="event.stopPropagation(); deleteFavorite(${fav.id})">×</button>
      <img src="${fav.imageUrl}" alt="${fav.name}" class="favorite-preview" />
      <div class="favorite-name">${fav.name}</div>
    </div>
  `).join('');
}

function loadFavorite(id) {
  const favorites = getFavorites();
  const favorite = favorites.find(f => f.id === id);
  if (!favorite) return;

  Object.keys(favorite.params).forEach(key => {
    const el = $(key);
    if (el) {
      el.value = favorite.params[key];
    }
  });

  if (favorite.params.type === "julia") {
    juliaParams.classList.remove("hidden");
  } else {
    juliaParams.classList.add("hidden");
  }

  updateURLFromForm();
  generateFractal();
  showToast(`Loaded favorite: ${favorite.name}`);
}

function deleteFavorite(id) {
  const favorites = getFavorites();
  const filtered = favorites.filter(f => f.id !== id);
  saveFavorites(filtered);
  loadFavorites();
  showToast("Favorite deleted");
}

function clearAllFavorites() {
  if (confirm("Are you sure you want to delete all favorites? This cannot be undone.")) {
    saveFavorites([]);
    loadFavorites();
    showToast("All favorites cleared");
  }
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Initialize app
window.addEventListener("DOMContentLoaded", () => {
  loadFormFromURL();
  loadFavorites();
  generateFractal();
});

