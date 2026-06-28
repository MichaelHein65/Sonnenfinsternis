import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { geoEquirectangular, geoPath } from 'd3-geo'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { feature } from 'topojson-client'
import countries from 'world-atlas/countries-110m.json'
import type { EclipseEvent, ShadowPoint, VisibilityPoint } from './astronomy'
import { logDiagnostic } from './diagnostics'

interface GlobeProps {
  event: EclipseEvent
  path: ShadowPoint[]
  currentPoint: ShadowPoint | null
  visibilityPoints: VisibilityPoint[]
  focusPoints: VisibilityPoint[]
  observerLatitude: number
  observerLongitude: number
  tooltip: string
  recoveryLabel: string
  retryLabel: string
}

type GlobeObjects = {
  pathLine: THREE.Line
  marker: THREE.Mesh
  pulse: THREE.Mesh
  visibilityCloud: THREE.Points
  focus: THREE.Group
  observerMarker: THREE.Mesh
  observerHalo: THREE.Mesh
}

function vectorForCoordinate(latitude: number, longitude: number, radius = 2): THREE.Vector3 {
  const lat = THREE.MathUtils.degToRad(latitude)
  const lon = THREE.MathUtils.degToRad(longitude)
  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon),
  )
}

function createEarthTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 1024
  const context = canvas.getContext('2d')!
  const ocean = context.createLinearGradient(0, 0, 0, canvas.height)
  ocean.addColorStop(0, '#132f43')
  ocean.addColorStop(0.5, '#092336')
  ocean.addColorStop(1, '#071722')
  context.fillStyle = ocean
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.strokeStyle = 'rgba(143, 207, 220, .12)'
  context.lineWidth = 1
  for (let longitude = -180; longitude <= 180; longitude += 15) {
    const x = ((longitude + 180) / 360) * canvas.width
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke()
  }
  for (let latitude = -75; latitude <= 75; latitude += 15) {
    const y = ((90 - latitude) / 180) * canvas.height
    context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke()
  }

  const topology = countries as unknown as { objects: { countries: never } }
  const collection = feature(countries as never, topology.objects.countries) as unknown as GeoJSON.FeatureCollection
  const projection = geoEquirectangular()
    .translate([canvas.width / 2, canvas.height / 2])
    .scale(canvas.width / (2 * Math.PI))
  const drawGeography = geoPath(projection, context)
  context.fillStyle = '#526d64'
  context.strokeStyle = '#90a995'
  context.lineWidth = 1.15
  context.beginPath()
  drawGeography(collection)
  context.fill()
  context.stroke()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

