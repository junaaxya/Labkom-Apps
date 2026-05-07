"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Text } from "@react-three/drei";
import type { Mesh } from "three";

type ComputerStatus = "ONLINE" | "OFFLINE" | "MAINTENANCE" | "IN_USE";

interface ComputerModelProps {
  position?: [number, number, number];
  status?: ComputerStatus;
  label?: string;
  onClick?: () => void;
}

const STATUS_COLORS: Record<ComputerStatus, string> = {
  ONLINE: "#22c55e",
  OFFLINE: "#6b7280",
  MAINTENANCE: "#f59e0b",
  IN_USE: "#3b82f6",
};

export function ComputerModel({
  position = [0, 0, 0],
  status = "OFFLINE",
  label = "PC-01",
  onClick,
}: ComputerModelProps) {
  const meshRef = useRef<Mesh>(null);
  const color = STATUS_COLORS[status];

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    if (status === "ONLINE" || status === "IN_USE") {
      meshRef.current.rotation.y += delta * 0.1;
    }
  });

  return (
    <group position={position} onClick={onClick}>
      {/* Monitor */}
      <RoundedBox ref={meshRef} args={[1.2, 0.9, 0.08]} radius={0.03}>
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.4} />
      </RoundedBox>

      {/* Screen */}
      <RoundedBox args={[1.0, 0.7, 0.01]} position={[0, 0, 0.05]} radius={0.02}>
        <meshStandardMaterial
          color={status === "OFFLINE" ? "#1f2937" : "#0f172a"}
          emissive={status === "OFFLINE" ? "#000000" : color}
          emissiveIntensity={status === "OFFLINE" ? 0 : 0.3}
        />
      </RoundedBox>

      {/* Stand */}
      <RoundedBox args={[0.15, 0.4, 0.08]} position={[0, -0.65, 0]} radius={0.02}>
        <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.3} />
      </RoundedBox>

      {/* Base */}
      <RoundedBox args={[0.6, 0.05, 0.3]} position={[0, -0.85, 0]} radius={0.02}>
        <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.3} />
      </RoundedBox>

      {/* Label */}
      <Text
        position={[0, -1.1, 0]}
        fontSize={0.15}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}
