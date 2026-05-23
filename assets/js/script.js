const audio = document.getElementById("audio");
audio.loop = true;
audio.preload = "auto";

const stage = document.querySelector(".stage");
const radioUnit = document.getElementById("radioUnit");

const mode = document.getElementById("mode");
const freq = document.getElementById("freq");
const stationName = document.getElementById("stationName");

const volumeKnob = document.getElementById("volumeKnob");
const stationKnob = document.getElementById("stationKnob");
const powerBtn = document.getElementById("powerBtn");
const powerLed = document.getElementById("powerLed");

document.addEventListener("contextmenu", (event) => {
  if (!(event.target instanceof Element)) return;

  const isInteractive = event.target.closest("a, button, .knob-container, input, textarea, select");

  if (!isInteractive && event.target.closest(".stage")) {
    event.preventDefault();
  }
});

document.querySelectorAll("img").forEach((img) => {
  img.setAttribute("draggable", "false");
  img.addEventListener("dragstart", (event) => event.preventDefault());
});

const spotifyBtn = document.getElementById("spotifyBtn");
const instagramBtn = document.getElementById("instagramBtn");
const youtubeBtn = document.getElementById("youtubeBtn");

const bgIntroVideo = document.getElementById("bgIntroVideo");
const backgroundContainer = document.querySelector(".background-container");

if (bgIntroVideo && backgroundContainer) {
  const INTRO_VIDEO_START_RATIO = 0.10;
  let introVideoStarted = false;
  let introVideoFinished = false;
  let seekFallbackTimer = null;

  const freezeVideoOnFinalFrame = () => {
    if (introVideoFinished) return;

    introVideoFinished = true;
    clearTimeout(seekFallbackTimer);

    backgroundContainer.classList.add("bg-video-ready");
    backgroundContainer.classList.add("bg-video-ended");

    bgIntroVideo.pause();
  };

  const revealFallbackBackground = () => {
    if (introVideoFinished) return;

    introVideoFinished = true;
    clearTimeout(seekFallbackTimer);

    backgroundContainer.classList.remove("bg-video-ready");
    backgroundContainer.classList.remove("bg-video-ended");
    backgroundContainer.classList.add("bg-video-error");

    bgIntroVideo.pause();
  };

  const showIntroVideo = () => {
    if (introVideoFinished) return;

    backgroundContainer.classList.add("bg-video-ready");

    const playPromise = bgIntroVideo.play();

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(revealFallbackBackground);
    }
  };

  const startIntroVideo = () => {
    if (introVideoStarted || introVideoFinished) return;

    introVideoStarted = true;
    bgIntroVideo.muted = true;
    bgIntroVideo.playsInline = true;

    const duration = Number.isFinite(bgIntroVideo.duration) ? bgIntroVideo.duration : 0;
    const startTime = duration > 0.5 ? duration * INTRO_VIDEO_START_RATIO : 0;

    if (startTime > 0) {
      const handleSeeked = () => {
        clearTimeout(seekFallbackTimer);
        showIntroVideo();
      };

      bgIntroVideo.addEventListener("seeked", handleSeeked, { once: true });

      try {
        bgIntroVideo.currentTime = startTime;
      } catch (error) {
        clearTimeout(seekFallbackTimer);
        showIntroVideo();
        return;
      }

      seekFallbackTimer = setTimeout(showIntroVideo, 900);
      return;
    }

    showIntroVideo();
  };

  bgIntroVideo.addEventListener("ended", freezeVideoOnFinalFrame, { once: true });
  bgIntroVideo.addEventListener("error", revealFallbackBackground, { once: true });

  if (bgIntroVideo.readyState >= 1) {
    startIntroVideo();
  } else {
    bgIntroVideo.addEventListener("loadedmetadata", startIntroVideo, { once: true });
  }

  bgIntroVideo.load();
}

if (spotifyBtn) spotifyBtn.href = "https://open.spotify.com/artist/6eETbW3z9hqi4ZvdNkdsS1";
if (instagramBtn) instagramBtn.href = "https://instagram.com/hellsingglockboyz";
if (youtubeBtn) youtubeBtn.href = "https://www.youtube.com/@vampiresarereal";

const turningSfx = new Audio("assets/audio/turning.mp3");
const changeSfx = new Audio("assets/audio/change.mp3");
const offSfx = new Audio("assets/audio/off.mp3");

turningSfx.volume = 0.5;
changeSfx.volume = 0.4;
offSfx.volume = 0.5;

function playSfx(sfx) {
  sfx.pause();
  sfx.currentTime = 0;
  sfx.play().catch(() => {});
}

let audioContext = null;
let audioSource = null;
let audioGain = null;

