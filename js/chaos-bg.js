/**
 * ✨ PREMIUM ATMOSPHERE ENGINE v6.0 (Animated Video + Theme Toggle)
 * Full-screen background video + dark/light mode toggle
 * Zero impact on existing UI components.
 */

(function () {
  'use strict';

  /* ════════════════════════════════════════════════════
     1. INJECT STYLES
     ════════════════════════════════════════════════════ */
  const style = document.createElement('style');
  style.textContent = `
    /* =========================================
       ANIMATED BACKGROUND & LAYERING
       ========================================= */
    .video-bg-wrapper {
      position: fixed;
      inset: 0;
      z-index: -2;
      overflow: hidden;
      pointer-events: none;
    }

    .video-bg-element {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* Overlays inside the wrapper */
    .video-overlay, 
    .video-glow, 
    .video-vignette {
      position: absolute;
      inset: 0;
      pointer-events: none;
      transition: background 0.3s ease;
    }

    /* Ensure UI content stays above background */
    body > *:not(.video-bg-wrapper) {
      position: relative;
      z-index: 10;
    }

    /* =========================================
       DARK MODE (DEFAULT) STYLING
       ========================================= */
    html {
      background-color: #020617 !important;
    }

    body {
      color: #e5e7eb;
      background-color: transparent !important;
      transition: color 0.3s ease, background-color 0.3s ease;
    }

    .video-overlay {
      z-index: -1;
      background: rgba(2, 6, 23, 0.75);
    }

    .video-glow {
      z-index: -1;
      background: radial-gradient(circle at 35% 25%, rgba(99, 102, 241, 0.15), transparent 60%);
      mix-blend-mode: screen;
    }

    .video-vignette {
      z-index: -1;
      background: radial-gradient(ellipse 75% 65% at 50% 50%, transparent 40%, rgba(2, 6, 23, 0.9) 100%);
    }

    /* Default card glassmorphism for dark mode */
    .bg-white, [class*="bg-white"], .bg-slate-50 {
      background: rgba(15, 23, 42, 0.75) !important;
      backdrop-filter: blur(12px) !important;
      -webkit-backdrop-filter: blur(12px) !important;
      border-color: rgba(51, 65, 85, 0.5) !important;
      color: #e5e7eb !important;
      transition: all 0.3s ease;
    }
    
    header.sticky, header[class*="sticky"] {
      background: rgba(2, 6, 23, 0.88) !important;
      backdrop-filter: blur(18px) saturate(1.4);
      -webkit-backdrop-filter: blur(18px) saturate(1.4);
      border-bottom-color: rgba(51, 65, 85, 0.35) !important;
    }

    footer {
      background: rgba(0, 0, 0, 0.85) !important;
      backdrop-filter: blur(10px);
    }

    /* Fix text colors for dark */
    .text-slate-900 { color: #f1f5f9 !important; }
    .text-slate-600, .text-slate-500 { color: #94a3b8 !important; }

    /* Fix inputs for dark */
    input[type="text"], input[type="search"], select,
    input:not([type="time"]):not([type="checkbox"]):not([type="radio"]) {
      background: rgba(15, 23, 42, 0.8) !important;
      border-color: rgba(51, 65, 85, 0.6) !important;
      color: #e2e8f0 !important;
      transition: all 0.3s ease;
    }
    
    .floor-tab:not(.bg-primary),
    .day-tab:not(.bg-primary) {
      background: rgba(30, 41, 59, 0.6) !important;
      color: #94a3b8 !important;
      border-color: rgba(51, 65, 85, 0.4) !important;
    }

    /* Card hover glow */
    .bg-white:hover, [class*="bg-white"]:hover {
      border-color: rgba(99, 102, 241, 0.3) !important;
      box-shadow: 0 0 24px rgba(99, 102, 241, 0.07), 0 4px 20px rgba(0,0,0,0.35);
    }

    /* =========================================
       LIGHT MODE OVERRIDES
       ========================================= */
    html.light-mode {
      background-color: #f8fafc !important;
    }

    body.light-mode {
      color: #111;
    }

    body.light-mode .video-overlay {
      background: rgba(248, 250, 252, 0.88);
    }

    body.light-mode .video-glow {
      background: radial-gradient(circle at 35% 25%, rgba(59, 130, 246, 0.1), transparent 60%);
      mix-blend-mode: normal;
    }

    body.light-mode .video-vignette {
      background: radial-gradient(ellipse 75% 65% at 50% 50%, transparent 40%, rgba(203, 213, 225, 0.6) 100%);
    }

    /* Solid white cards for light mode */
    body.light-mode .bg-white, 
    body.light-mode [class*="bg-white"],
    body.light-mode .bg-slate-50 {
      background: rgba(255, 255, 255, 0.95) !important;
      border-color: #e2e8f0 !important;
      color: #111 !important;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03) !important;
    }

    body.light-mode header.sticky, body.light-mode header[class*="sticky"] {
      background: rgba(255, 255, 255, 0.95) !important;
      border-bottom-color: #e2e8f0 !important;
    }

    body.light-mode footer {
      background: #0f172a !important; 
    }

    body.light-mode .text-slate-900 { color: #0f172a !important; }
    body.light-mode .text-slate-600 { color: #475569 !important; }
    body.light-mode .text-slate-500 { color: #64748b !important; }

    body.light-mode input[type="text"], 
    body.light-mode input[type="search"], 
    body.light-mode select,
    body.light-mode input:not([type="time"]):not([type="checkbox"]):not([type="radio"]) {
      background: #ffffff !important;
      border-color: #cbd5e1 !important;
      color: #0f172a !important;
    }
    
    body.light-mode .floor-tab:not(.bg-primary),
    body.light-mode .day-tab:not(.bg-primary) {
      background: #f1f5f9 !important;
      color: #475569 !important;
      border-color: #cbd5e1 !important;
    }
    
    body.light-mode .bg-white:hover, body.light-mode [class*="bg-white"]:hover {
      border-color: #93c5fd !important;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
    }
  `;
  document.head.appendChild(style);

  /* ════════════════════════════════════════════════════
     2. BUILD ATMOSPHERE LAYER (HTML Injection)
     ════════════════════════════════════════════════════ */
  const wrapper = document.createElement('div');
  wrapper.className = 'video-bg-wrapper';

  const video = document.createElement('video');
  video.className = 'video-bg-element';
  video.autoplay = true;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;

  const source = document.createElement('source');
  /* Using a seamless abstract technology animated background */
  source.src = 'https://assets.mixkit.co/videos/preview/mixkit-abstract-technology-connection-background-2849-large.mp4';
  source.type = 'video/mp4';
  video.appendChild(source);

  const overlay = document.createElement('div');
  overlay.className = 'video-overlay';

  const glow = document.createElement('div');
  glow.className = 'video-glow';

  const vignette = document.createElement('div');
  vignette.className = 'video-vignette';

  wrapper.appendChild(video);
  wrapper.appendChild(overlay);
  wrapper.appendChild(glow);
  wrapper.appendChild(vignette);

  // Insert at start of body
  document.body.prepend(wrapper);

  /* ════════════════════════════════════════════════════
     3. THEME TOGGLE LOGIC
     ════════════════════════════════════════════════════ */
  window.addEventListener('DOMContentLoaded', () => {
    const currentTheme = localStorage.getItem('theme') || 'dark';

    // Apply initial theme
    if (currentTheme === 'light') {
      document.body.classList.add('light-mode');
      document.documentElement.classList.add('light-mode');
      document.documentElement.classList.remove('dark');
    } else {
      document.body.classList.remove('light-mode');
      document.documentElement.classList.remove('light-mode');
      document.documentElement.classList.add('dark');
    }

    updateIcons(currentTheme);
  });

  // Override the global toggleTheme function so the existing buttons work perfectly
  window.toggleTheme = function () {
    const isLight = !document.body.classList.contains('light-mode');
    
    if (isLight) {
      document.body.classList.add('light-mode');
      document.documentElement.classList.add('light-mode');
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      updateIcons('light');
    } else {
      document.body.classList.remove('light-mode');
      document.documentElement.classList.remove('light-mode');
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      updateIcons('dark');
    }
  };

  function updateIcons(theme) {
    const icon = theme === 'light' ? 'dark_mode' : 'light_mode'; // If light, show dark icon (to switch to dark)
    ['theme-icon', 'theme-icon-mobile', 'theme-btn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        // If it's a button containing the span, update the span
        const span = el.querySelector('.material-symbols-outlined');
        if (span) span.textContent = icon;
        else el.textContent = icon; // fallback
      }
    });
  }

  console.log(
    '%c✨ ATMOSPHERE v6.0 — Video BG & Dynamic Theme Active',
    'font-size:13px;color:#38bdf8;font-weight:bold;text-shadow:0 0 10px rgba(56,189,248,0.5);'
  );
})();
