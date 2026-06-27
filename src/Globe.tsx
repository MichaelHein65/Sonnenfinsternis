import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { geoEquirectangular, geoPath } from 'd3-geo'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { feature } from 'topojson-client'
import countries from 'world-atlas/countries-110m.json'
import type { EclipseEvent, ShadowPoint } from './astronomy'

interface GlobeProps {
  event: EclipseEvent
  path: ShadowPoint[]
  currentPoint: ShadowPoint | null
  tooltip: string
}

type GlobeObjects = {
  pathLine: THREE.Line
  marker: THREE.Mesh
  pulse: THREE.Mesh
  focus: THREE.Group
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

export function Globe({ event, path, currentPoint, tooltip }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const objectsRef = useRef<GlobeObjects | null>(null)

  useEffect(() => {
    const container = containerRef.current!
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.set(0, 0.45, 6.3)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)

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
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 20), new THREE.MeshBasicMaterial({ color: '#fff4d4' }))
    const pulse = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.105, 48), new THREE.MeshBasicMaterial({ color: '#ffb04a', transparent: true, opacity: 0.85, side: THREE.DoubleSide }))
    focus.add(marker, pulse)
    objectsRef.current = { pathLine, marker, pulse, focus }

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
    const animate = () => {
      frame = requestAnimationFrame(animate)
      controls.update()
      if (objectsRef.current?.pulse.visible) {
        const scale = 1 + 0.15 * Math.sin(performance.now() / 260)
        objectsRef.current.pulse.scale.setScalar(scale)
        objectsRef.current.pulse.lookAt(camera.position)
      }
      renderer.render(scene, camera)
    }
    animate()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect(); controls.dispose(); renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [])

  useEffect(() => {
    const objects = objectsRef.current
    if (!objects) return
    objects.pathLine.geometry.dispose()
    objects.pathLine.geometry = new THREE.BufferGeometry().setFromPoints(path.map((point) => vectorForCoordinate(point.latitude, point.longitude, 2.018)))
    if (event.latitude != null && event.longitude != null) {
      objects.focus.rotation.y = THREE.MathUtils.degToRad(event.longitude)
      objects.focus.rotation.x = THREE.MathUtils.degToRad(-event.latitude * 0.18)
    }
  }, [event, path])

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
  }, [currentPoint])

  return <div className="globe has-tooltip" ref={containerRef} data-tooltip={tooltip} aria-label={tooltip} />
}