export function Globe({ event, path, currentPoint, visibilityPoints, focusPoints, observerLatitude, observerLongitude, tooltip, recoveryLabel, retryLabel }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const objectsRef = useRef<GlobeObjects | null>(null)
  const retryCountRef = useRef(0)
  const [rendererGeneration, setRendererGeneration] = useState(0)
  const [rendererStatus, setRendererStatus] = useState<'ready' | 'recovering' | 'failed'>('ready')

  const recoverPageOnce = (reason: string) => {
    const recoveryKey = 'umbra-webgl-page-recovery'
    if (sessionStorage.getItem(recoveryKey) === 'attempted') {
      setRendererStatus('failed')
      logDiagnostic('webgl-page-recovery-exhausted', { reason })
      return
    }
    sessionStorage.setItem(recoveryKey, 'attempted')
    setRendererStatus('recovering')
    logDiagnostic('webgl-page-recovery', { reason })
    window.setTimeout(() => window.location.reload(), 900)
  }

  useEffect(() => {
    const container = containerRef.current!
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.set(0, 0.45, 6.3)
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch (error) {
      const attempt = retryCountRef.current + 1
      retryCountRef.current = attempt
      logDiagnostic('webgl-initialization-failed', { message: String(error), generation: rendererGeneration, attempt })
      if (attempt <= 3) {
        setRendererStatus('recovering')
        window.setTimeout(() => setRendererGeneration((value) => value + 1), 800)
      } else recoverPageOnce('initialization')
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)
    setRendererStatus('ready')

    let restartTimer: number | undefined
    let stableTimer = window.setTimeout(() => {
      retryCountRef.current = 0
      sessionStorage.removeItem('umbra-webgl-page-recovery')
    }, 10_000)
    const handleContextLost = (event: Event) => {
      event.preventDefault()
      window.clearTimeout(stableTimer)
      const attempt = retryCountRef.current + 1
      retryCountRef.current = attempt
      logDiagnostic('webgl-context-lost', { attempt, generation: rendererGeneration })
      if (attempt > 3) {
        recoverPageOnce('context-lost')
        return
      }
      setRendererStatus('recovering')
      restartTimer = window.setTimeout(() => setRendererGeneration((value) => value + 1), 800)
    }
    const handleContextRestored = () => {
      if (restartTimer) window.clearTimeout(restartTimer)
      restartTimer = undefined
      retryCountRef.current = 0
      setRendererStatus('ready')
      logDiagnostic('webgl-context-restored', { generation: rendererGeneration })
      stableTimer = window.setTimeout(() => {
        retryCountRef.current = 0
        sessionStorage.removeItem('umbra-webgl-page-recovery')
      }, 10_000)
    }
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost)
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored)

    const focus = new THREE.Group()
    scene.add(focus)
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(2, 96, 64),
      new THREE.MeshPhongMaterial({ map: createEarthTexture(), shininess: 14, specular: new THREE.Color('#264f62') }),
    )
    focus.add(earth)

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(2.06, 64, 48),
      new THREE.MeshBasicMaterial({ color: '#61c8ee', transparent: true, opacity: 0.1, side: THREE.BackSide }),
    )
    focus.add(atmosphere)

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(2.13, 64, 48),
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        vertexShader: `varying vec3 vNormal; void main(){ vNormal=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `varying vec3 vNormal; void main(){ float a=pow(0.68-dot(vNormal,vec3(0,0,1)),3.0); gl_FragColor=vec4(0.16,0.63,0.92,a*.42); }`,
      }),
    )
    focus.add(glow)

    const ambient = new THREE.AmbientLight('#abc7dc', 1.05)
    const sunlight = new THREE.DirectionalLight('#fff2c7', 2.7)
    sunlight.position.set(-3, 2.5, 5)
    scene.add(ambient, sunlight)

    const starGeometry = new THREE.BufferGeometry()
    const positions = new Float32Array(900 * 3)
    for (let i = 0; i < positions.length; i += 3) {
      const radius = 18 + Math.random() * 30
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i + 1] = radius * Math.cos(phi)
      positions[i + 2] = radius * Math.sin(phi) * Math.sin(theta)
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: '#d9e8ff', size: 0.025, transparent: true, opacity: 0.55 })))

    const pathLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffb95a', transparent: true, opacity: 0.9 }))
    focus.add(pathLine)
    const visibilityCloud = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({ size: 0.075, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending }),
    )
    focus.add(visibilityCloud)
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 20), new THREE.MeshBasicMaterial({ color: '#fff4d4' }))
    const pulse = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.105, 48), new THREE.MeshBasicMaterial({ color: '#ffb04a', transparent: true, opacity: 0.85, side: THREE.DoubleSide }))
    const observerMarker = new THREE.Mesh(new THREE.SphereGeometry(0.032, 18, 18), new THREE.MeshBasicMaterial({ color: '#83ddc8', depthTest: true }))
    const observerHalo = new THREE.Mesh(
      new THREE.RingGeometry(0.048, 0.064, 32),
      new THREE.MeshBasicMaterial({ color: '#b8f3df', transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }),
    )
    focus.add(marker, pulse, observerMarker, observerHalo)
    objectsRef.current = { pathLine, marker, pulse, visibilityCloud, focus, observerMarker, observerHalo }

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = 4.1
    controls.maxDistance = 9
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.18

    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      renderer.setSize(width, height)
      camera.aspect = width / Math.max(height, 1)
      camera.updateProjectionMatrix()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    let frame = 0
    let lastRender = 0
    const animate = (timestamp: number) => {
      frame = requestAnimationFrame(animate)
      if (document.hidden || timestamp - lastRender < 1000 / 30) return
      lastRender = timestamp
      controls.update()
      if (objectsRef.current?.pulse.visible) {
        const scale = 1 + 0.15 * Math.sin(performance.now() / 260)
        objectsRef.current.pulse.scale.setScalar(scale)
        objectsRef.current.pulse.lookAt(camera.position)
      }
      renderer.render(scene, camera)
    }
    frame = requestAnimationFrame(animate)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(restartTimer)
      window.clearTimeout(stableTimer)
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost)
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored)
      observer.disconnect(); controls.dispose(); renderer.dispose()
      objectsRef.current = null
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  }, [rendererGeneration])

  useEffect(() => {
    const objects = objectsRef.current
    if (!objects) return
    objects.pathLine.geometry.dispose()
    objects.pathLine.geometry = new THREE.BufferGeometry().setFromPoints(path.map((point) => vectorForCoordinate(point.latitude, point.longitude, 2.018)))
    let focusLatitude = event.latitude
    let focusLongitude = event.longitude
    if ((focusLatitude == null || focusLongitude == null) && focusPoints.length > 0) {
      const center = new THREE.Vector3()
      for (const point of focusPoints) center.add(vectorForCoordinate(point.latitude, point.longitude, 1).normalize())
      center.normalize()
      focusLatitude = THREE.MathUtils.radToDeg(Math.asin(center.y))
      focusLongitude = THREE.MathUtils.radToDeg(Math.atan2(-center.z, center.x))
    }
    if (focusLatitude != null && focusLongitude != null) {
      objects.focus.rotation.y = THREE.MathUtils.degToRad(-90 - focusLongitude)
      objects.focus.rotation.x = THREE.MathUtils.degToRad(-focusLatitude * 0.18)
    }
  }, [event, path, focusPoints, rendererGeneration])

  useEffect(() => {
    const objects = objectsRef.current
    if (!objects) return
    const positions: number[] = []
    const colors: number[] = []
    const edgeColor = new THREE.Color('#b98236')
    const centerColor = new THREE.Color('#ffe1a0')
    for (const point of visibilityPoints) {
      const position = vectorForCoordinate(point.latitude, point.longitude, 2.028)
      positions.push(position.x, position.y, position.z)
      const color = edgeColor.clone().lerp(centerColor, Math.min(1, point.intensity * 1.8))
      colors.push(color.r, color.g, color.b)
    }
    objects.visibilityCloud.geometry.dispose()
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    objects.visibilityCloud.geometry = geometry
  }, [visibilityPoints, rendererGeneration])

  useEffect(() => {
    const objects = objectsRef.current
    if (!objects) return
    const visible = currentPoint != null
    objects.marker.visible = visible
    objects.pulse.visible = visible
    if (currentPoint) {
      const position = vectorForCoordinate(currentPoint.latitude, currentPoint.longitude, 2.04)
      objects.marker.position.copy(position)
      objects.pulse.position.copy(position.clone().multiplyScalar(1.002))
      objects.pulse.lookAt(new THREE.Vector3(0, 0, 0))
    }
  }, [currentPoint, rendererGeneration])

  useEffect(() => {
    const objects = objectsRef.current
    if (!objects) return
    const position = vectorForCoordinate(observerLatitude, observerLongitude, 2.045)
    objects.observerMarker.position.copy(position)
    objects.observerHalo.position.copy(position.clone().multiplyScalar(1.001))
    objects.observerHalo.lookAt(new THREE.Vector3(0, 0, 0))
  }, [observerLatitude, observerLongitude, rendererGeneration])

  const retryRenderer = () => {
    retryCountRef.current = 0
    setRendererStatus('recovering')
    setRendererGeneration((value) => value + 1)
    logDiagnostic('webgl-manual-retry')
  }

  return (
    <div className={`globe has-tooltip renderer-${rendererStatus}`} ref={containerRef} data-tooltip={tooltip} aria-label={tooltip}>
      {rendererStatus !== 'ready' && (
        <div className="globe-recovery" role="status">
          <span>{recoveryLabel}</span>
          {rendererStatus === 'failed' && <button type="button" onClick={retryRenderer}>{retryLabel}</button>}
        </div>
      )}
    </div>
  )
}
