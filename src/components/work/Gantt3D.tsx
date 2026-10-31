"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { layoutGantt3D, type BarInput } from "@/domain/viz/ganttBars";

// 공정 진행 3D 보기 (SR-VZ-01): 이미 계산된 일정·보할을 막대로 보여 주기만 한다. 값을 바꾸거나 서류 출력에 쓰이지 않는다.
// Three.js는 이 화면을 열 때만 불러온다. 가로=일차, 세로=보할, 앞뒤=공정 순서. 끌어서 돌리고 굴려서 확대한다.

const COLORS = { normal: 0xc2410c, outside: 0xb91c1c, negative: 0x475569, coop: 0x94a3b8, floor: 0xe5e7eb, grid: 0xcbd5e1 };
const HEIGHT_PX = 380;
const WORLD_WIDTH = 24; // 가로 전체 길이(세계 단위)
const ROW_GAP = 1.4;
const BAR_DEPTH = 0.9;
const HEIGHT_SCALE = 0.5; // 최대 높이 10 → 5

type Tip = { text: string; x: number; y: number } | null;

export function Gantt3D({ processes, durationDays }: { processes: BarInput[]; durationDays: number }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [tip, setTip] = useState<Tip>(null);
  const layout = useMemo(() => layoutGantt3D(processes, durationDays), [processes, durationDays]);

  useEffect(() => {
    const el = host.current;
    if (!el || layout.bars.length === 0) return;
    let disposed = false;
    let cleanup: () => void = () => {};

    (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");
      if (disposed) return;

      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        setError("이 브라우저에서는 3D 보기를 사용할 수 없습니다. 위의 표로 확인하세요.");
        return;
      }
      const w = () => el.clientWidth || 640;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w(), HEIGHT_PX);
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, w() / HEIGHT_PX, 0.1, 200);
      const k = WORLD_WIDTH / layout.totalDays;
      const depth = layout.rows * ROW_GAP;
      camera.position.set(WORLD_WIDTH * 0.55, 14, depth + 16);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(WORLD_WIDTH / 2, 1.5, depth / 2);
      controls.update();

      scene.add(new THREE.AmbientLight(0xffffff, 1.6));
      const sun = new THREE.DirectionalLight(0xffffff, 1.4);
      sun.position.set(-10, 20, 12);
      scene.add(sun);

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(WORLD_WIDTH + 2, depth + 2),
        new THREE.MeshBasicMaterial({ color: COLORS.floor, side: THREE.DoubleSide }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(WORLD_WIDTH / 2, -0.01, depth / 2 - ROW_GAP / 2);
      scene.add(floor);
      const grid = new THREE.GridHelper(Math.max(WORLD_WIDTH, depth) + 2, 20, COLORS.grid, COLORS.grid);
      grid.position.set(WORLD_WIDTH / 2, 0, depth / 2 - ROW_GAP / 2);
      scene.add(grid);

      const meshes: InstanceType<typeof THREE.Mesh>[] = [];
      for (const b of layout.bars) {
        const widthW = Math.max((b.x1 - b.x0) * k, 0.05);
        const h = b.height * HEIGHT_SCALE;
        const color = b.outside ? COLORS.outside : b.negative ? COLORS.negative : b.coop ? COLORS.coop : COLORS.normal;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(widthW, h, BAR_DEPTH), new THREE.MeshStandardMaterial({ color }));
        mesh.position.set(b.x0 * k + widthW / 2, h / 2, b.row * ROW_GAP);
        mesh.userData = {
          text: `${b.name} · ${b.x0 + 1}~${b.x1}일차 · 보할 ${b.weight.toFixed(2)}%${b.negative ? " (음수)" : ""}${b.coop ? " (협조)" : ""}${b.outside ? " · 공기 밖" : ""}`,
        };
        scene.add(mesh);
        meshes.push(mesh);
      }

      const render = () => renderer.render(scene, camera);
      controls.addEventListener("change", render);
      render();

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const onMove = (e: PointerEvent) => {
        const r = renderer.domElement.getBoundingClientRect();
        pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(meshes)[0];
        setTip(hit ? { text: String(hit.object.userData.text), x: e.clientX - r.left, y: e.clientY - r.top } : null);
      };
      const onLeave = () => setTip(null);
      renderer.domElement.addEventListener("pointermove", onMove);
      renderer.domElement.addEventListener("pointerleave", onLeave);

      const ro = new ResizeObserver(() => {
        renderer.setSize(w(), HEIGHT_PX);
        camera.aspect = w() / HEIGHT_PX;
        camera.updateProjectionMatrix();
        render();
      });
      ro.observe(el);

      cleanup = () => {
        ro.disconnect();
        renderer.domElement.removeEventListener("pointermove", onMove);
        renderer.domElement.removeEventListener("pointerleave", onLeave);
        controls.removeEventListener("change", render);
        controls.dispose();
        for (const m of meshes) {
          m.geometry.dispose();
          (m.material as InstanceType<typeof THREE.Material>).dispose();
        }
        floor.geometry.dispose();
        (floor.material as InstanceType<typeof THREE.Material>).dispose();
        grid.geometry.dispose();
        (grid.material as InstanceType<typeof THREE.Material>).dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })().catch(() => setError("3D 보기를 불러오지 못했습니다. 위의 표로 확인하세요."));

    return () => {
      disposed = true;
      cleanup();
    };
  }, [layout]);

  if (layout.bars.length === 0) return <p className="mt-2 text-[13px] text-text-secondary">표시할 공정이 없습니다.</p>;
  if (error) return <p role="alert" className="mt-2 rounded-sm bg-danger-soft p-2 text-[13px]">{error}</p>;

  return (
    <div className="mt-2">
      <div
        ref={host}
        role="img"
        aria-label={`공정 ${layout.rows}개의 일정과 보할을 막대로 보여 주는 3D 그림. 같은 내용이 위의 표에 있습니다.`}
        className="relative w-full overflow-hidden rounded-sm border border-border bg-surface-alt"
        style={{ height: HEIGHT_PX }}
      >
        {tip && (
          <div className="pointer-events-none absolute z-10 rounded-sm bg-surface px-2 py-1 text-[12px] shadow" style={{ left: tip.x + 12, top: tip.y + 12 }}>
            {tip.text}
          </div>
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-3 text-[12px] text-text-secondary">
        <li><span className="mr-1 inline-block size-3 rounded-sm align-middle" style={{ background: "#c2410c" }} />공정</li>
        <li><span className="mr-1 inline-block size-3 rounded-sm align-middle" style={{ background: "#b91c1c" }} />공기 밖</li>
        <li><span className="mr-1 inline-block size-3 rounded-sm align-middle" style={{ background: "#475569" }} />음수 보할</li>
        <li><span className="mr-1 inline-block size-3 rounded-sm align-middle" style={{ background: "#94a3b8" }} />협조(보할 0)</li>
        <li>가로 = 일차(1~{layout.totalDays}), 세로 = 보할, 앞→뒤 = 공정 순서. 끌어서 돌리고 굴려서 확대합니다.</li>
      </ul>
    </div>
  );
}
