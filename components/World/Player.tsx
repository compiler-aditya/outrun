/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { LANE_WIDTH, GameStatus } from '../../types';
import { audio } from '../System/Audio';

// Physics Constants
const GRAVITY = 50;
const JUMP_FORCE = 16; // Results in ~2.56 height (v^2 / 2g)

// Static Geometries
const ROCKY_BODY_GEO = new THREE.DodecahedronGeometry(0.5, 0); // Pentagonal/Rocky base
const LEG_SEGMENT_GEO = new THREE.BoxGeometry(0.12, 0.4, 0.12);
const JOINT_SPHERE_GEO = new THREE.SphereGeometry(0.08, 8, 8);
const FOOT_GEO = new THREE.BoxGeometry(0.18, 0.1, 0.18);
const SHADOW_GEO = new THREE.CircleGeometry(0.6, 32);

export const Player: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  
  // 5 Legs for Rocky
  const legRefs = [
      useRef<THREE.Group>(null),
      useRef<THREE.Group>(null),
      useRef<THREE.Group>(null),
      useRef<THREE.Group>(null),
      useRef<THREE.Group>(null),
  ];

  const { status, laneCount, takeDamage, hasDoubleJump, activateImmortality, isImmortalityActive } = useStore();
  
  const [lane, setLane] = React.useState(0);
  const targetX = useRef(0);
  
  // Physics State
  const isJumping = useRef(false);
  const velocityY = useRef(0);
  const jumpsPerformed = useRef(0); 
  const spinRotation = useRef(0); 

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const isInvincible = useRef(false);
  const lastDamageTime = useRef(0);
  const impactRef = useRef(0); 
  const landingRef = useRef(0); 

  // Memoized Materials
  const { rockyMaterial, rockyVestMaterial, jointMaterial, glowMaterial, shadowMaterial } = useMemo(() => {
      const isGolden = isImmortalityActive;
      
      return {
          rockyMaterial: new THREE.MeshStandardMaterial({ 
              color: isGolden ? '#ffd700' : '#6b4423', // Richer, more saturated brown
              roughness: 0.8, 
              metalness: 0.3,
              flatShading: true 
          }),
          rockyVestMaterial: new THREE.MeshStandardMaterial({
              color: isGolden ? '#fffacd' : '#2d5a27', // Forest green for the "vest" area
              roughness: 0.9,
              flatShading: true
          }),
          jointMaterial: new THREE.MeshStandardMaterial({ 
              color: isGolden ? '#fffacd' : '#1a1a1a', // Near black for contrast
              roughness: 0.4, 
              metalness: 0.9 
          }),
          glowMaterial: new THREE.MeshBasicMaterial({ 
              color: isGolden ? '#ffffff' : '#ffdd00' // Brighter neon amber
          }),
          shadowMaterial: new THREE.MeshBasicMaterial({ color: '#000000', opacity: 0.3, transparent: true })
      };
  }, [isImmortalityActive]); 

  // --- Reset State on Game Start ---
  useEffect(() => {
      if (status === GameStatus.PLAYING) {
          isJumping.current = false;
          jumpsPerformed.current = 0;
          velocityY.current = 0;
          spinRotation.current = 0;
          if (groupRef.current) groupRef.current.position.y = 0;
          if (bodyRef.current) bodyRef.current.rotation.x = 0;
      }
  }, [status]);
  
  // Safety: Clamp lane if laneCount changes (e.g. restart)
  useEffect(() => {
      const maxLane = Math.floor(laneCount / 2);
      if (Math.abs(lane) > maxLane) {
          setLane(l => Math.max(Math.min(l, maxLane), -maxLane));
      }
  }, [laneCount, lane]);

  // --- Controls (Keyboard & Touch) ---
  const triggerJump = () => {
    const maxJumps = hasDoubleJump ? 2 : 1;

    if (!isJumping.current) {
        // First Jump
        audio.playJump(false);
        isJumping.current = true;
        jumpsPerformed.current = 1;
        velocityY.current = JUMP_FORCE;
    } else if (jumpsPerformed.current < maxJumps) {
        // Double Jump (Mid-air)
        audio.playJump(true);
        jumpsPerformed.current += 1;
        velocityY.current = JUMP_FORCE; // Reset velocity upwards
        spinRotation.current = 0; // Start flip
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status !== GameStatus.PLAYING) return;
      const maxLane = Math.floor(laneCount / 2);

      if (e.key === 'ArrowLeft') setLane(l => Math.max(l - 1, -maxLane));
      else if (e.key === 'ArrowRight') setLane(l => Math.min(l + 1, maxLane));
      else if (e.key === 'ArrowUp' || e.key === 'w') triggerJump();
      else if (e.key === ' ' || e.key === 'Enter') {
          activateImmortality();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, laneCount, hasDoubleJump, activateImmortality]);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
        if (status !== GameStatus.PLAYING) return;
        const deltaX = e.changedTouches[0].clientX - touchStartX.current;
        const deltaY = e.changedTouches[0].clientY - touchStartY.current;
        const maxLane = Math.floor(laneCount / 2);

        // Swipe Detection
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
             if (deltaX > 0) setLane(l => Math.min(l + 1, maxLane));
             else setLane(l => Math.max(l - 1, -maxLane));
        } else if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY < -30) {
            triggerJump();
        } else if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
            activateImmortality();
        }
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [status, laneCount, hasDoubleJump, activateImmortality]);

  // --- Animation Loop ---
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    if (status !== GameStatus.PLAYING && status !== GameStatus.SHOP) return;

    // 1. Horizontal Position
    targetX.current = lane * LANE_WIDTH;
    groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x, 
        targetX.current, 
        delta * 15 
    );

    // 2. Physics (Jump)
    if (isJumping.current) {
        // Apply Velocity
        groupRef.current.position.y += velocityY.current * delta;
        // Apply Gravity
        velocityY.current -= GRAVITY * delta;

        // Floor Collision
        if (groupRef.current.position.y <= 0) {
            groupRef.current.position.y = 0;
            isJumping.current = false;
            jumpsPerformed.current = 0;
            velocityY.current = 0;
            landingRef.current = 1.0; // Trigger impact squash
            // Reset flip
            if (bodyRef.current) bodyRef.current.rotation.x = 0;
        }

        // Double Jump Flip
        if (jumpsPerformed.current === 2 && bodyRef.current) {
             // Rotate 360 degrees quickly
             spinRotation.current -= delta * 15;
             if (spinRotation.current < -Math.PI * 2) spinRotation.current = -Math.PI * 2;
             bodyRef.current.rotation.x = spinRotation.current;
        }
    }

    // Banking Rotation
    const xDiff = targetX.current - groupRef.current.position.x;
    groupRef.current.rotation.z = -xDiff * 0.2; 
    
    // Smooth transition for base X rotation
    const targetRotX = isJumping.current ? 0.1 : 0.05;
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, delta * 10);

    // 3. Damage Recoil & Landing Impact
    // Recoil decays over time
    impactRef.current = THREE.MathUtils.lerp(impactRef.current, 0, delta * 8);
    const hitShake = Math.sin(state.clock.elapsedTime * 60) * impactRef.current * 0.1;
    bodyRef.current.position.x = hitShake;
    bodyRef.current.rotation.z = hitShake * 0.5;
    bodyRef.current.rotation.x -= impactRef.current * 0.4; // Lean back on hit

    // Landing squash effect decays
    landingRef.current = THREE.MathUtils.lerp(landingRef.current, 0, delta * 12);
    const squash = 1.0 - landingRef.current * 0.3;
    const stretch = 1.0 + landingRef.current * 0.2;
    bodyRef.current.scale.set(stretch, squash, stretch);

    // 4. Skeletal Animation
    const time = state.clock.elapsedTime;
    const runTime = time * 15; // Rocky moves a bit slower/heavier
    const idleTime = time * 2;
    
    if (!isJumping.current) {
        if (status === GameStatus.PLAYING) {
            // Pentapedal Run Cycle
            legRefs.forEach((ref, index) => {
                if (ref.current) {
                    const phase = runTime + (index * Math.PI * 2) / 5;
                    const lift = Math.max(0, Math.sin(phase));
                    const swing = Math.cos(phase);
                    
                    // Leg lift and swing
                    ref.current.rotation.x = swing * 0.5;
                    ref.current.position.y = lift * 0.2;
                }
            });
            if (bodyRef.current) bodyRef.current.position.y = 0.5 + Math.abs(Math.sin(runTime * 2)) * 0.05;
        } else {
            // Idle Animation
            legRefs.forEach((ref, index) => {
                if (ref.current) {
                    const phase = idleTime + (index * Math.PI * 2) / 5;
                    ref.current.rotation.x = Math.sin(phase) * 0.05;
                }
            });
            if (bodyRef.current) bodyRef.current.position.y = 0.5 + Math.sin(idleTime) * 0.03;
        }
    } else {
        // Jumping Pose
        legRefs.forEach((ref) => {
            if (ref.current) {
                ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, 0.8, delta * 10);
            }
        });
        if (bodyRef.current && jumpsPerformed.current !== 2) {
             bodyRef.current.position.y = THREE.MathUtils.lerp(bodyRef.current.position.y, 0.5, delta * 10);
        }
    }

    // 5. Dynamic Shadow
    if (shadowRef.current) {
        const height = groupRef.current.position.y;
        const scale = Math.max(0.3, 1.2 - (height / 2.5) * 0.5);
        shadowRef.current.scale.set(scale, scale, scale);
        const material = shadowRef.current.material as THREE.MeshBasicMaterial;
        if (material && !Array.isArray(material)) {
            material.opacity = Math.max(0.1, 0.3 - (height / 2.5) * 0.2);
        }
    }

    // Invincibility / Immortality Effect
    const showFlicker = isInvincible.current || isImmortalityActive;
    if (showFlicker) {
        if (isInvincible.current) {
             if (Date.now() - lastDamageTime.current > 1500) {
                isInvincible.current = false;
                groupRef.current.visible = true;
             } else {
                groupRef.current.visible = Math.floor(Date.now() / 50) % 2 === 0;
             }
        } 
        if (isImmortalityActive) {
            groupRef.current.visible = true; 
        }
    } else {
        groupRef.current.visible = true;
    }
  });

  // Damage Handler
  useEffect(() => {
     const checkHit = (e: any) => {
        if (isInvincible.current || isImmortalityActive) return;
        audio.playDamage(); // Play damage sound
        takeDamage();
        isInvincible.current = true;
        impactRef.current = 1.0; // Trigger recoil
        lastDamageTime.current = Date.now();
     };
     window.addEventListener('player-hit', checkHit);
     return () => window.removeEventListener('player-hit', checkHit);
  }, [takeDamage, isImmortalityActive]);

  return (
    <group ref={groupRef}>
      <group ref={bodyRef} position={[0, 0.5, 0]}> 
        
        {/* Rocky's Pentagonal Body */}
        <group castShadow>
            {/* Primary Rocky Shell */}
            <mesh geometry={ROCKY_BODY_GEO} material={rockyMaterial} />
            
            {/* Greenish "Vest" / Top Shell Layer for detail */}
            <mesh scale={[1.05, 0.4, 1.05]} position={[0, 0.25, 0]} geometry={ROCKY_BODY_GEO} material={rockyVestMaterial} />
            
            {/* Core Glow - "Eye" proxy or thermal sensor */}
            <mesh position={[0, 0, 0.45]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.12, 0.12, 0.08, 5]} />
                <meshBasicMaterial color={isImmortalityActive ? "#ffffff" : "#ffbb00"} />
            </mesh>
            
            {/* Additional "Pores" / Glow dots for visibility */}
            <mesh position={[0.3, 0.2, 0.3]} geometry={JOINT_SPHERE_GEO} material={glowMaterial} scale={0.4} />
            <mesh position={[-0.3, 0.2, 0.3]} geometry={JOINT_SPHERE_GEO} material={glowMaterial} scale={0.4} />
        </group>

        {/* 5 Legs arranged in a pentagon */}
        {[0, 1, 2, 3, 4].map((i) => {
            const angle = (i * Math.PI * 2) / 5;
            const radius = 0.35;
            return (
                <group key={i} position={[Math.sin(angle) * radius, 0, Math.cos(angle) * radius]} rotation={[0, angle, 0]}>
                    <group ref={legRefs[i]}>
                        {/* Hip Joint */}
                        <mesh geometry={JOINT_SPHERE_GEO} material={jointMaterial} />
                        
                        {/* Upper Leg */}
                        <group position={[0, -0.2, 0]} rotation={[0.4, 0, 0]}>
                            <mesh castShadow geometry={LEG_SEGMENT_GEO} material={rockyMaterial} />
                            
                            {/* Knee Joint */}
                            <group position={[0, -0.2, 0]} rotation={[-0.8, 0, 0]}>
                                <mesh geometry={JOINT_SPHERE_GEO} material={jointMaterial} />
                                
                                {/* Lower Leg */}
                                <group position={[0, -0.2, 0]}>
                                    <mesh castShadow geometry={LEG_SEGMENT_GEO} material={rockyMaterial} />
                                    
                                    {/* Foot */}
                                    <mesh position={[0, -0.2, 0]} geometry={FOOT_GEO} material={jointMaterial} />
                                </group>
                            </group>
                        </group>
                    </group>
                </group>
            );
        })}
      </group>
      
      <mesh ref={shadowRef} position={[0, 0.02, 0]} rotation={[-Math.PI/2, 0, 0]} geometry={SHADOW_GEO} material={shadowMaterial} />
    </group>
  );
};
