"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, PerspectiveCamera } from "@react-three/drei";
import { ComputerModel } from "./computer-model";

type ComputerStatus = "ONLINE" | "OFFLINE" | "MAINTENANCE" | "IN_USE";

interface LabComputer {
  id: string;
  name: string;
  status: ComputerStatus;
  position: [number, number, number];
}

interface LabSceneProps {
  computers?: LabComputer[];
  onComputerClick?: (id: string) => void;
}

const DEMO_COMPUTERS: LabComputer[] = [
  { id: "1", name: "PC-01", status: "ONLINE", position: [-3, 0, 0] },
  { id: "2", name: "PC-02", status: "IN_USE", position: [-1.5, 0, 0] },
  { id: "3", name: "PC-03", status: "OFFLINE", position: [0, 0, 0] },
  { id: "4", name: "PC-04", status: "MAINTENANCE", position: [1.5, 0, 0] },
  { id: "5", name: "PC-05", status: "ONLINE", position: [3, 0, 0] },
];

export function LabScene({ computers = DEMO_COMPUTERS, onComputerClick }: LabSceneProps) {
  return (
    <div className="w-full h-[400px] rounded-xl overflow-hidden border border-slate-200 bg-slate-950">
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 1, 6]} fov={50} />
        <OrbitControls
          enablePan={false}
          maxPolarAngle={Math.PI / 2}
          minDistance={3}
          maxDistance={10}
        />

        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <pointLight position={[-3, 3, 3]} intensity={0.5} color="#60a5fa" />

        <Environment preset="city" />

        {computers.map((pc) => (
          <ComputerModel
            key={pc.id}
            position={pc.position}
            status={pc.status}
            label={pc.name}
            onClick={() => onComputerClick?.(pc.id)}
          />
        ))}

        {/* Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
          <planeGeometry args={[12, 6]} />
          <meshStandardMaterial color="#1e293b" metalness={0.1} roughness={0.8} />
        </mesh>
      </Canvas>
    </div>
  );
}
