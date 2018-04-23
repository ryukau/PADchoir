const TWO_PI = 2 * Math.PI

class RenderParameters {
  constructor(audioContext, overSampling) {
    this.audioContext = audioContext
    this.overSampling = overSampling
  }

  get sampleRate() {
    return this._sampleRate
  }

  get overSampling() {
    return this._overSampling
  }

  set overSampling(value) {
    this._overSampling = value
    this._sampleRate = this._overSampling * this.audioContext.sampleRate
  }
}

function play(audioContext, wave) {
  var channel = wave.channels
  var frame = wave.frames
  var buffer = audioContext.createBuffer(channel, frame, audioContext.sampleRate)

  for (var i = 0; i < wave.channels; ++i) {
    var waveFloat32 = new Float32Array(wave.data[i])
    buffer.copyToChannel(waveFloat32, i, 0)
  }

  if (this.source !== undefined) {
    this.source.stop()
  }
  this.source = audioContext.createBufferSource()
  this.source.buffer = buffer
  this.source.connect(audioContext.destination)
  this.source.start()
}

function save(wave) {
  var buffer = Wave.toBuffer(wave, wave.channels)
  var header = Wave.fileHeader(audioContext.sampleRate, wave.channels,
    buffer.length)

  var blob = new Blob([header, buffer], { type: "application/octet-stream" })
  var url = window.URL.createObjectURL(blob)

  var a = document.createElement("a")
  a.style = "display: none"
  a.href = url
  a.download = document.title + "_" + Date.now() + ".wav"
  document.body.appendChild(a)
  a.click()

  // Firefoxでダウンロードできるようにするための遅延。
  setTimeout(() => {
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }, 100)
}

function getChannels() {
  switch (pullDownMenuChannel.value) {
    case "Phase":
    case "Mono":
      return 1
    case "Stereo":
      return 2
  }
  return wave.channels
}

function makeWave() {
  headingRenderStatus.element.textContent = "⚠ Rendering ⚠"
  var channels = getChannels()
  for (var ch = 0; ch < channels; ++ch) {
    if (workers[ch].isRunning) {
      workers[ch].worker.terminate()
      workers[ch].worker = new Worker("renderer.js")
    }
    else {
      workers[ch].isRunning = true
    }
    workers[ch].worker.postMessage({
      length: inputLength.value,
      sampleRate: audioContext.sampleRate,
      baseFreq: inputBaseFreq.value,
      bandWidth: inputBandWidth.value,
      seed: inputSeed.value + inputSeed.max * ch,
      padType: pullDownMenuPadType.value,
      basefunc: inputBaseFunction.value,
      basefuncP1: inputBaseFunctionP1.value,
      modType: inputModType.value,
      modP1: inputModP1.value,
      modP2: inputModP2.value,
      modP3: inputModP3.value,
      filtType: inputFiltType.value,
      filtCutoff: inputFiltCutoff.value,
      filtQ: inputFiltQ.value,
      harmonicShift: inputHarmonicShift.value,
      adaptiveHarmonics: checkboxAdaptHarmo.value,
      adaptBaseFreq: inputAdaptBaseFreq.value,
      adaptPower: inputAdaptPower.value,
    })
  }

  workers.forEach((value, index) => {
    value.worker.onmessage = (event) => {
      wave.data[index] = event.data
      workers[index].isRunning = false
      if (workers.every((v) => !v.isRunning)) {
        if (channels === 1) {
          wave.copyChannel(index)
          if (pullDownMenuChannel.value === "Phase" && wave.channels > 1) {
            wave.rotate(1, Math.floor(wave.data[1].length / 2))
          }
        }
        finalize()
      }
    }
  })
}

function finalize() {
  if (checkboxNormalize.value) {
    wave.normalize()
  }
  wave.zeroOut(Math.floor(0.002 * audioContext.sampleRate))
  waveView.set(wave)

  if (checkboxQuickSave.value) {
    save(wave)
  }

  headingRenderStatus.element.textContent = "Rendering finished. ✓"
}