function setupAudioVolumeEngine() {
  if (audioGain) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    audioContext = new AudioContextClass();
    audioSource = audioContext.createMediaElementSource(audio);
    audioGain = audioContext.createGain();

    audioSource.connect(audioGain);
    audioGain.connect(audioContext.destination);
  } catch (error) {
    audioContext = null;
    audioSource = null;
    audioGain = null;
  }
}

function unlockAudioVolumeEngine() {
  setupAudioVolumeEngine();

  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
}

function applyMainAudioVolume(normalizedVolume) {
  audio.volume = normalizedVolume;

  if (audioGain && audioContext) {
    audioGain.gain.setTargetAtTime(normalizedVolume, audioContext.currentTime, 0.01);
  }
}

function stopAllSounds() {
  audio.pause();
  audio.currentTime = 0;

  turningSfx.pause();
  turningSfx.currentTime = 0;

  changeSfx.pause();
  changeSfx.currentTime = 0;
}

let radioOn = false;
let isBooting = false;
let currentStation = 0;

let rotationVolume = 120;
let rotationStation = 0;

const volumeMax = 300;

const stations = [
  { freq: "00.0", name: "NO SIGNAL", src: null },
  { freq: "7.0.1", name: "HELLSING RADIO", src: "assets/audio/set1_701.mp3" },
  { freq: "06.09", name: "MINAJ STATION", src: "assets/audio/set2_robert.mp3" },
  { freq: "33.3", name: "RADIO MALDADE", src: "assets/audio/set3_shinz.mp3" },
  { freq: "97.1", name: "DJ ERA FM", src: "assets/audio/set4_djera.mp3" },
  { freq: "16.29", name: "BADASSFCKNKID RADIO", src: "assets/audio/set5_tsuu.mp3" },
  { freq: "0.800", name: "BoulNoArt FM", src: "assets/audio/set6_esdras.mp3" },
];

const stationStartTimes = stations.map(() => null);

function setSpeakerMotion(hasAudioStation) {
  stage.classList.toggle("station-playing", Boolean(radioOn && hasAudioStation));
}

function setDisplay(nextFreq, nextName) {
  mode.textContent = "FM";
  freq.textContent = nextFreq;
  stationName.textContent = nextName;
}

function glitchDisplay(finalFreq, finalName, callback) {
  const chars = "01XHGB!?/#$%";
  let ticks = 0;

  const interval = setInterval(() => {
    if (!radioOn) {
      clearInterval(interval);
      return;
    }

    freq.textContent = (Math.random() * 108).toFixed(1);

    stationName.textContent = Array.from({ length: 8 }, () => {
      return chars[Math.floor(Math.random() * chars.length)];
    }).join("");

    ticks++;

    if (ticks >= 8) {
      clearInterval(interval);
      setDisplay(finalFreq, finalName);
      if (callback) callback();
    }
  }, 65);
}

function setVolumeFromRotation() {
  let normalized = rotationVolume / volumeMax;
  normalized = Math.max(0, Math.min(1, normalized));

  applyMainAudioVolume(normalized);
  volumeKnob.style.transform = `rotate(${rotationVolume}deg)`;

  const ariaValue = Math.round(normalized * 100);
  volumeKnob.setAttribute("aria-valuenow", String(ariaValue));
}

function bootSequence(callback) {
  isBooting = true;

  playSfx(turningSfx);

  setDisplay("----", "BOOTING...");

  const bootSteps = [
    "SCANNING",
    "LOADING",
    "CALIBRATING",
    "LOCKED"
  ];

  let step = 0;

  const interval = setInterval(() => {
    if (!radioOn) {
      clearInterval(interval);
      isBooting = false;
      return;
    }

    if (step < bootSteps.length) {
      stationName.textContent = bootSteps[step];
      freq.textContent = (Math.random() * 108).toFixed(1);
      step++;
    } else {
      clearInterval(interval);
      isBooting = false;

      turningSfx.pause();
      turningSfx.currentTime = 0;

      if (callback) callback();
    }
  }, 520);
}

function startCurrentStation() {
  if (!radioOn) return;

  const station = stations[currentStation];
  setSpeakerMotion(Boolean(station.src));

  glitchDisplay(station.freq, station.name, () => {
    if (!station.src) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      setSpeakerMotion(false);
      return;
    }

    if (stationStartTimes[currentStation] === null) {
      stationStartTimes[currentStation] = Date.now();
    }

    audio.src = station.src;

    audio.onloadedmetadata = () => {
      const elapsed = (Date.now() - stationStartTimes[currentStation]) / 1000;
      audio.currentTime = audio.duration ? elapsed % audio.duration : 0;
      audio.play().catch(() => {});
    };
  });
}

const stationStep = 270 / (stations.length - 1);

function tuneToStation(newIndex) {
  currentStation = newIndex;
  rotationStation = stationStep * currentStation;

  playSfx(changeSfx);

  stationKnob.style.transform = `rotate(${rotationStation}deg)`;
  stationKnob.setAttribute("aria-valuenow", String(currentStation));

  startCurrentStation();
}

