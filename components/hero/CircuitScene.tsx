'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// The WebGL hero scene: the next race's real racing line (a 2025 fastest
// lap from telemetry) as a glowing red loop drifting in black space.
// Loaded only via dynamic import from HeroCanvas after the capability
// gate passes — this module (and three.js) never enters the main bundle.
//
// Glow is layered tubes (core + two transparent shells), no
// postprocessing: at one curve + a dot, bloom would burn a full-screen
// pass for something the layers already sell at 60fps.
//
// The moving light is the lap itself: a point tracing the line at
// real-lap pace (time-scaled), with a soft additive halo. Subtle —
// a beacon, not a toy car.

export default function CircuitScene({
  lineUrl,
  onLive,
  onFail,
}: {
  lineUrl: string
  onLive?: (live: boolean) => void
  onFail: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const onLiveRef = useRef(onLive)
  onLiveRef.current = onLive
  const onFailRef = useRef(onFail)
  onFailRef.current = onFail

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let renderer: THREE.WebGLRenderer | null = null
    const disposables: { dispose: () => void }[] = []

    const fail = () => {
      if (!disposed) {
        onLiveRef.current?.(false)
        onFailRef.current()
      }
    }

    ;(async () => {
      let data: { points: [number, number][]; source?: { lapDuration?: number } }
      try {
        const res = await fetch(lineUrl)
        if (!res.ok) return fail()
        data = await res.json()
        if (!data.points || data.points.length < 100) return fail()
      } catch {
        return fail()
      }
      if (disposed) return

      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
      } catch {
        return fail()
      }
      const W = () => host.clientWidth
      const H = () => host.clientHeight
      renderer.setSize(W(), H())
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.domElement.style.cssText =
        'position:absolute;inset:0;opacity:0;transition:opacity 1.6s ease 0.2s;'
      host.appendChild(renderer.domElement)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(38, W() / H(), 0.1, 100)

      const group = new THREE.Group()
      scene.add(group)
      const RED = new THREE.Color('#E10600')

      // ── the racing line ──
      const pts = data.points.map(([x, y]) => new THREE.Vector3(x * 1.9, 0, -y * 1.9))
      const curve = new THREE.CatmullRomCurve3(pts, true)
      const layers: [number, number][] = [
        [0.008, 1.0],
        [0.022, 0.16],
        [0.05, 0.055],
      ]
      for (const [radius, opacity] of layers) {
        const geo = new THREE.TubeGeometry(curve, 720, radius, 8, true)
        const mat = new THREE.MeshBasicMaterial({
          color: RED,
          transparent: opacity < 1,
          opacity,
          depthWrite: opacity === 1,
        })
        disposables.push(geo, mat)
        group.add(new THREE.Mesh(geo, mat))
      }

      // ── the lap beacon: hot core + additive halo sprite ──
      const beacon = new THREE.Group()
      const coreGeo = new THREE.SphereGeometry(0.016, 12, 12)
      const coreMat = new THREE.MeshBasicMaterial({ color: 0xfff1ee })
      disposables.push(coreGeo, coreMat)
      beacon.add(new THREE.Mesh(coreGeo, coreMat))
      const haloCanvas = document.createElement('canvas')
      haloCanvas.width = haloCanvas.height = 64
      const g = haloCanvas.getContext('2d')!
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
      grad.addColorStop(0, 'rgba(225,6,0,0.9)')
      grad.addColorStop(0.4, 'rgba(225,6,0,0.28)')
      grad.addColorStop(1, 'rgba(225,6,0,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, 64, 64)
      const haloTex = new THREE.CanvasTexture(haloCanvas)
      const haloMat = new THREE.SpriteMaterial({
        map: haloTex,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      })
      disposables.push(haloTex, haloMat)
      const halo = new THREE.Sprite(haloMat)
      halo.scale.setScalar(0.34)
      beacon.add(halo)
      group.add(beacon)

      // a nice initial angle before the drift takes over
      group.rotation.y = -0.55

      // ── motion ──
      // ~90-110s real laps compressed to a calm on-screen lap
      const LAP_MS = 26000
      const mouse = { x: 0, y: 0, tx: 0, ty: 0 }
      const onMouse = (e: MouseEvent) => {
        mouse.tx = e.clientX / window.innerWidth - 0.5
        mouse.ty = e.clientY / window.innerHeight - 0.5
      }
      window.addEventListener('mousemove', onMouse, { passive: true })

      const onResize = () => {
        if (!renderer) return
        camera.aspect = W() / H()
        camera.updateProjectionMatrix()
        renderer.setSize(W(), H())
      }
      window.addEventListener('resize', onResize)

      // fps watchdog: if the first observed seconds can't hold ~40fps,
      // tear down and let the static section stand alone.
      let frames = 0
      let watchStart = 0
      let watching = true
      let revealed = false

      renderer.setAnimationLoop((t) => {
        if (!renderer) return
        if (!revealed) {
          revealed = true
          renderer.domElement.style.opacity = '1'
          onLiveRef.current?.(true)
        }
        // slow rotation + camera drift
        group.rotation.y = -0.55 + t * 0.000045
        mouse.x += (mouse.tx - mouse.x) * 0.045
        mouse.y += (mouse.ty - mouse.y) * 0.045
        camera.position.set(
          Math.sin(t * 0.00005) * 0.3 + mouse.x * 0.55,
          1.22 + Math.sin(t * 0.000038) * 0.07 - mouse.y * 0.22,
          4.1
        )
        camera.lookAt(0, 0, 0)
        // lap beacon along the real line, gentle pulse
        const u = (t % LAP_MS) / LAP_MS
        const p = curve.getPointAt(u)
        beacon.position.copy(p)
        halo.scale.setScalar(0.3 + Math.sin(t * 0.004) * 0.05)
        renderer.render(scene, camera)

        frames++
        if (watching) {
          if (!watchStart) watchStart = t
          const el = t - watchStart
          if (el > 2500) {
            watching = false
            if (frames / (el / 1000) < 40) {
              fail()
            }
          }
        }
      })
    })()

    return () => {
      disposed = true
      onLiveRef.current?.(false)
      if (renderer) {
        renderer.setAnimationLoop(null)
        renderer.dispose()
        renderer.domElement.remove()
        renderer = null
      }
      for (const d of disposables) d.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineUrl])

  return <div ref={hostRef} aria-hidden className="pointer-events-none absolute inset-0" />
}