class WaveViewMulti {
  constructor(parent, channels) {
    this.waveView = []
    for (var i = 0; i < channels; ++i) {
      this.waveView.push(new WaveView(parent, 450, 256, wave.left, false))
    }
  }

  set(wave) {
    for (var ch = 0; ch < this.waveView.length; ++ch) {
      this.waveView[ch].set(wave.data[ch])
    }
  }
}

function refresh() {
  makeWave()
}

function randomRange(min, max) {
  return (max - min) * Math.random() + min
}

function randomRangeInt(min, max) {
  return Math.floor(randomRange(min, max + 1))
}

function random() {
  // var spec = renderFixedParams(
  //   params.baseFreq,
  //   9,
  //   randomRange(rnd, -40, 40),
  //   2,
  //   36, // 固定
  //   68, // 固定
  //   89, // 固定
  //   13, // 1, 5, 6, 9, 10, 11, 12, 13
  //   randomRange(rnd, 100, 120),
  //   randomRange(rnd, 16, 20),
  //   randomRangeInt(rnd, 7, 15),
  //   true,
  //   randomRange(rnd, 90, 130),
  //   randomRange(rnd, 50, 100)//78
  // )
  if (pullDownMenuRandomType.value === "Choir") {
    var filtTypes = [1, 5, 6, 9, 10, 11, 12, 13]

    // inputBaseFunction.value = 9
    inputBaseFunctionP1.value = randomRange(-0.32, 0.32)
    inputModType.value = 2
    inputModP1.value = 0.28346456692913385
    inputModP2.value = 0.5354330708661418
    inputModP3.value = 0.7007874015748031
    inputFiltType.value = filtTypes[Math.floor(Math.random() * filtTypes.length)]
    inputFiltCutoff.value = randomRange(0.78125, 1)
    inputFiltQ.value = randomRange(0.12, 0.16)
    inputHarmonicShift.value = randomRangeInt(7, 15)
    checkboxAdaptHarmo.value = true
    inputAdaptBaseFreq.value = randomRange(0.7, 1.2)
    inputAdaptPower.value = randomRange(0.3, 1)
  }
  else if (pullDownMenuRandomType.value === "Seed") {
    inputSeed.random()
  }
  else {
    // "All" case.
    inputBaseFreq.random()
    inputBandWidth.random()
    inputSeed.random()
  }
  refresh()
}


//-- UI.

var audioContext = new AudioContext()
var renderParameters = new RenderParameters(audioContext, 16)

var wave = new Wave(2)
var workers = []
for (var ch = 0; ch < wave.channels; ++ch) {
  workers.push({
    worker: new Worker("renderer.js"),
    isRunning: false,
  })
}

var divMain = new Div(document.body, "main")
var headingTitle = new Heading(divMain.element, 1, document.title)

var description = new Description(divMain.element)
description.add("基本操作", "Playボタンかキーボードのスペースキーで音が再生されます。")
description.add("", "値を変更するかRandomボタンを押すと音がレンダリングされます。")
description.add("", "Randomボタンの隣のプルダウンメニューでランダマイズの種類を選択できます。")
description.add("", "Saveボタンで気に入った音を保存できます。")
description.add("", "QuickSaveにチェックを入れると音を再生するたびに音が保存されます。")

var divWaveform = new Div(divMain.element, "waveform")
var headingWaveform = new Heading(divWaveform.element, 6, "Waveform")
var waveView = new WaveViewMulti(divWaveform.element, wave.channels)

var divControlLeft = new Div(divMain.element, "controlLeft", "controlBlock")
var divRenderControls = new Div(divControlLeft.element, "renderControls")
var headingRenderStatus = new Heading(divRenderControls.element, 4,
  "Rendering status will be displayed here.")
var buttonPlay = new Button(divRenderControls.element, "Play",
  () => play(audioContext, wave))
var buttonRandom = new Button(divRenderControls.element, "Random",
  () => random())
var pullDownMenuRandomType = new PullDownMenu(divRenderControls.element, null,
  () => { })
pullDownMenuRandomType.add("Choir")
pullDownMenuRandomType.add("Seed")
pullDownMenuRandomType.add("All")
var buttonSave = new Button(divRenderControls.element, "Save",
  () => save(wave))
