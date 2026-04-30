/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text3D, Center, Float } from '@react-three/drei';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../../store';
import { GameObject, ObjectType, ObstacleVariant, LANE_WIDTH, SPAWN_DISTANCE, REMOVE_DISTANCE, GameStatus, GEMINI_COLORS } from '../../types';
import { audio } from '../System/Audio';

// Geometry Constants
const OBSTACLE_HEIGHT = 1.6;
const OBSTACLE_GEOMETRY = new THREE.ConeGeometry(0.9, OBSTACLE_HEIGHT, 6);
const OBSTACLE_GLOW_GEO = new THREE.ConeGeometry(0.9, OBSTACLE_HEIGHT, 6);
const OBSTACLE_RING_GEO = new THREE.RingGeometry(0.6, 0.9, 6);

const BLOCKER_GEO = new THREE.BoxGeometry(LANE_WIDTH * 0.8, 4.0, 0.4);
const MINE_CORE_GEO = new THREE.IcosahedronGeometry(0.5, 1);
const MINE_SPYKE_GEO = new THREE.ConeGeometry(0.1, 0.6, 4);
const WIDE_WALL_GEO = new THREE.BoxGeometry(LANE_WIDTH * 2, 1.2, 0.4);

const GEM_GEOMETRY = new THREE.IcosahedronGeometry(0.3, 0);

// Alien Geometries
const ALIEN_BODY_GEO = new THREE.CylinderGeometry(0.6, 0.3, 0.3, 8);
const ALIEN_DOME_GEO = new THREE.SphereGeometry(0.4, 16, 16, 0, Math.PI * 2, 0, Math.PI/2);
const ALIEN_EYE_GEO = new THREE.SphereGeometry(0.1);

// Missile Geometries
const MISSILE_CORE_GEO = new THREE.CylinderGeometry(0.08, 0.08, 3.0, 8);
const MISSILE_RING_GEO = new THREE.TorusGeometry(0.15, 0.02, 16, 32);

// Shadow Geometries
const SHADOW_LETTER_GEO = new THREE.PlaneGeometry(2, 0.6);
const SHADOW_GEM_GEO = new THREE.CircleGeometry(0.6, 32);
const SHADOW_ALIEN_GEO = new THREE.CircleGeometry(0.8, 32);
const SHADOW_MISSILE_GEO = new THREE.PlaneGeometry(0.15, 3);
const SHADOW_BLOCKER_GEO = new THREE.PlaneGeometry(LANE_WIDTH * 0.8, 0.4);
const SHADOW_MINE_GEO = new THREE.CircleGeometry(0.6, 16);
const SHADOW_WIDE_WALL_GEO = new THREE.PlaneGeometry(LANE_WIDTH * 2, 0.4);
const SHADOW_DEFAULT_GEO = new THREE.CircleGeometry(0.8, 6);

// Shop Geometries
const SHOP_FRAME_GEO = new THREE.BoxGeometry(1, 7, 1); // Will be scaled
const SHOP_BACK_GEO = new THREE.BoxGeometry(1, 5, 1.2); // Will be scaled
const SHOP_OUTLINE_GEO = new THREE.BoxGeometry(1, 7.2, 0.8); // Will be scaled
const SHOP_FLOOR_GEO = new THREE.PlaneGeometry(1, 4); // Will be scaled

const PARTICLE_COUNT = 600;
const BASE_LETTER_INTERVAL = 150;
const REFERENCE_WORD_LENGTH = 6; // GEMINI/OUTRUN baseline — word lengths >6 scale spawn interval down

const getLetterInterval = (level: number, wordLength: number = REFERENCE_WORD_LENGTH) => {
    // Spawn interval scales inversely with word length so a sector takes roughly
    // the same total distance regardless of whether the word has 6 or 10 letters.
    // 7-letter word at level 1 -> 128.6 distance per letter (was 150).
    // 10-letter word at level 1 -> 90.0 distance per letter.
    // Level 1: 150
    // Level 2: 225 (150 * 1.5)
    // Level 3: 337.5 (225 * 1.5)
    const lengthScale = REFERENCE_WORD_LENGTH / Math.max(1, wordLength);
    return BASE_LETTER_INTERVAL * Math.pow(1.5, Math.max(0, level - 1)) * lengthScale;
};

const MISSILE_SPEED = 30; // Extra speed added to world speed

// Font for 3D Text
const FONT_URL = "https://cdn.jsdelivr.net/npm/three/examples/fonts/helvetiker_bold.typeface.json";

