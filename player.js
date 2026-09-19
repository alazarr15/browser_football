/**
 * Smart TV Live Football / Sports Stream Player
 * Ultra-lightweight, zero-framework, hardware-accelerated HLS & remote control support.
 */

(function () {
  'use strict';

  var CHANNEL_CONFIG_VERSION = 'v2';

  // --- Default Channel List ---
  var DEFAULT_CHANNELS = [
    {
      id: 'usa_stream',
      name: 'Live Match (USA)',
      url: 'https://a11.kora-plus.li/live/usa.m3u8?token=td5JiwrF_5Q5z8J0cCI315AjBYw&exp=1789828230',
      category: 'Live'
    },
    {
      id: 'tnt1',
      name: 'TNT Sports 1',
      url: 'https://a14.kora-plus.li/live/tnt1.m3u8?token=g9VsgiYY9Fl6gvjzIuNFL7xSb6M&exp=1789826990',
      category: 'Sports'
    }
  ];

  // --- State ---
  var channels = [];
  var currentChannelIndex = 0;
  var osdTimeout = null;
  var OSD_DURATION = 4000; // Auto-hide OSD after 4s
  var hlsInstance = null;
  var aspectModes = ['fit', 'fill', 'cover'];
  var currentAspectIndex = 0;

  // --- DOM Elements ---
  var video = document.getElementById('tv-video');
  var osd = document.getElementById('osd');
  var osdMiddleTrigger = document.getElementById('osd-middle-trigger');
  var statusOverlay = document.getElementById('status-overlay');
  var statusText = document.getElementById('status-text');
  var currentChannelNameEl = document.getElementById('current-channel-name');
  var clockEl = document.getElementById('digital-clock');

  // Controls
  var btnPlayPause = document.getElementById('btn-play-pause');
  var playIcon = document.getElementById('play-icon');
  var btnChannels = document.getElementById('btn-channels');
  var btnAddStream = document.getElementById('btn-add-stream');
  var btnReload = document.getElementById('btn-reload');
  var btnAspect = document.getElementById('btn-aspect');
  var aspectLabel = document.getElementById('aspect-label');
  var btnFullscreen = document.getElementById('btn-fullscreen');

  // Drawer & Modals
  var channelDrawer = document.getElementById('channel-drawer');
  var channelListEl = document.getElementById('channel-list');
  var btnCloseDrawer = document.getElementById('btn-close-drawer');

  var modalAddStream = document.getElementById('modal-add-stream');
  var btnCloseModal = document.getElementById('btn-close-modal');
  var btnSaveStream = document.getElementById('btn-save-stream');
  var btnCancelStream = document.getElementById('btn-cancel-stream');
  var inputStreamName = document.getElementById('input-stream-name');
  var inputStreamUrl = document.getElementById('input-stream-url');

  // --- Initialize Storage ---
  function loadChannels() {
    try {
      var currentVersion = localStorage.getItem('tv_stream_version');
      var saved = localStorage.getItem('tv_stream_channels');
      if (saved && currentVersion === CHANNEL_CONFIG_VERSION) {
        channels = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('LocalStorage unavailable or disabled:', e);
    }

    if (!channels || channels.length === 0) {
      channels = DEFAULT_CHANNELS.slice(0);
      saveChannels();
    }
  }

  function saveChannels() {
    try {
      localStorage.setItem('tv_stream_version', CHANNEL_CONFIG_VERSION);
      localStorage.setItem('tv_stream_channels', JSON.stringify(channels));
    } catch (e) {
      console.warn('Failed to save channels to localStorage:', e);
    }
  }

  // --- Digital Clock ---
  function updateClock() {
    var now = new Date();
    var hours = String(now.getHours()).padStart(2, '0');
    var minutes = String(now.getMinutes()).padStart(2, '0');
    if (clockEl) {
      clockEl.textContent = hours + ':' + minutes;
    }
  }
  setInterval(updateClock, 1000);
  updateClock();

  // --- Status & Buffering Indicators ---
  function showStatus(text) {
    statusText.textContent = text;
    statusOverlay.classList.remove('hidden');
  }

  function hideStatus() {
    statusOverlay.classList.add('hidden');
  }

  // --- OSD Visibility Control ---
  function wakeOSD() {
    osd.classList.add('visible');
    resetOSDTimeout();
  }

  function resetOSDTimeout() {
    if (osdTimeout) {
      clearTimeout(osdTimeout);
    }

    // Do not auto-hide if drawer or modal is open, or if video is paused
    var isDrawerOpen = !channelDrawer.classList.contains('hidden');
    var isModalOpen = !modalAddStream.classList.contains('hidden');
    if (isDrawerOpen || isModalOpen || video.paused) {
      return;
    }

    osdTimeout = setTimeout(function () {
      osd.classList.remove('visible');
    }, OSD_DURATION);
  }

  // --- Channel Drawer ---
  function renderChannelList() {
    channelListEl.innerHTML = '';
    channels.forEach(function (ch, idx) {
      var li = document.createElement('li');
      li.className = 'channel-item' + (idx === currentChannelIndex ? ' active' : '');
      li.tabIndex = 20 + idx;
      li.setAttribute('role', 'option');

      var nameSpan = document.createElement('span');
      nameSpan.className = 'channel-name';
      nameSpan.textContent = (idx + 1) + '. ' + ch.name;

      var tagSpan = document.createElement('span');
      tagSpan.className = 'channel-tag';
      tagSpan.textContent = ch.category || 'Live';

      li.appendChild(nameSpan);
      li.appendChild(tagSpan);

      li.addEventListener('click', function () {
        selectChannel(idx);
        closeDrawer();
      });

      li.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.keyCode === 13) {
          selectChannel(idx);
          closeDrawer();
        }
      });

      channelListEl.appendChild(li);
    });
  }

  function openDrawer() {
    renderChannelList();
    channelDrawer.classList.remove('hidden');
    wakeOSD();

    // Focus active or first item in drawer for remote control
    setTimeout(function () {
      var activeItem = channelListEl.querySelector('.channel-item.active') || channelListEl.querySelector('.channel-item');
      if (activeItem) {
        activeItem.focus();
      } else {
        btnCloseDrawer.focus();
      }
    }, 100);
  }

  function closeDrawer() {
    channelDrawer.classList.add('hidden');
    btnChannels.focus();
    resetOSDTimeout();
  }

  // --- Add Stream Modal ---
  function openAddModal() {
    modalAddStream.classList.remove('hidden');
    wakeOSD();
    inputStreamName.value = '';
    inputStreamUrl.value = '';
    setTimeout(function () {
      inputStreamName.focus();
    }, 100);
  }

  function closeAddModal() {
    modalAddStream.classList.add('hidden');
    btnAddStream.focus();
    resetOSDTimeout();
  }

  function saveCustomStream() {
    var name = inputStreamName.value.trim() || 'Custom Channel ' + (channels.length + 1);
    var url = inputStreamUrl.value.trim();

    if (!url) {
      alert('Please enter a valid .m3u8 stream URL');
      inputStreamUrl.focus();
      return;
    }

    channels.push({
      id: 'custom_' + Date.now(),
      name: name,
      url: url,
      category: 'Custom'
    });

    saveChannels();
    closeAddModal();
    selectChannel(channels.length - 1);
  }

  // --- Video Playback Engine (Hardware Native + Hls.js Fallback) ---
  function playStream(url) {
    showStatus('Connecting Stream...');

    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }

    // Attempt 1: Direct native hardware playback via <video src>
    // Essential for Smart TVs (Tizen, WebOS, Hisense, Opera TV) as it bypasses XHR CORS
    try {
      video.pause();
      video.removeAttribute('src');
      video.src = url;
      video.load(); // Required by older Smart TV engines

      var playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.then(function () {
          hideStatus();
        }).catch(function (err) {
          console.warn('Autoplay blocked or waiting for user interaction:', err);
          showStatus('Press OK / Play to Start');
        });
      }
    } catch (e) {
      console.warn('Native video assign error:', e);
    }

    // Fallback: If native video errors out, attempt HLS.js
    var onNativeError = function () {
      video.removeEventListener('error', onNativeError);
      console.log('Native playback failed, attempting HLS.js fallback...');
      fallbackToHls(url);
    };
    video.addEventListener('error', onNativeError, { once: true });
  }

  function fallbackToHls(url) {
    if (window.Hls) {
      initHls(url);
    } else {
      loadHlsLibrary(function (success) {
        if (success && window.Hls && window.Hls.isSupported()) {
          initHls(url);
        } else {
          showStatus('Stream offline or token expired. Press Reload.');
        }
      });
    }
  }

  function initHls(url) {
    if (!window.Hls.isSupported()) {
      showStatus('HLS playback not supported by browser.');
      return;
    }

    hlsInstance = new window.Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 30,
      maxBufferLength: 10,
      maxMaxBufferLength: 20
    });

    hlsInstance.loadSource(url);
    hlsInstance.attachMedia(video);

    hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, function () {
      video.play().catch(function () {
        showStatus('Press OK / Play to Start');
      });
      hideStatus();
    });

    hlsInstance.on(window.Hls.Events.ERROR, function (event, data) {
      if (data.fatal) {
        switch (data.type) {
          case window.Hls.ErrorTypes.NETWORK_ERROR:
            showStatus('Network/Stream error. Retrying...');
            hlsInstance.startLoad();
            break;
          case window.Hls.ErrorTypes.MEDIA_ERROR:
            showStatus('Media buffer error. Recovering...');
            hlsInstance.recoverMediaError();
            break;
          default:
            showStatus('Stream offline or token expired. Press Reload.');
            hlsInstance.destroy();
            break;
        }
      }
    });
  }

  function loadHlsLibrary(callback) {
    if (window.Hls) {
      callback(true);
      return;
    }

    var script = document.createElement('script');
    script.src = 'hls.min.js'; // Local file for fast load & offline support
    script.async = true;
    script.onload = function () {
      callback(true);
    };
    script.onerror = function () {
      console.warn('Local hls.min.js not found, trying CDN fallback...');
      var cdnScript = document.createElement('script');
      cdnScript.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js';
      cdnScript.async = true;
      cdnScript.onload = function () {
        callback(true);
      };
      cdnScript.onerror = function () {
        console.warn('Failed to load Hls.js from CDN.');
        callback(false);
      };
      document.head.appendChild(cdnScript);
    };
    document.head.appendChild(script);
  }

  function selectChannel(index) {
    if (index < 0 || index >= channels.length) return;
    currentChannelIndex = index;
    var ch = channels[currentChannelIndex];
    currentChannelNameEl.textContent = ch.name;
    document.title = ch.name + ' - TV Player';
    playStream(ch.url);
  }

  // --- Aspect Ratio Toggle ---
  function toggleAspectRatio() {
    currentAspectIndex = (currentAspectIndex + 1) % aspectModes.length;
    var mode = aspectModes[currentAspectIndex];
    video.className = '';
    if (mode === 'fill') {
      video.classList.add('aspect-fill');
      aspectLabel.textContent = 'Stretch';
    } else if (mode === 'cover') {
      video.classList.add('aspect-cover');
      aspectLabel.textContent = 'Zoom';
    } else {
      aspectLabel.textContent = 'Fit (16:9)';
    }
  }

  // --- Fullscreen Toggle ---
  function toggleFullscreen() {
    var doc = window.document;
    var docEl = doc.documentElement;

    var requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
    var cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

    if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
      if (requestFullScreen) {
        requestFullScreen.call(docEl);
      }
    } else {
      if (cancelFullScreen) {
        cancelFullScreen.call(doc);
      }
    }
  }

  // --- Video Event Listeners ---
  video.addEventListener('playing', function () {
    hideStatus();
    playIcon.innerHTML = '&#10074;&#10074;';
    btnPlayPause.querySelector('.btn-label').textContent = 'Pause';
    resetOSDTimeout();
  });

  video.addEventListener('pause', function () {
    playIcon.innerHTML = '&#9658;';
    btnPlayPause.querySelector('.btn-label').textContent = 'Play';
    wakeOSD();
  });

  video.addEventListener('waiting', function () {
    showStatus('Buffering...');
  });

  video.addEventListener('error', function (e) {
    showStatus('Stream Error / Offline. Press Reload.');
  });

  // --- Button Event Listeners ---
  btnPlayPause.addEventListener('click', function () {
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  });

  btnChannels.addEventListener('click', function () {
    openDrawer();
  });

  btnCloseDrawer.addEventListener('click', function () {
    closeDrawer();
  });

  btnAddStream.addEventListener('click', function () {
    openAddModal();
  });

  btnCloseModal.addEventListener('click', function () {
    closeAddModal();
  });

  btnCancelStream.addEventListener('click', function () {
    closeAddModal();
  });

  btnSaveStream.addEventListener('click', function () {
    saveCustomStream();
  });

  btnReload.addEventListener('click', function () {
    selectChannel(currentChannelIndex);
  });

  btnAspect.addEventListener('click', function () {
    toggleAspectRatio();
  });

  btnFullscreen.addEventListener('click', function () {
    toggleFullscreen();
  });

  osdMiddleTrigger.addEventListener('click', function () {
    if (osd.classList.contains('visible')) {
      osd.classList.remove('visible');
    } else {
      wakeOSD();
    }
  });

  // Wake OSD on user interaction (mouse/virtual pointer)
  window.addEventListener('mousemove', function () {
    wakeOSD();
  });

  // --- TV Remote & Keyboard Spatial Navigation ---
  window.addEventListener('keydown', function (e) {
    var key = e.key;
    var code = e.keyCode;

    wakeOSD();

    // TV Remote Color Keys:
    // Red (403): Fullscreen
    // Green (404): Channel Drawer
    // Yellow (405): Reload
    // Blue (406): Aspect Ratio
    if (code === 403 || key === 'F' || key === 'f') {
      e.preventDefault();
      toggleFullscreen();
      return;
    }
    if (code === 404 || key === 'c' || key === 'C') {
      e.preventDefault();
      if (channelDrawer.classList.contains('hidden')) {
        openDrawer();
      } else {
        closeDrawer();
      }
      return;
    }
    if (code === 405 || key === 'r' || key === 'R') {
      e.preventDefault();
      selectChannel(currentChannelIndex);
      return;
    }
    if (code === 406 || key === 'a' || key === 'A') {
      e.preventDefault();
      toggleAspectRatio();
      return;
    }

    // Media Keys / Space: Play/Pause
    if (key === 'MediaPlayPause' || key === ' ' || code === 179 || code === 32) {
      // Don't intercept space if focused on text input
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      e.preventDefault();
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
      return;
    }

    // Back / Return / Escape:
    // Tizen: 10009, WebOS: 461, Escape: 27, Backspace: 8
    if (code === 27 || code === 10009 || code === 461 || (code === 8 && document.activeElement.tagName !== 'INPUT')) {
      e.preventDefault();
      if (!modalAddStream.classList.contains('hidden')) {
        closeAddModal();
        return;
      }
      if (!channelDrawer.classList.contains('hidden')) {
        closeDrawer();
        return;
      }
      // If OSD is visible, hide it
      if (osd.classList.contains('visible')) {
        osd.classList.remove('visible');
      }
      return;
    }

    // Quick channel change via Up / Down arrows if controls are hidden
    if (!osd.classList.contains('visible')) {
      if (key === 'ArrowUp' || code === 38) {
        e.preventDefault();
        var nextIdx = (currentChannelIndex - 1 + channels.length) % channels.length;
        selectChannel(nextIdx);
        wakeOSD();
        return;
      }
      if (key === 'ArrowDown' || code === 40) {
        e.preventDefault();
        var nextIdx = (currentChannelIndex + 1) % channels.length;
        selectChannel(nextIdx);
        wakeOSD();
        return;
      }
    }

    // Standard D-Pad Navigation inside controls
    handleSpatialNavigation(e);
  });

  // Directional navigation helper for Smart TV Remote
  function handleSpatialNavigation(e) {
    var key = e.key;
    var code = e.keyCode;

    // Only handle arrow keys
    if (code !== 37 && code !== 38 && code !== 39 && code !== 40 &&
        key !== 'ArrowLeft' && key !== 'ArrowUp' && key !== 'ArrowRight' && key !== 'ArrowDown') {
      return;
    }

    // If modal is open, let tab/focus stay in modal
    if (!modalAddStream.classList.contains('hidden')) {
      return;
    }

    // If drawer is open, handle up/down in channel list
    if (!channelDrawer.classList.contains('hidden')) {
      var currentFocus = document.activeElement;
      var drawerItems = Array.from(channelDrawer.querySelectorAll('.channel-item, .drawer-close-btn'));
      var currIndex = drawerItems.indexOf(currentFocus);

      if (key === 'ArrowDown' || code === 40) {
        e.preventDefault();
        var next = drawerItems[(currIndex + 1) % drawerItems.length];
        if (next) next.focus();
      } else if (key === 'ArrowUp' || code === 38) {
        e.preventDefault();
        var prev = drawerItems[(currIndex - 1 + drawerItems.length) % drawerItems.length];
        if (prev) prev.focus();
      } else if (key === 'ArrowRight' || code === 39) {
        closeDrawer();
      }
      return;
    }

    // Bottom controls navigation
    var bottomBtns = Array.from(document.querySelectorAll('.controls-row .tv-btn'));
    var activeIdx = bottomBtns.indexOf(document.activeElement);

    if (activeIdx === -1) {
      // Default to first button if none focused
      bottomBtns[0].focus();
      return;
    }

    if (key === 'ArrowRight' || code === 39) {
      e.preventDefault();
      var nextBtn = bottomBtns[(activeIdx + 1) % bottomBtns.length];
      nextBtn.focus();
    } else if (key === 'ArrowLeft' || code === 37) {
      e.preventDefault();
      var prevBtn = bottomBtns[(activeIdx - 1 + bottomBtns.length) % bottomBtns.length];
      prevBtn.focus();
    }
  }

  // --- Start Up ---
  loadChannels();
  selectChannel(0);

  // Set initial focus to Play button for immediate TV remote usability
  setTimeout(function () {
    btnPlayPause.focus();
    resetOSDTimeout();
  }, 500);

})();
