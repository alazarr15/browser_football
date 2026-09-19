/**
 * Smart TV Live Football / Sports Stream Player
 * 100% Strict ES5 Compatible for Embedded Smart TV Browsers
 */

(function () {
  'use strict';

  var CHANNEL_CONFIG_VERSION = 'v3';

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

  // --- Helper: Pad 2 digits (Strict ES5, replaces padStart) ---
  function pad2(num) {
    var s = String(num);
    return s.length < 2 ? '0' + s : s;
  }

  // --- State ---
  var channels = [];
  var currentChannelIndex = 0;
  var osdTimeout = null;
  var OSD_DURATION = 4000;
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
      console.warn('LocalStorage error:', e);
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
      console.warn('Failed to save to localStorage:', e);
    }
  }

  // --- Digital Clock (Strict ES5) ---
  function updateClock() {
    try {
      var now = new Date();
      var hours = pad2(now.getHours());
      var minutes = pad2(now.getMinutes());
      if (clockEl) {
        clockEl.textContent = hours + ':' + minutes;
      }
    } catch (e) {
      console.warn('Clock error:', e);
    }
  }
  setInterval(updateClock, 1000);
  updateClock();

  // --- Status & Buffering Indicators ---
  function showStatus(text) {
    if (statusText) statusText.textContent = text;
    if (statusOverlay) statusOverlay.classList.remove('hidden');
  }

  function hideStatus() {
    if (statusOverlay) statusOverlay.classList.add('hidden');
  }

  // --- OSD Visibility Control ---
  function wakeOSD() {
    if (osd) osd.classList.add('visible');
    resetOSDTimeout();
  }

  function resetOSDTimeout() {
    if (osdTimeout) {
      clearTimeout(osdTimeout);
    }

    var isDrawerOpen = channelDrawer && !channelDrawer.classList.contains('hidden');
    var isModalOpen = modalAddStream && !modalAddStream.classList.contains('hidden');
    if (isDrawerOpen || isModalOpen || (video && video.paused)) {
      return;
    }

    osdTimeout = setTimeout(function () {
      if (osd) osd.classList.remove('visible');
    }, OSD_DURATION);
  }

  // --- Channel Drawer ---
  function renderChannelList() {
    if (!channelListEl) return;
    channelListEl.innerHTML = '';
    for (var i = 0; i < channels.length; i++) {
      (function (idx) {
        var ch = channels[idx];
        var li = document.createElement('li');
        li.className = 'channel-item' + (idx === currentChannelIndex ? ' active' : '');
        li.tabIndex = 20 + idx;

        var nameSpan = document.createElement('span');
        nameSpan.className = 'channel-name';
        nameSpan.textContent = (idx + 1) + '. ' + ch.name;

        var tagSpan = document.createElement('span');
        tagSpan.className = 'channel-tag';
        tagSpan.textContent = ch.category || 'Live';

        li.appendChild(nameSpan);
        li.appendChild(tagSpan);

        li.onclick = function () {
          selectChannel(idx);
          closeDrawer();
        };

        li.onkeydown = function (e) {
          var code = e.keyCode || e.which;
          if (code === 13) {
            selectChannel(idx);
            closeDrawer();
          }
        };

        channelListEl.appendChild(li);
      })(i);
    }
  }

  function openDrawer() {
    renderChannelList();
    if (channelDrawer) channelDrawer.classList.remove('hidden');
    wakeOSD();

    setTimeout(function () {
      var activeItem = channelListEl.querySelector('.channel-item.active') || channelListEl.querySelector('.channel-item');
      if (activeItem) {
        activeItem.focus();
      } else if (btnCloseDrawer) {
        btnCloseDrawer.focus();
      }
    }, 100);
  }

  function closeDrawer() {
    if (channelDrawer) channelDrawer.classList.add('hidden');
    if (btnChannels) btnChannels.focus();
    resetOSDTimeout();
  }

  // --- Add Stream Modal ---
  function openAddModal() {
    if (modalAddStream) modalAddStream.classList.remove('hidden');
    wakeOSD();
    if (inputStreamName) inputStreamName.value = '';
    if (inputStreamUrl) inputStreamUrl.value = '';
    setTimeout(function () {
      if (inputStreamName) inputStreamName.focus();
    }, 100);
  }

  function closeAddModal() {
    if (modalAddStream) modalAddStream.classList.add('hidden');
    if (btnAddStream) btnAddStream.focus();
    resetOSDTimeout();
  }

  function saveCustomStream() {
    var name = (inputStreamName && inputStreamName.value) ? inputStreamName.value.replace(/^\s+|\s+$/g, '') : '';
    var url = (inputStreamUrl && inputStreamUrl.value) ? inputStreamUrl.value.replace(/^\s+|\s+$/g, '') : '';

    if (!name) name = 'Custom Channel ' + (channels.length + 1);
    if (!url) {
      alert('Please enter a valid .m3u8 stream URL');
      if (inputStreamUrl) inputStreamUrl.focus();
      return;
    }

    channels.push({
      id: 'custom_' + new Date().getTime(),
      name: name,
      url: url,
      category: 'Custom'
    });

    saveChannels();
    closeAddModal();
    selectChannel(channels.length - 1);
  }

  // --- Safe Video Play Helper ---
  function safePlay() {
    if (!video) return;
    try {
      var promise = video.play();
      if (promise && typeof promise.then === 'function') {
        promise.then(function () {
          hideStatus();
        }).catch(function (err) {
          console.warn('Autoplay blocked:', err);
          showStatus('Press OK / Play to Start');
        });
      } else {
        // Older browser returning undefined
        hideStatus();
      }
    } catch (e) {
      console.warn('Play exception:', e);
      showStatus('Press OK / Play to Start');
    }
  }

  // --- Video Playback Engine (Strict ES5) ---
  function playStream(url) {
    showStatus('Connecting Stream...');

    if (hlsInstance) {
      try {
        hlsInstance.destroy();
      } catch (e) {}
      hlsInstance = null;
    }

    // Step 1: Assign direct native hardware video source
    // Smart TV engines (Tizen, webOS, Opera TV, NetFront) play HLS directly in hardware
    try {
      video.pause();
      video.src = url;
      if (typeof video.load === 'function') {
        video.load();
      }
      safePlay();
    } catch (e) {
      console.warn('Native video source set error:', e);
    }

    // Step 2: Set error listener to fall back to Hls.js if native video fails
    function handleNativeError() {
      video.removeEventListener('error', handleNativeError, false);
      console.log('Native playback failed, attempting HLS.js fallback...');
      fallbackToHls(url);
    }
    video.addEventListener('error', handleNativeError, false);
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
    if (!window.Hls || !window.Hls.isSupported()) {
      showStatus('HLS playback not supported by browser.');
      return;
    }

    try {
      hlsInstance = new window.Hls({
        enableWorker: false, // Turn off Web Worker for maximum embedded browser compatibility
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 10,
        maxMaxBufferLength: 20
      });

      hlsInstance.loadSource(url);
      hlsInstance.attachMedia(video);

      hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, function () {
        safePlay();
      });

      hlsInstance.on(window.Hls.Events.ERROR, function (event, data) {
        if (data && data.fatal) {
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
              try { hlsInstance.destroy(); } catch (e) {}
              break;
          }
        }
      });
    } catch (e) {
      console.warn('HLS init error:', e);
      showStatus('Stream Error. Press Reload.');
    }
  }

  function loadHlsLibrary(callback) {
    if (window.Hls) {
      callback(true);
      return;
    }

    var script = document.createElement('script');
    script.src = 'hls.min.js';
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
    if (currentChannelNameEl) {
      currentChannelNameEl.textContent = ch.name;
    }
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
      if (aspectLabel) aspectLabel.textContent = 'Stretch';
    } else if (mode === 'cover') {
      video.classList.add('aspect-cover');
      if (aspectLabel) aspectLabel.textContent = 'Zoom';
    } else {
      if (aspectLabel) aspectLabel.textContent = 'Fit (16:9)';
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
  if (video) {
    video.addEventListener('playing', function () {
      hideStatus();
      if (playIcon) playIcon.innerHTML = '&#10074;&#10074;';
      var label = btnPlayPause ? btnPlayPause.querySelector('.btn-label') : null;
      if (label) label.textContent = 'Pause';
      resetOSDTimeout();
    }, false);

    video.addEventListener('pause', function () {
      if (playIcon) playIcon.innerHTML = '&#9658;';
      var label = btnPlayPause ? btnPlayPause.querySelector('.btn-label') : null;
      if (label) label.textContent = 'Play';
      wakeOSD();
    }, false);

    video.addEventListener('waiting', function () {
      showStatus('Buffering...');
    }, false);

    video.addEventListener('error', function () {
      showStatus('Stream Offline. Press Reload.');
    }, false);
  }

  // --- Button Event Listeners ---
  if (btnPlayPause) {
    btnPlayPause.onclick = function () {
      if (video.paused) {
        safePlay();
      } else {
        video.pause();
      }
    };
  }

  if (btnChannels) {
    btnChannels.onclick = function () {
      openDrawer();
    };
  }

  if (btnCloseDrawer) {
    btnCloseDrawer.onclick = function () {
      closeDrawer();
    };
  }

  if (btnAddStream) {
    btnAddStream.onclick = function () {
      openAddModal();
    };
  }

  if (btnCloseModal) {
    btnCloseModal.onclick = function () {
      closeAddModal();
    };
  }

  if (btnCancelStream) {
    btnCancelStream.onclick = function () {
      closeAddModal();
    };
  }

  if (btnSaveStream) {
    btnSaveStream.onclick = function () {
      saveCustomStream();
    };
  }

  if (btnReload) {
    btnReload.onclick = function () {
      selectChannel(currentChannelIndex);
    };
  }

  if (btnAspect) {
    btnAspect.onclick = function () {
      toggleAspectRatio();
    };
  }

  if (btnFullscreen) {
    btnFullscreen.onclick = function () {
      toggleFullscreen();
    };
  }

  if (osdMiddleTrigger) {
    osdMiddleTrigger.onclick = function () {
      if (osd && osd.classList.contains('visible')) {
        osd.classList.remove('visible');
      } else {
        wakeOSD();
      }
    };
  }

  window.onmousemove = function () {
    wakeOSD();
  };

  // --- Helper: Convert NodeList to Array (Strict ES5) ---
  function toArray(nodeList) {
    var arr = [];
    if (!nodeList) return arr;
    for (var i = 0; i < nodeList.length; i++) {
      arr.push(nodeList[i]);
    }
    return arr;
  }

  // --- TV Remote & Keyboard Spatial Navigation ---
  window.onkeydown = function (e) {
    e = e || window.event;
    var key = e.key;
    var code = e.keyCode || e.which;

    wakeOSD();

    // TV Color Keys:
    // Red (403): Fullscreen
    // Green (404): Channel Drawer
    // Yellow (405): Reload
    // Blue (406): Aspect Ratio
    if (code === 403 || key === 'F' || key === 'f') {
      if (e.preventDefault) e.preventDefault();
      toggleFullscreen();
      return;
    }
    if (code === 404 || key === 'c' || key === 'C') {
      if (e.preventDefault) e.preventDefault();
      if (channelDrawer.classList.contains('hidden')) {
        openDrawer();
      } else {
        closeDrawer();
      }
      return;
    }
    if (code === 405 || key === 'r' || key === 'R') {
      if (e.preventDefault) e.preventDefault();
      selectChannel(currentChannelIndex);
      return;
    }
    if (code === 406 || key === 'a' || key === 'A') {
      if (e.preventDefault) e.preventDefault();
      toggleAspectRatio();
      return;
    }

    // Media Keys / Space: Play/Pause
    if (key === 'MediaPlayPause' || key === ' ' || code === 179 || code === 32) {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      if (e.preventDefault) e.preventDefault();
      if (video.paused) {
        safePlay();
      } else {
        video.pause();
      }
      return;
    }

    // Back / Return / ESC:
    // Tizen: 10009, WebOS: 461, Escape: 27, Backspace: 8
    if (code === 27 || code === 10009 || code === 461 || (code === 8 && document.activeElement && document.activeElement.tagName !== 'INPUT')) {
      if (e.preventDefault) e.preventDefault();
      if (!modalAddStream.classList.contains('hidden')) {
        closeAddModal();
        return;
      }
      if (!channelDrawer.classList.contains('hidden')) {
        closeDrawer();
        return;
      }
      if (osd.classList.contains('visible')) {
        osd.classList.remove('visible');
      }
      return;
    }

    // Quick channel change via Up / Down arrows if controls are hidden
    if (!osd.classList.contains('visible')) {
      if (key === 'ArrowUp' || code === 38) {
        if (e.preventDefault) e.preventDefault();
        var prevIdx = (currentChannelIndex - 1 + channels.length) % channels.length;
        selectChannel(prevIdx);
        wakeOSD();
        return;
      }
      if (key === 'ArrowDown' || code === 40) {
        if (e.preventDefault) e.preventDefault();
        var nextIdx = (currentChannelIndex + 1) % channels.length;
        selectChannel(nextIdx);
        wakeOSD();
        return;
      }
    }

    // Spatial Navigation
    handleSpatialNavigation(e);
  };

  function handleSpatialNavigation(e) {
    var key = e.key;
    var code = e.keyCode || e.which;

    if (code !== 37 && code !== 38 && code !== 39 && code !== 40 &&
        key !== 'ArrowLeft' && key !== 'ArrowUp' && key !== 'ArrowRight' && key !== 'ArrowDown') {
      return;
    }

    if (!modalAddStream.classList.contains('hidden')) {
      return;
    }

    // Channel drawer navigation
    if (!channelDrawer.classList.contains('hidden')) {
      var currentFocus = document.activeElement;
      var drawerItems = toArray(channelDrawer.querySelectorAll('.channel-item, .drawer-close-btn'));
      var currIndex = drawerItems.indexOf(currentFocus);

      if (key === 'ArrowDown' || code === 40) {
        if (e.preventDefault) e.preventDefault();
        var next = drawerItems[(currIndex + 1) % drawerItems.length];
        if (next) next.focus();
      } else if (key === 'ArrowUp' || code === 38) {
        if (e.preventDefault) e.preventDefault();
        var prev = drawerItems[(currIndex - 1 + drawerItems.length) % drawerItems.length];
        if (prev) prev.focus();
      } else if (key === 'ArrowRight' || code === 39) {
        closeDrawer();
      }
      return;
    }

    // Bottom controls navigation
    var bottomBtns = toArray(document.querySelectorAll('.controls-row .tv-btn'));
    var activeIdx = bottomBtns.indexOf(document.activeElement);

    if (activeIdx === -1) {
      if (bottomBtns.length > 0) bottomBtns[0].focus();
      return;
    }

    if (key === 'ArrowRight' || code === 39) {
      if (e.preventDefault) e.preventDefault();
      var nextBtn = bottomBtns[(activeIdx + 1) % bottomBtns.length];
      if (nextBtn) nextBtn.focus();
    } else if (key === 'ArrowLeft' || code === 37) {
      if (e.preventDefault) e.preventDefault();
      var prevBtn = bottomBtns[(activeIdx - 1 + bottomBtns.length) % bottomBtns.length];
      if (prevBtn) prevBtn.focus();
    }
  }

  // --- Initial Startup ---
  try {
    loadChannels();
    selectChannel(0);
    setTimeout(function () {
      if (btnPlayPause) btnPlayPause.focus();
      resetOSDTimeout();
    }, 500);
  } catch (err) {
    console.error('Startup error:', err);
    showStatus('Startup Error: ' + err.message);
  }

})();