// --- Particle System ---
const ParticleSystem: React.FC = () => {
    const mesh = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    
    const particles = useMemo(() => new Array(PARTICLE_COUNT).fill(0).map(() => ({
        life: 0,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        color: new THREE.Color(),
        variant: 'burst' as 'burst' | 'shimmer' | 'trail',
        twinkleOffset: Math.random() * Math.PI * 2
    })), []);

    useEffect(() => {
        const handleExplosion = (e: CustomEvent) => {
            const { position, color, type = 'burst' } = e.detail;
            let spawned = 0;
            let burstAmount = 30; 
            
            if (type === 'shimmer') burstAmount = 15;
            if (type === 'trail') burstAmount = 40;

            for(let i = 0; i < PARTICLE_COUNT; i++) {
                const p = particles[i];
                if (p.life <= 0) {
                    p.life = type === 'shimmer' ? 1.5 + Math.random() : 1.0 + Math.random() * 0.5; 
                    p.pos.set(position[0], position[1], position[2]);
                    p.variant = type;
                    
                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1);
                    
                    let speed = 2 + Math.random() * 10;
                    if (type === 'shimmer') speed = 0.5 + Math.random() * 2.5;
                    if (type === 'trail') speed = 4 + Math.random() * 12;
                    
                    p.vel.set(
                        Math.sin(phi) * Math.cos(theta),
                        Math.sin(phi) * Math.sin(theta),
                        Math.cos(phi)
                    ).multiplyScalar(speed);

                    // Add some upwards bias for trail/shimmer
                    if (type === 'trail') p.vel.y += 5;
                    if (type === 'shimmer') p.vel.y += 1;

                    p.rot.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                    p.rotVel.set(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).multiplyScalar(5);
                    
                    p.color.set(color);
                    
                    spawned++;
                    if (spawned >= burstAmount) break;
                }
            }
        };
        
        window.addEventListener('particle-burst', handleExplosion as any);
        return () => window.removeEventListener('particle-burst', handleExplosion as any);
    }, [particles]);

    useFrame((state, delta) => {
        if (!mesh.current) return;
        const safeDelta = Math.min(delta, 0.1);
        const time = state.clock.elapsedTime;

        particles.forEach((p, i) => {
            if (p.life > 0) {
                p.life -= safeDelta * (p.variant === 'shimmer' ? 0.8 : 1.5);
                p.pos.addScaledVector(p.vel, safeDelta);
                
                // Gravity
                if (p.variant === 'trail') {
                    p.vel.y -= safeDelta * 8;
                } else {
                    p.vel.y -= safeDelta * 5; 
                }
                
                p.vel.multiplyScalar(0.98);

                p.rot.x += p.rotVel.x * safeDelta;
                p.rot.y += p.rotVel.y * safeDelta;
                
                dummy.position.copy(p.pos);
                
                let scale = Math.max(0, p.life * 0.25);
                if (p.variant === 'shimmer') {
                    // Shimmering twinkle effect
                    scale *= 0.5 + Math.sin(time * 15 + p.twinkleOffset) * 0.5;
                }
                if (p.variant === 'trail') {
                    scale *= 1.2; // Trails are slightly more vibrant/large
                }
                
                dummy.scale.set(scale, scale, scale);
                
                dummy.rotation.set(p.rot.x, p.rot.y, p.rot.z);
                dummy.updateMatrix();
                
                mesh.current!.setMatrixAt(i, dummy.matrix);
                mesh.current!.setColorAt(i, p.color);
            } else {
                dummy.scale.set(0,0,0);
                dummy.updateMatrix();
                mesh.current!.setMatrixAt(i, dummy.matrix);
            }
        });
        
        mesh.current.instanceMatrix.needsUpdate = true;
        if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    });

    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, 400]}>
            <octahedronGeometry args={[0.5, 0]} />
            <meshBasicMaterial toneMapped={false} transparent opacity={0.9} />
        </instancedMesh>
    );
};


const getRandomLane = (laneCount: number) => {
    const max = Math.floor(laneCount / 2);
    return Math.floor(Math.random() * (max * 2 + 1)) - max;
};