function changeStation(direction) {
  if (!radioOn || isBooting) return;

  const newIndex = currentStation + direction;

  if (newIndex < 0 || newIndex >= stations.length) return;

  tuneToStation(newIndex);
}

function clickNextStation() {
  if (!radioOn || isBooting) return;

  const newIndex = (currentStation + 1) % stations.length;
  tuneToStation(newIndex);
}

powerBtn.addEventListener("click", () => {
  unlockAudioVolumeEngine();

  if (!radioOn) {
    radioOn = true;

    stage.classList.add("radio-active");
    radioUnit.classList.add("radio-active");
    powerBtn.classList.add("power-on");
    powerLed.classList.add("on");

    bootSequence(() => startCurrentStation());
  } else {
    radioOn = false;
    isBooting = false;

    stage.classList.remove("radio-active");
    stage.classList.remove("station-playing");
    radioUnit.classList.remove("radio-active");
    powerBtn.classList.remove("power-on");
    powerLed.classList.remove("on");

    stopAllSounds();
    playSfx(offSfx);

    setDisplay("----", "OFFLINE");
  }
});

function enableKnobDrag(knob, onMove, onTap) {
  let dragging = false;
  let lastY = 0;
  let totalMovement = 0;
  let pendingDeltaY = 0;

  const tapMovementLimit = 6;

  function startDrag(clientY, event) {
    if (!radioOn) return;

    unlockAudioVolumeEngine();

    dragging = true;
    lastY = clientY;
    totalMovement = 0;
    pendingDeltaY = 0;
    event.preventDefault();
  }

  function stopDrag() {
    if (!dragging) return;

    dragging = false;

    if (totalMovement <= tapMovementLimit && typeof onTap === "function") {
      onTap();
    }

    totalMovement = 0;
    pendingDeltaY = 0;
  }

  function moveDrag(clientY) {
    if (!dragging) return;

    const deltaY = lastY - clientY;

    if (Math.abs(deltaY) > 1) {
      totalMovement += Math.abs(deltaY);
      pendingDeltaY += deltaY;
      lastY = clientY;

      if (totalMovement > tapMovementLimit) {
        onMove(pendingDeltaY);
        pendingDeltaY = 0;
      }
    }
  }

  knob.addEventListener("mousedown", (event) => {
    startDrag(event.clientY, event);
  });

  knob.addEventListener("touchstart", (event) => {
    if (!event.touches.length) return;
    startDrag(event.touches[0].clientY, event);
  }, { passive: false });

  document.addEventListener("mouseup", stopDrag);

  document.addEventListener("touchend", stopDrag);
  document.addEventListener("touchcancel", stopDrag);

  document.addEventListener("mousemove", (event) => {
    moveDrag(event.clientY);
  });

  document.addEventListener("touchmove", (event) => {
    if (!event.touches.length) return;
    moveDrag(event.touches[0].clientY);
  }, { passive: false });
}

function clickStepVolume() {
  if (!radioOn) return;

  unlockAudioVolumeEngine();

  const currentPercent = Math.round(
    Math.max(0, Math.min(1, rotationVolume / volumeMax)) * 100
  );

  const nextPercent = currentPercent >= 100
    ? 0
    : Math.min(100, (Math.floor(currentPercent / 25) + 1) * 25);

  rotationVolume = (nextPercent / 100) * volumeMax;
  setVolumeFromRotation();
}

enableKnobDrag(volumeKnob, (deltaY) => {
  rotationVolume = Math.max(0, Math.min(volumeMax, rotationVolume + deltaY));
  setVolumeFromRotation();
}, clickStepVolume);

volumeKnob.addEventListener("wheel", (event) => {
  if (!radioOn) return;

  unlockAudioVolumeEngine();
  event.preventDefault();

  rotationVolume = Math.max(
    0,
    Math.min(volumeMax, rotationVolume + (event.deltaY > 0 ? -15 : 15))
  );

  setVolumeFromRotation();
}, { passive: false });

let stationDragAccumulator = 0;

enableKnobDrag(stationKnob, (deltaY) => {
  stationDragAccumulator += deltaY;

  if (stationDragAccumulator > 18) {
    changeStation(1);
    stationDragAccumulator = 0;
  }

  if (stationDragAccumulator < -18) {
    changeStation(-1);
    stationDragAccumulator = 0;
  }
}, clickNextStation);

stationKnob.addEventListener("wheel", (event) => {
  if (!radioOn || isBooting) return;

  event.preventDefault();

  changeStation(event.deltaY > 0 ? -1 : 1);
}, { passive: false });

setVolumeFromRotation();
setDisplay("---.-", "OFFLINE");
stationKnob.setAttribute("aria-valuenow", String(currentStation));
