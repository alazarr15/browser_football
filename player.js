/**
 * Smart TV Live Football / Sports Stream Player
 * 100% Strict ES5 Compatible for Sony Bravia & Embedded Smart TV Browsers
 */

(function () {
  'use strict';

  var CHANNEL_CONFIG_VERSION = 'v6';

  var isLocalServer = (window.location.protocol === 'http:' && window.location.hostname !== 'alazarr15.github.io');

  // --- Default Channel List ---
  var DEFAULT_CHANNELS = [
    {
      id: 'usa_stream',
      name: 'Live Match (USA)',
      url: isLocalServer ? '/live.ts' : 'https://a16.kora-plus.li/live/usa.m3u8?token=3OWrgM5SPx-MHGNNgAFcKRykUVM&exp=1789830116',
      category: isLocalServer ? 'Bravia KDL' : 'Live'
    },
    {
      id: 'tnt1',
      name: 'TNT Sports 1',
      url: 'https://a14.kora-plus.li/live/tnt1.m3u8?token=g9VsgiYY9Fl6gvjzIuNFL7xSb6M&exp=1789826990',
      category: 'Sports'
    }
  ];

  // --- DOM Class Helpers (Strict ES5 without classList dependency) ---
  function hasClass(el, cls) {
    if (!el) return false;
    if (el.classList) return el.classList.contains(cls);
    return (' ' + el.className + ' ').indexOf(' ' + cls + ' ') > -1;
  }

  function addClass(el, cls) {
    if (!el || hasClass(el, cls)) return;
    if (el.classList) {
      el.classList.add(cls);
    } else {
      el.className = (el.className + ' ' + cls).replace(/^\s+/, '');
    }
  }

  function removeClass(el, cls) {
    if (!el || !hasClass(el, cls)) return;
    if (el.classList) {
      el.classList.remove(cls);
    } else {
      el.className = (' ' + el.className + ' ').replace(' ' + cls + ' ', ' ').replace(/^\s+|\s+$/g, '');
    }
  }

  // --- Helper: Pad 2 digits (Strict ES5) ---
  function pad2(num) {
    var s = String(num);
    return s.length < 2 ? '0' + s : s;
  }

  // --- State ---
  var channels = [];
  var currentChannelIndex = 0;
  var osdTimeout = null;
  var OSD_DURATION = 5000;
  var hlsInstance = null;
  var aspectModes = ['fit', 'fill', 'cover'];
  var currentAspectIndex = 0;
  var playbackTimeout = null;

  // --- DOM Elements ---
  var video = document.getElementById('tv-video');
  var osd = document.getElementById('osd');
  var osdMiddleTrigger = document.getElementById('osd-middle-trigger');
  var statusOverlay = document.getElementById('status-overlay');
  var statusText = document.getElementById('status-text');
  var statusSpinner = document.getElementById('status-spinner');
  var braviaTip = document.getElementById('bravia-tip');
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
    if (statusOverlay) removeClass(statusOverlay, 'hidden');
  }

  function hideStatus() {
    if (statusOverlay) addClass(statusOverlay, 'hidden');
  }

  function showBraviaAlert() {
    if (statusSpinner) statusSpinner.style.display = 'none';
    if (braviaTip) removeClass(braviaTip, 'hidden');
    showStatus('Video decoder unavailable in this TV browser');
    wakeOSD();
  }

  // --- OSD Visibility Control ---
  function wakeOSD() {
    if (osd) addClass(osd, 'visible');
    resetOSDTimeout();
  }

  function resetOSDTimeout() {
    if (osdTimeout) {
      clearTimeout(osdTimeout);
    }

    var isDrawerOpen = channelDrawer && !hasClass(channelDrawer, 'hidden');
    var isModalOpen = modalAddStream && !hasClass(modalAddStream, 'hidden');

    // Keep OSD visible if not actively playing video
    if (isDrawerOpen || isModalOpen || !video || video.paused || video.ended || video.currentTime === 0) {
      if (osd) addClass(osd, 'visible');
      return;
    }

    osdTimeout = setTimeout(function () {
      if (osd) removeClass(osd, 'visible');
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
    if (channelDrawer) removeClass(channelDrawer, 'hidden');
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
    if (channelDrawer) addClass(channelDrawer, 'hidden');
    if (btnChannels) btnChannels.focus();
    resetOSDTimeout();
  }

  // --- Add Stream Modal ---
  function openAddModal() {
    if (modalAddStream) removeClass(modalAddStream, 'hidden');
    wakeOSD();
    if (inputStreamName) inputStreamName.value = '';
    if (inputStreamUrl) inputStreamUrl.value = '';
    setTimeout(function () {
      if (inputStreamName) inputStreamName.focus();
    }, 100);
  }

  function closeAddModal() {
    if (modalAddStream) addClass(modalAddStream, 'hidden');
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
          if (playbackTimeout) clearTimeout(playbackTimeout);
        }).catch(function (err) {
          console.warn('Autoplay blocked:', err);
          showStatus('Press OK / Play on TV Remote to Start');
        });
      } else {
        hideStatus();
      }
    } catch (e) {
      console.warn('Play exception:', e);
      showStatus('Press OK / Play on TV Remote to Start');
    }
  }

  // --- Capabilities Check ---
  function supportsNativeHls() {
    try {
      var can = video && video.canPlayType('application/vnd.apple.mpegurl');
      return Boolean(can && can !== 'no' && can !== '');
    } catch (e) {
      return false;
    }
  }

  function supportsMse() {
    return Boolean(window.MediaSource || window.WebKitMediaSource);
  }

  // --- Video Playback Engine ---
  function playStream(url) {
    showStatus('Connecting Stream...');
    if (statusSpinner) statusSpinner.style.display = 'block';
    if (braviaTip) addClass(braviaTip, 'hidden');

    if (playbackTimeout) {
      clearTimeout(playbackTimeout);
    }

    if (hlsInstance) {
      try {
        hlsInstance.destroy();
      } catch (e) {}
      hlsInstance = null;
    }

    var hasNative = supportsNativeHls();
    var hasMse = supportsMse();

    // If neither native HLS nor MSE is supported (typical for non-Android Sony Bravia Internet Browser)
    if (!hasNative && !hasMse) {
      showBraviaAlert();
      return;
    }

    // Try direct native hardware playback first
    try {
      video.pause();
      video.src = url;
      if (typeof video.load === 'function') {
        video.load();
      }
      safePlay();
    } catch (e) {
      console.warn('Native video assign error:', e);
    }

    // If not playing within 6 seconds, check fallback
    playbackTimeout = setTimeout(function () {
      if (video && (video.paused || video.currentTime === 0)) {
        console.log('Stream not progressing, trying fallback...');
        if (hasMse) {
          fallbackToHls(url);
        } else {
          showBraviaAlert();
        }
      }
    }, 6000);

    function handleNativeError() {
      video.removeEventListener('error', handleNativeError, false);
      if (playbackTimeout) clearTimeout(playbackTimeout);
      if (hasMse) {
        fallbackToHls(url);
      } else {
        showBraviaAlert();
      }
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
          showBraviaAlert();
        }
      });
    }
  }

  function initHls(url) {
    if (!window.Hls || !window.Hls.isSupported()) {
      showBraviaAlert();
      return;
    }

    try {
      hlsInstance = new window.Hls({
        enableWorker: false,
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
              showBraviaAlert();
              try { hlsInstance.destroy(); } catch (e) {}
              break;
          }
        }
      });
    } catch (e) {
      console.warn('HLS init error:', e);
      showBraviaAlert();
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
      addClass(video, 'aspect-fill');
      if (aspectLabel) aspectLabel.textContent = 'Stretch';
    } else if (mode === 'cover') {
      addClass(video, 'aspect-cover');
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
      showStatus('Stream Error. Press Reload.');
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
      if (osd && hasClass(osd, 'visible')) {
        removeClass(osd, 'visible');
      } else {
        wakeOSD();
      }
    };
  }

  window.onmousemove = function () {
    wakeOSD();
  };

  // --- Helper: NodeList to Array ---
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

    if (code === 403 || key === 'F' || key === 'f') {
      if (e.preventDefault) e.preventDefault();
      toggleFullscreen();
      return;
    }
    if (code === 404 || key === 'c' || key === 'C') {
      if (e.preventDefault) e.preventDefault();
      if (channelDrawer && hasClass(channelDrawer, 'hidden')) {
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

    if (code === 27 || code === 10009 || code === 461 || (code === 8 && document.activeElement && document.activeElement.tagName !== 'INPUT')) {
      if (e.preventDefault) e.preventDefault();
      if (modalAddStream && !hasClass(modalAddStream, 'hidden')) {
        closeAddModal();
        return;
      }
      if (channelDrawer && !hasClass(channelDrawer, 'hidden')) {
        closeDrawer();
        return;
      }
      if (osd && hasClass(osd, 'visible')) {
        removeClass(osd, 'visible');
      }
      return;
    }

    if (osd && !hasClass(osd, 'visible')) {
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

    handleSpatialNavigation(e);
  };

  function handleSpatialNavigation(e) {
    var key = e.key;
    var code = e.keyCode || e.which;

    if (code !== 37 && code !== 38 && code !== 39 && code !== 40 &&
        key !== 'ArrowLeft' && key !== 'ArrowUp' && key !== 'ArrowRight' && key !== 'ArrowDown') {
      return;
    }

    if (modalAddStream && !hasClass(modalAddStream, 'hidden')) {
      return;
    }

    if (channelDrawer && !hasClass(channelDrawer, 'hidden')) {
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

  // --- Real-Time Phone Remote Sync Listener ---
  function initRemoteSync() {
    var ROOM_ID = 'alazar_tv_football';
    var NTFY_SSE_URL = 'https://ntfy.sh/' + ROOM_ID + '/sse';

    function handleRemoteAction(cmd) {
      if (!cmd) return;
      console.log('[Remote Sync] Command received:', cmd);

      if (cmd.action === 'play' && cmd.url) {
        var newCh = {
          id: 'remote_' + new Date().getTime(),
          name: cmd.name || 'Remote Stream',
          url: cmd.url,
          category: 'Remote'
        };
        channels.unshift(newCh);
        saveChannels();
        selectChannel(0);
        showStatus('📱 Stream updated from Phone Remote!');
        setTimeout(hideStatus, 4000);
      } else if (cmd.action === 'play_pause') {
        if (video.paused) {
          safePlay();
        } else {
          video.pause();
        }
      } else if (cmd.action === 'reload') {
        selectChannel(currentChannelIndex);
      } else if (cmd.action === 'aspect') {
        toggleAspectRatio();
      } else if (cmd.action === 'fullscreen') {
        toggleFullscreen();
      }
    }

    // 1. EventSource (SSE from ntfy.sh cloud broker)
    if (typeof window.EventSource !== 'undefined') {
      try {
        var es = new EventSource(NTFY_SSE_URL);
        es.onmessage = function (e) {
          try {
            var data = JSON.parse(e.data);
            var payload = null;
            if (typeof data.message === 'string') {
              try {
                payload = JSON.parse(data.message);
              } catch (err) {
                payload = { action: 'play', url: data.message };
              }
            } else if (data.cmd) {
              payload = data.cmd;
            }
            if (payload) {
              handleRemoteAction(payload);
            }
          } catch (err) {
            console.warn('[Remote Sync] Parse error:', err);
          }
        };
      } catch (e) {
        console.warn('[Remote Sync] EventSource failed:', e);
      }
    }

    // 2. LocalStorage Storage event (for same device / tab sync)
    window.addEventListener('storage', function (e) {
      if (e.key === 'tv_remote_command' && e.newValue) {
        try {
          var item = JSON.parse(e.newValue);
          if (item && item.cmd) {
            handleRemoteAction(item.cmd);
          }
        } catch (err) {}
      }
    }, false);
  }

  // --- Initial Startup ---
  try {
    loadChannels();
    selectChannel(0);
    initRemoteSync();
    setTimeout(function () {
      if (btnPlayPause) btnPlayPause.focus();
      resetOSDTimeout();
    }, 500);
  } catch (err) {
    console.error('Startup error:', err);
    showStatus('Startup Error: ' + err.message);
  }

})();