export const LevelManager: React.FC = () => {
  const {
    status,
    speed,
    collectGem,
    collectLetter,
    collectedLetters,
    laneCount,
    setDistance,
    openShop,
    level,
    wordTarget,
  } = useStore();
  
  const objectsRef = useRef<GameObject[]>([]);
  const [renderTrigger, setRenderTrigger] = useState(0);
  const prevStatus = useRef(status);
  const prevLevel = useRef(level);

  const playerObjRef = useRef<THREE.Object3D | null>(null);
  const distanceTraveled = useRef(0);
  const nextLetterDistance = useRef(BASE_LETTER_INTERVAL);

  // Handle resets and transitions
  useEffect(() => {
    const isRestart = status === GameStatus.PLAYING && prevStatus.current === GameStatus.GAME_OVER;
    const isMenuReset = status === GameStatus.MENU;
    const isLevelUp = level !== prevLevel.current && status === GameStatus.PLAYING;
    const isVictoryReset = status === GameStatus.PLAYING && prevStatus.current === GameStatus.VICTORY;

    if (isMenuReset || isRestart || isVictoryReset) {
        // Hard Reset of objects
        objectsRef.current = [];
        setRenderTrigger(t => t + 1);
        
        // Reset trackers
        distanceTraveled.current = 0;
        nextLetterDistance.current = getLetterInterval(1, wordTarget.length);

    } else if (isLevelUp && level > 1) {
        // Soft Reset for Level Up (Keep visible objects)
        // Clear objects deep in the fog (> -80) to make room for portal, but keep visible ones
        objectsRef.current = objectsRef.current.filter(obj => obj.position[2] > -80);

        // Spawn Shop Portal further out (Twice previous distance)
        objectsRef.current.push({
            id: uuidv4(),
            type: ObjectType.SHOP_PORTAL,
            position: [0, 0, -100], 
            active: true,
        });
        
        // Adjust next letter spawn for the new level's difficulty (50% increase).
        // We calculate this relative to where the last letter was (which was approx at player position + 0, so SPAWN_DISTANCE ago).
        // This ensures the gap between the last letter of Level X and the first letter of Level X+1 is the new interval.
        nextLetterDistance.current = distanceTraveled.current - SPAWN_DISTANCE + getLetterInterval(level, wordTarget.length);
        
        setRenderTrigger(t => t + 1);
        
    } else if (status === GameStatus.GAME_OVER || status === GameStatus.VICTORY) {
        setDistance(Math.floor(distanceTraveled.current));
    }
    
    prevStatus.current = status;
    prevLevel.current = level;
  }, [status, level, setDistance]);

  useFrame((state) => {
      if (!playerObjRef.current) {
          const group = state.scene.getObjectByName('PlayerGroup');
          if (group && group.children.length > 0) {
              playerObjRef.current = group.children[0];
          }
      }
  });

  useFrame((state, delta) => {
    if (status !== GameStatus.PLAYING) return;

    const safeDelta = Math.min(delta, 0.05); 
    const dist = speed * safeDelta;
    
    distanceTraveled.current += dist;

    let hasChanges = false;
    let playerPos = new THREE.Vector3(0, 0, 0);
    
    if (playerObjRef.current) {
        playerObjRef.current.getWorldPosition(playerPos);
    }

    // 1. Move & Update
    const currentObjects = objectsRef.current;
    const keptObjects: GameObject[] = [];
    const newSpawns: GameObject[] = [];

    for (const obj of currentObjects) {
        // Standard Movement
        let moveAmount = dist;
        
        // Missile Movement (Moves faster than world)
        if (obj.type === ObjectType.MISSILE) {
            moveAmount += MISSILE_SPEED * safeDelta;
        }

        // Store previous Z for swept collision check (prevents tunneling)
        const prevZ = obj.position[2];
        obj.position[2] += moveAmount;
        
        // Alien AI Logic
        if (obj.type === ObjectType.ALIEN && obj.active && !obj.hasFired) {
             // Fire when within range (e.g., -90 units away)
             if (obj.position[2] > -90) {
                 obj.hasFired = true;
                 
                 // Spawn Missile
                 newSpawns.push({
                     id: uuidv4(),
                     type: ObjectType.MISSILE,
                     position: [obj.position[0], 1.0, obj.position[2] + 2], // Spawn slightly in front
                     active: true,
                     color: '#ff0000'
                 });
                 hasChanges = true;
                 
                 // Visual flare event
                 window.dispatchEvent(new CustomEvent('particle-burst', { 
                    detail: { position: obj.position, color: '#ff00ff' } 
                 }));
             }
        }

        let keep = true;
        if (obj.active) {
            // Swept Collision: Check if object's path [prevZ, currentZ] overlaps with player collision zone
            // INCREASED THRESHOLD from 1.0 to 2.0 to prevent missile tunneling at low FPS/High Speed
            const zThreshold = 2.0; 
            const inZZone = (prevZ < playerPos.z + zThreshold) && (obj.position[2] > playerPos.z - zThreshold);
            
            // SHOP PORTAL COLLISION
            if (obj.type === ObjectType.SHOP_PORTAL) {
                // Strict proximity check for portal since it's large
                const dz = Math.abs(obj.position[2] - playerPos.z);
                if (dz < 2) { 
                     openShop();
                     obj.active = false;
                     hasChanges = true;
                     keep = false; 
                }
            } else if (inZZone) {
                // STANDARD COLLISION
                const dx = Math.abs(obj.position[0] - playerPos.x);
                const hitWidth = obj.variant === ObstacleVariant.WIDE_WALL ? LANE_WIDTH : 0.9;
                
                if (dx < hitWidth) {
                     
                     // Obstacles, Aliens, and Missiles damage player
                     const isDamageSource = obj.type === ObjectType.OBSTACLE || 
                                          obj.type === ObjectType.ALIEN || 
                                          obj.type === ObjectType.MISSILE ||
                                          obj.type === ObjectType.BLOCKER ||
                                          obj.type === ObjectType.MINE;
                     
                     if (isDamageSource) {
                         // VERTICAL COLLISION WITH BOUNDS CHECK
                         const playerBottom = playerPos.y;
                         const playerTop = playerPos.y + 1.8; 

                         let objBottom = obj.position[1] - 0.5;
                         let objTop = obj.position[1] + 0.5;

                         if (obj.type === ObjectType.OBSTACLE) {
                             objBottom = 0;
                             objTop = obj.variant === ObstacleVariant.WIDE_WALL ? 1.2 : OBSTACLE_HEIGHT;
                         } else if (obj.type === ObjectType.MISSILE) {
                             objBottom = 0.5;
                             objTop = 1.5;
                         } else if (obj.type === ObjectType.BLOCKER) {
                             objBottom = 0;
                             objTop = 4.0;
                         } else if (obj.type === ObjectType.MINE) {
                             objBottom = obj.position[1] - 0.6;
                             objTop = obj.position[1] + 0.6;
                         }

                         const isHit = (playerBottom < objTop) && (playerTop > objBottom);

                         if (isHit) { 
                             window.dispatchEvent(new Event('player-hit'));
                             obj.active = false; 
                             hasChanges = true;
                             
                             // Visual burst for missile impact
                             if (obj.type === ObjectType.MISSILE) {
                                window.dispatchEvent(new CustomEvent('particle-burst', { 
                                    detail: { position: obj.position, color: '#ff4400' } 
                                }));
                             }
                         }
                     } else {
                         // Item Collection
                         const dy = Math.abs(obj.position[1] - playerPos.y);
                         if (dy < 2.5) { // Generous vertical pickup range
                            if (obj.type === ObjectType.GEM) {
                                collectGem(obj.points || 50);
                                audio.playGemCollect();
                                
                                window.dispatchEvent(new CustomEvent('particle-burst', { 
                                    detail: { 
                                        position: obj.position, 
                                        color: obj.color || '#ffffff',
                                        type: 'shimmer'
                                    } 
                                }));
                            }
                            if (obj.type === ObjectType.LETTER && obj.targetIndex !== undefined) {
                                collectLetter(obj.targetIndex);
                                audio.playLetterCollect();
                                
                                window.dispatchEvent(new CustomEvent('particle-burst', { 
                                    detail: { 
                                        position: obj.position, 
                                        color: obj.color || '#ffffff',
                                        type: 'trail'
                                    } 
                                }));
                            }

                            obj.active = false;
                            hasChanges = true;
                         }
                     }
                }
            }
        }

        if (obj.position[2] > REMOVE_DISTANCE) {
            keep = false;
            hasChanges = true;
        }

        if (keep) {
            keptObjects.push(obj);
        }
    }

    // Add any newly spawned entities (Missiles)
    if (newSpawns.length > 0) {
        keptObjects.push(...newSpawns);
    }

    // 2. Spawning Logic
    let furthestZ = 0;
    // Only consider static obstacles/gems for gap calculation, not missiles or moving aliens
    const staticObjects = keptObjects.filter(o => o.type !== ObjectType.MISSILE);
    
    if (staticObjects.length > 0) {
        furthestZ = Math.min(...staticObjects.map(o => o.position[2]));
    } else {
        furthestZ = -20;
    }

    if (furthestZ > -SPAWN_DISTANCE) {
         // Reduced gap formula to increase obstacle frequency
         const minGap = 12 + (speed * 0.4); 
         const spawnZ = Math.min(furthestZ - minGap, -SPAWN_DISTANCE);
         
         const isLetterDue = distanceTraveled.current >= nextLetterDistance.current;

         if (isLetterDue) {
             const lane = getRandomLane(laneCount);
             const target = wordTarget;
             
             const availableIndices = target.map((_, i) => i).filter(i => !collectedLetters.includes(i));

             if (availableIndices.length > 0) {
                 const chosenIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
                 const val = target[chosenIndex];
                 // Cycle through the 6 neon palette entries so words longer than 6 still get colors.
                 const color = GEMINI_COLORS[chosenIndex % GEMINI_COLORS.length];

                 keptObjects.push({
                    id: uuidv4(),
                    type: ObjectType.LETTER,
                    position: [lane * LANE_WIDTH, 1.0, spawnZ], 
                    active: true,
                    color: color,
                    value: val,
                    targetIndex: chosenIndex
                 });
                 
                 // Schedule next letter based on current level difficulty + word length
                 nextLetterDistance.current += getLetterInterval(level, wordTarget.length);
                 hasChanges = true;
             } else {
                // Fallback to gem if all letters collected for this level
                keptObjects.push({
                    id: uuidv4(),
                    type: ObjectType.GEM,
                    position: [lane * LANE_WIDTH, 1.2, spawnZ],
                    active: true,
                    color: '#00ffff',
                    points: 50
                });
                hasChanges = true;
             }

          } else if (Math.random() > 0.1) { // 90% chance to attempt spawn if gap exists
            
            // Standard difficulty scaling based on level
            const gemProb = 0.20 + (level * 0.02); // Slightly more gems as levels progress
            const isObstacle = Math.random() > gemProb;

            if (isObstacle) {
                // Decide between Alien (Level 2+) or Spikes
                const spawnAlien = level >= 2 && Math.random() < (0.1 + level * 0.05); 

                if (spawnAlien) {
                    // Multi-Lane Alien Logic
                    const availableLanes = [];
                    const maxLane = Math.floor(laneCount / 2);
                    for (let i = -maxLane; i <= maxLane; i++) availableLanes.push(i);
                    availableLanes.sort(() => Math.random() - 0.5);

                    // Determine how many aliens to spawn
                    let alienCount = Math.random() < (0.1 * level) ? 2 : 1;
                    if (level >= 3 && Math.random() < 0.1) alienCount = 3;

                    alienCount = Math.min(alienCount, availableLanes.length);

                    for (let k = 0; k < alienCount; k++) {
                        const lane = availableLanes[k];
                        keptObjects.push({
                            id: uuidv4(),
                            type: ObjectType.ALIEN,
                            position: [lane * LANE_WIDTH, 1.5, spawnZ],
                            active: true,
                            color: '#00ff00',
                            hasFired: false
                        });
                    }
                } else {
                    // Enhanced Obstacle Patterns
                    const maxLane = Math.floor(laneCount / 2);
                    const availableLanes = [];
                    for (let i = -maxLane; i <= maxLane; i++) availableLanes.push(i);
                    availableLanes.sort(() => Math.random() - 0.5);

                    const randPattern = Math.random();

                    if (randPattern < 0.15 && laneCount >= 3) {
                        // Pattern: Wide Wall (Covers 2 lanes)
                        const centerLane = availableLanes[0];
                        // Adjust center if too close to edge
                        const adjustedLane = Math.max(-maxLane + 0.5, Math.min(maxLane - 0.5, centerLane));
                        
                        keptObjects.push({
                            id: uuidv4(),
                            type: ObjectType.OBSTACLE,
                            variant: ObstacleVariant.WIDE_WALL,
                            position: [adjustedLane * LANE_WIDTH, 0.6, spawnZ],
                            active: true,
                            color: '#ff00ff'
                        });
                    } else if (randPattern < 0.35) {
                         // Pattern: Tall Blocker
                         const lane = availableLanes[0];
                         keptObjects.push({
                             id: uuidv4(),
                             type: ObjectType.BLOCKER,
                             position: [lane * LANE_WIDTH, 2.0, spawnZ], // Y is center of 4.0 height
                             active: true
                         });
                    } else if (randPattern < 0.55 && level >= 2) {
                        // Pattern: Mines (High and Low)
                        const count = Math.min(3, availableLanes.length);
                        for (let i = 0; i < count; i++) {
                            const lane = availableLanes[i];
                            const height = Math.random() > 0.5 ? 1.0 : 3.0; // Low or High
                            keptObjects.push({
                                id: uuidv4(),
                                type: ObjectType.MINE,
                                position: [lane * LANE_WIDTH, height, spawnZ],
                                active: true
                            });
                        }
                    } else {
                        // Pattern: Standard Spikes (1-3)
                        let countToSpawn = 1;
                        if (Math.random() < 0.2 + (level * 0.1)) countToSpawn = Math.min(2, availableLanes.length);
                        if (level >= 3 && Math.random() < 0.15) countToSpawn = Math.min(3, availableLanes.length);

                        for (let i = 0; i < countToSpawn; i++) {
                            const lane = availableLanes[i];
                            const laneX = lane * LANE_WIDTH;
                            
                            keptObjects.push({
                                id: uuidv4(),
                                type: ObjectType.OBSTACLE,
                                variant: ObstacleVariant.SPIKE,
                                position: [laneX, OBSTACLE_HEIGHT / 2, spawnZ],
                                active: true,
                                color: '#ff0054'
                            });

                            // Chance for gem on top of obstacle
                            if (Math.random() < 0.3) {
                                 keptObjects.push({
                                    id: uuidv4(),
                                    type: ObjectType.GEM,
                                    position: [laneX, OBSTACLE_HEIGHT + 1.0, spawnZ],
                                    active: true,
                                    color: '#ffd700',
                                    points: 100
                                });
                            }
                        }
                    }
                }

            } else {
                // GROUND GEM SPAWNING
                const lane = getRandomLane(laneCount);
                keptObjects.push({
                    id: uuidv4(),
                    type: ObjectType.GEM,
                    position: [lane * LANE_WIDTH, 1.2, spawnZ],
                    active: true,
                    color: '#00ffff',
                    points: 50
                });
            }
            hasChanges = true;
         }
    }

    if (hasChanges) {
        objectsRef.current = keptObjects;
        setRenderTrigger(t => t + 1);
    }
  });

  return (
    <group>
      <ParticleSystem />
      {objectsRef.current.map(obj => {
        if (!obj.active) return null;
        return <GameEntity key={obj.id} data={obj} />;
      })}
    </group>
  );
};

