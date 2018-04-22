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

function makeWave() {
  headingRenderStatus.element.textContent = "⚠ Rendering ⚠"
  for (var ch = 0; ch < wave.channels; ++ch) {
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
    })
  }

  workers.forEach((value, index) => {
    value.worker.onmessage = (event) => {
      wave.data[index] = event.data
      workers[index].isRunning = false
      if (workers.every((v) => !v.isRunning)) {
        if (checkboxNormalize.value) {
          wave.normalize()
        }
        waveView.set(wave)

        if (checkboxQuickSave.value) {
          save(wave)
        }

        headingRenderStatus.element.textContent = "Rendering finished. ✓"
      }
    }
  })
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

function random() {
  if (pullDownMenuRandomType.value === "Seed") {
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
    isRunning: true,
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
// var pullDownMenuChannel = new PullDownMenu(divRenderControls.element, null,
//   () => { })
// pullDownMenuChannel.add("Mono")
// pullDownMenuChannel.add("Stereo")
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

refresh()

window.addEventListener("keydown", (event) => {
  if (event.keyCode === 32) {
    play(audioContext, wave)
  }
})

// If startup is succeeded, remove "unsupported" paragaraph.
document.getElementById("unsupported").outerHTML = ""