var checkboxQuickSave = new Checkbox(divRenderControls.element, "QuickSave",
  false, (checked) => { })

var divMiscControls = new Div(divControlLeft.element, "MiscControls")
var headingRender = new Heading(divMiscControls.element, 6, "Render Settings")
var inputLength = new NumberInput(divMiscControls.element, "Length",
  0.8, 0.02, 4, 0.01, refresh)
var pullDownMenuChannel = new PullDownMenu(divMiscControls.element, null,
  () => { refresh() })
pullDownMenuChannel.add("Phase")
pullDownMenuChannel.add("Mono")
pullDownMenuChannel.add("Stereo")
var checkboxNormalize = new Checkbox(divMiscControls.element, "Normalize",
  true, refresh)

var divPadsynthControls = new Div(divControlLeft.element, "PadsynthControls")
var headingPadsynth = new Heading(divPadsynthControls.element, 6, "PADsynth")
var inputBaseFreq = new NumberInput(divPadsynthControls.element, "BaseFreq",
  220, 1, 1000, 0.01, refresh)
var inputBandWidth = new NumberInput(divPadsynthControls.element, "BandWidth",
  50, 0.01, 200, 0.01, refresh)
var inputSeed = new NumberInput(divPadsynthControls.element, "Seed",
  0, 0, Math.floor(Number.MAX_SAFE_INTEGER / 2), 1, refresh)
var pullDownMenuPadType = new PullDownMenu(divPadsynthControls.element, null,
  () => { refresh() })
pullDownMenuPadType.add("FrequencyShiftChoir")
pullDownMenuPadType.add("AdditiveChoir")

var divWaveTableControls = new Div(divControlLeft.element, "WaveTableControls")
var headingWaveTable = new Heading(divWaveTableControls.element, 6, "Wave Table")
var inputBaseFunction = new NumberInput(divWaveTableControls.element, "BaseFunc",
  9, 0, 15, 1, refresh)
var inputBaseFunctionP1 = new NumberInput(divWaveTableControls.element, "BaseFuncP1",
  0.4, 0, 1.0, 0.0001, refresh)
var inputModType = new NumberInput(divWaveTableControls.element, "Mod.Type",
  1, 0, 3, 1, refresh)
var inputModP1 = new NumberInput(divWaveTableControls.element, "Mod.P1",
  36 / 127, 0, 1.0, 0.0001, refresh)
var inputModP2 = new NumberInput(divWaveTableControls.element, "Mod.P2",
  68 / 127, 0, 1.0, 0.0001, refresh)
var inputModP3 = new NumberInput(divWaveTableControls.element, "Mod.P3",
  89 / 127, 0, 1.0, 0.0001, refresh)
var inputFiltType = new NumberInput(divWaveTableControls.element, "Filt.Type",
  1, 0, 13, 1, refresh)
var inputFiltCutoff = new NumberInput(divWaveTableControls.element, "Filt.Cutoff",
  102 / 128, 0, 1.0, 0.0001, refresh)
var inputFiltQ = new NumberInput(divWaveTableControls.element, "Filt.Q",
  16 / 127, 0, 1.0, 0.0001, refresh)
var inputHarmonicShift = new NumberInput(divWaveTableControls.element, "Harmo.Shift",
  7, -64, 64, 1, refresh)
var checkboxAdaptHarmo = new Checkbox(divWaveTableControls.element, "Adapt.Harmo",
  true, refresh)
var inputAdaptBaseFreq = new NumberInput(divWaveTableControls.element, "Adapt.Freq",
  124 / 128, 0, 1.0, 0.0001, refresh)
var inputAdaptPower = new NumberInput(divWaveTableControls.element, "Adapt.Power",
  78 / 127, 0, 1.0, 0.0001, refresh)

refresh()

window.addEventListener("keydown", (event) => {
  if (event.keyCode === 32) {
    play(audioContext, wave)
  }
})

// If startup is succeeded, remove "unsupported" paragaraph.
document.getElementById("unsupported").outerHTML = ""