const GameEntity: React.FC<{ data: GameObject }> = React.memo(({ data }) => {
    const groupRef = useRef<THREE.Group>(null);
    const visualRef = useRef<THREE.Group>(null);
    const shadowRef = useRef<THREE.Mesh>(null);
    const mineGlowRef = useRef<THREE.Mesh>(null);
    const { laneCount } = useStore();
    
    useFrame((state, delta) => {
        // 1. Move Main Container
        if (groupRef.current) {
            groupRef.current.position.set(data.position[0], 0, data.position[2]);
        }

        // 2. Animate Visuals
        if (visualRef.current) {
            const baseHeight = data.position[1];
            
            if (data.type === ObjectType.SHOP_PORTAL) {
                 visualRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2) * 0.02);
            } else if (data.type === ObjectType.MISSILE) {
                 // Missile rotation
                 visualRef.current.rotation.z += delta * 20; // Fast spin
                 visualRef.current.position.y = baseHeight;
            } else if (data.type === ObjectType.MINE) {
                 // Mine Float/Rotate with refined bobbing
                 const pulse = (Math.sin(state.clock.elapsedTime * 8) + 1) / 2;
                 visualRef.current.position.y = baseHeight + Math.sin(state.clock.elapsedTime * 5) * 0.35;
                 visualRef.current.rotation.x += delta * 1.8;
                 visualRef.current.rotation.y += delta * 2.2;
                 
                 // Update pulsing core light (OPTIMIZED: Using direct ref instead of traverse)
                 if (mineGlowRef.current) {
                    const material = mineGlowRef.current.material as THREE.MeshBasicMaterial;
                    material.opacity = 0.2 + pulse * 0.8;
                    mineGlowRef.current.scale.setScalar(0.7 + pulse * 0.1);
                 }
                 
                 if (shadowRef.current) {
                    shadowRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 5) * 0.15);
                 }
            } else if (data.type === ObjectType.ALIEN) {
                 // Alien Hover
                 visualRef.current.position.y = baseHeight + Math.sin(state.clock.elapsedTime * 3) * 0.2;
                 visualRef.current.rotation.y += delta;
            } else if (data.type !== ObjectType.OBSTACLE) {
                 // Gem/Letter Bobbing
                 visualRef.current.rotation.y += delta * 3;
                 const bobOffset = Math.sin(state.clock.elapsedTime * 4 + data.position[0]) * 0.1;
                 visualRef.current.position.y = baseHeight + bobOffset;
                 
                 if (shadowRef.current) {
                    const shadowScale = 1 - bobOffset; 
                    shadowRef.current.scale.setScalar(shadowScale);
                 }
            } else {
                 visualRef.current.position.y = baseHeight;
            }
        }
    });

    // Select Shadow Geometry based on type (using shared geometries)
    const shadowGeo = useMemo(() => {
        if (data.type === ObjectType.LETTER) return SHADOW_LETTER_GEO;
        if (data.type === ObjectType.GEM) return SHADOW_GEM_GEO;
        if (data.type === ObjectType.SHOP_PORTAL) return null; 
        if (data.type === ObjectType.ALIEN) return SHADOW_ALIEN_GEO;
        if (data.type === ObjectType.MISSILE) return SHADOW_MISSILE_GEO;
        if (data.type === ObjectType.BLOCKER) return SHADOW_BLOCKER_GEO;
        if (data.type === ObjectType.MINE) return SHADOW_MINE_GEO;
        if (data.variant === ObstacleVariant.WIDE_WALL) return SHADOW_WIDE_WALL_GEO;
        return SHADOW_DEFAULT_GEO; 
    }, [data.type]);

    return (
        <group ref={groupRef} position={[data.position[0], 0, data.position[2]]}>
            {data.type !== ObjectType.SHOP_PORTAL && shadowGeo && (
                <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} geometry={shadowGeo}>
                    <meshBasicMaterial color="#000000" opacity={0.3} transparent />
                </mesh>
            )}

            <group ref={visualRef} position={[0, data.position[1], 0]}>
                {/* --- SHOP PORTAL --- */}
                {data.type === ObjectType.SHOP_PORTAL && (
                    <group>
                         <mesh position={[0, 3, 0]} geometry={SHOP_FRAME_GEO} scale={[laneCount * LANE_WIDTH + 2, 1, 1]}>
                             <meshStandardMaterial color="#111111" metalness={0.8} roughness={0.2} />
                         </mesh>
                         <mesh position={[0, 2, 0]} geometry={SHOP_BACK_GEO} scale={[laneCount * LANE_WIDTH, 1, 1]}>
                              <meshBasicMaterial color="#000000" />
                         </mesh>
                         <mesh position={[0, 3, 0]} geometry={SHOP_OUTLINE_GEO} scale={[laneCount * LANE_WIDTH + 2.2, 1, 1]}>
                             <meshBasicMaterial color="#00ffff" wireframe transparent opacity={0.3} />
                         </mesh>
                         <Center position={[0, 5, 0.6]}>
                             <Text3D font={FONT_URL} size={1.2} height={0.2}>
                                 CYBER SHOP
                                 <meshBasicMaterial color="#ffff00" />
                             </Text3D>
                         </Center>
                         <mesh position={[0, 0.1, 0]} rotation={[-Math.PI/2, 0, 0]} geometry={SHOP_FLOOR_GEO} scale={[laneCount * LANE_WIDTH, 1, 1]}>
                             <meshBasicMaterial color="#00ffff" transparent opacity={0.3} />
                         </mesh>
                    </group>
                )}

                {/* --- OBSTACLE (SPIKE VARIANT) --- */}
                {data.type === ObjectType.OBSTACLE && data.variant === ObstacleVariant.SPIKE && (
                    <group>
                        <mesh geometry={OBSTACLE_GEOMETRY} castShadow receiveShadow>
                             <meshStandardMaterial 
                                 color="#330011"
                                 roughness={0.3} 
                                 metalness={0.8} 
                                 flatShading={true}
                             />
                        </mesh>
                        <mesh scale={[1.02, 1.02, 1.02]} geometry={OBSTACLE_GLOW_GEO}>
                             <meshBasicMaterial 
                                 color={data.color} 
                                 wireframe 
                                 transparent 
                                 opacity={0.3} 
                             />
                        </mesh>
                         <mesh position={[0, -OBSTACLE_HEIGHT/2 + 0.05, 0]} rotation={[-Math.PI/2,0,0]} geometry={OBSTACLE_RING_GEO}>
                             <meshBasicMaterial color={data.color} transparent opacity={0.4} side={THREE.DoubleSide} />
                         </mesh>
                    </group>
                )}

                {/* --- WIDE WALL VARIANT --- */}
                {data.type === ObjectType.OBSTACLE && data.variant === ObstacleVariant.WIDE_WALL && (
                    <group>
                        <mesh geometry={WIDE_WALL_GEO} castShadow receiveShadow>
                            <meshStandardMaterial color="#440011" metalness={0.9} roughness={0.1} />
                        </mesh>
                        <mesh scale={[1.01, 1.1, 1.1]} geometry={WIDE_WALL_GEO}>
                            <meshBasicMaterial color={data.color} wireframe transparent opacity={0.3} />
                        </mesh>
                    </group>
                )}

                {/* --- BLOCKER (TALL) --- */}
                {data.type === ObjectType.BLOCKER && (
                    <group>
                         <mesh geometry={BLOCKER_GEO} castShadow receiveShadow>
                            <meshStandardMaterial color="#220033" metalness={0.8} roughness={0.2} />
                         </mesh>
                         <mesh scale={[1.1, 1.01, 1.1]} geometry={BLOCKER_GEO}>
                            <meshBasicMaterial color="#ff00ff" wireframe transparent opacity={0.4} />
                         </mesh>
                         {/* Visual "Caution" lights */}
                         <mesh position={[0, 1.8, 0.21]} geometry={ALIEN_EYE_GEO}>
                            <meshBasicMaterial color="#ff0000" />
                         </mesh>
                         <mesh position={[0, -1.8, 0.21]} geometry={ALIEN_EYE_GEO}>
                            <meshBasicMaterial color="#ff0000" />
                         </mesh>
                    </group>
                )}

                {/* --- MINE --- */}
                {data.type === ObjectType.MINE && (
                    <group>
                        {/* Outer Shell */}
                        <mesh geometry={MINE_CORE_GEO} castShadow>
                             <meshStandardMaterial color="#1a1a1a" metalness={1} roughness={0.1} />
                        </mesh>
                        
                        {/* Pulsing Inner Core */}
                        <mesh ref={mineGlowRef} name="Mine_GlowCore">
                            <sphereGeometry args={[0.35, 16, 16]} />
                            <meshBasicMaterial color="#ff0000" transparent opacity={0.8} toneMapped={false} />
                        </mesh>

                        {/* Enhanced Spikes (Increased count and variation) */}
                        {[...Array(12)].map((_, i) => {
                            const phi = Math.acos(-1 + (2 * i) / 12);
                            const theta = Math.sqrt(12 * Math.PI) * phi;
                            return (
                                <group key={i} rotation={[phi, theta, 0]}>
                                    <mesh position={[0, 0.5, 0]} geometry={MINE_SPYKE_GEO}>
                                        <meshStandardMaterial color="#444444" metalness={0.9} roughness={0.2} />
                                    </mesh>
                                    {/* Small tip light on spikes */}
                                    <mesh position={[0, 0.8, 0]}>
                                        <sphereGeometry args={[0.04, 8, 8]} />
                                        <meshBasicMaterial color="#ff3300" toneMapped={false} />
                                    </mesh>
                                </group>
                            );
                        })}
                    </group>
                )}

                {/* --- ALIEN (LEVEL 2+) --- */}
                {data.type === ObjectType.ALIEN && (
                    <group>
                        {/* Saucer Body */}
                        <mesh castShadow geometry={ALIEN_BODY_GEO}>
                            <meshStandardMaterial color="#4400cc" metalness={0.8} roughness={0.2} />
                        </mesh>
                        {/* Dome */}
                        <mesh position={[0, 0.2, 0]} geometry={ALIEN_DOME_GEO}>
                            <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.5} transparent opacity={0.8} />
                        </mesh>
                        {/* Glowing Eyes/Lights */}
                        <mesh position={[0.3, 0, 0.3]} geometry={ALIEN_EYE_GEO}>
                             <meshBasicMaterial color="#ff00ff" />
                        </mesh>
                        <mesh position={[-0.3, 0, 0.3]} geometry={ALIEN_EYE_GEO}>
                             <meshBasicMaterial color="#ff00ff" />
                        </mesh>
                    </group>
                )}

                {/* --- MISSILE (Long Laser) --- */}
                {data.type === ObjectType.MISSILE && (
                    <group rotation={[Math.PI / 2, 0, 0]}>
                        {/* Long glowing core: Oriented along Y (which is Z after rotation) */}
                        <mesh geometry={MISSILE_CORE_GEO}>
                            <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={4} />
                        </mesh>
                        {/* Energy Rings */}
                        <mesh position={[0, 1.0, 0]} geometry={MISSILE_RING_GEO}>
                            <meshBasicMaterial color="#ffff00" />
                        </mesh>
                        <mesh position={[0, 0, 0]} geometry={MISSILE_RING_GEO}>
                            <meshBasicMaterial color="#ffff00" />
                        </mesh>
                        <mesh position={[0, -1.0, 0]} geometry={MISSILE_RING_GEO}>
                            <meshBasicMaterial color="#ffff00" />
                        </mesh>
                    </group>
                )}

                {/* --- GEM --- */}
                {data.type === ObjectType.GEM && (
                    <mesh castShadow geometry={GEM_GEOMETRY}>
                        <meshStandardMaterial 
                            color={data.color} 
                            roughness={0} 
                            metalness={1} 
                            emissive={data.color} 
                            emissiveIntensity={2} 
                        />
                    </mesh>
                )}

                {/* --- LETTER --- */}
                {data.type === ObjectType.LETTER && (
                    <group scale={[1.5, 1.5, 1.5]}>
                         <Center>
                             <Text3D 
                                font={FONT_URL} 
                                size={0.8} 
                                height={0.5} 
                                bevelEnabled
                                bevelThickness={0.02}
                                bevelSize={0.02}
                                bevelSegments={5}
                             >
                                {data.value}
                                <meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={1.5} />
                             </Text3D>
                         </Center>
                    </group>
                )}
            </group>
        </group>
    );
});
