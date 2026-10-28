// StudyMate OS - Client Application with 3D Minti Companion
// React 18 + Three.js + Tailwind CSS

const { useState, useEffect, useRef } = React;

// ----------------- 3D MINTI COMPANION COMPONENT (THREE.JS) -----------------

function MintiCharacter3D({
    state = "idle", // idle, welcome, study, completed, levelup, streak, boss_defeat, sleep
    equippedHat = null,
    equippedGlasses = null,
    equippedOutfit = "classic",
    equippedAccessory = "sprout",
    equippedJewelry = null,
    interactive = true,
    size = "md", // sm (160px), md (240px), lg (340px)
    characterName = "Minti",
    onCharacterClick = null
}) {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const characterRef = useRef(null);
    const animFrameRef = useRef(null);
    const [speechText, setSpeechText] = useState(null);
    const speechTimeoutRef = useRef(null);
    const rotationYRef = useRef(0);
    const isDraggingRef = useRef(false);
    const startXRef = useRef(0);
    const dragDistanceRef = useRef(0);

    const phrases = [
        "متشکرم! عالی کار کردی! ✨",
        "بیا ادامه بدیم! تو می‌تونی! 💪",
        "امروز هم عالی بودی! 🌟",
        "هر قدم کوچیک، یه معجزه می‌سازه! 🌱",
        "همیشه کنارت هستم! 💖",
        "با تمرکز، غیرممکن‌ها ممکن می‌شن! 🚀",
        "استایل جدیدم چطوره؟ خیلی قشنگه! 🎀"
    ];

    const triggerClickReaction = () => {
        const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
        setSpeechText(randomPhrase);
        if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
        speechTimeoutRef.current = setTimeout(() => setSpeechText(null), 3800);

        if (characterRef.current) {
            characterRef.current.userData.wobble = 1.0;
        }
        if (onCharacterClick) onCharacterClick();
    };

    useEffect(() => {
        const container = mountRef.current;
        if (!container || typeof THREE === "undefined") return;

        const width = container.clientWidth || (size === "lg" ? 340 : size === "sm" ? 160 : 240);
        const height = container.clientHeight || (size === "lg" ? 340 : size === "sm" ? 160 : 240);

        // 1. Scene & Camera
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
        camera.position.set(0, 0.25, 3.8);

        // 2. Renderer with ACES Tone Mapping (avoids blown-out white surfaces)
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        rendererRef.current = renderer;
        container.innerHTML = "";
        container.appendChild(renderer.domElement);

        // 3. Balanced Lighting Setup for Soft Pastel Shading
        const ambientLight = new THREE.AmbientLight(0xfff1f1, 0.78);
        scene.add(ambientLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
        keyLight.position.set(2.0, 3.5, 3.0);
        keyLight.castShadow = true;
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xffe4e6, 0.35);
        fillLight.position.set(-2.0, 1.5, 2.0);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xf5afaf, 0.55);
        rimLight.position.set(0, 2.5, -2.5);
        scene.add(rimLight);

        // 4. Materials with warm peach-cream porcelain tone
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0xffeae8, // Warm peach-cream tone matching reference image
            roughness: 0.52,
            metalness: 0.02
        });

        const bellyMat = new THREE.MeshStandardMaterial({
            color: 0xfff7f5, // Slightly lighter warm belly
            roughness: 0.55,
            metalness: 0.01
        });

        const pinkBlushMat = new THREE.MeshStandardMaterial({
            color: 0xf43f5e,
            roughness: 0.6,
            transparent: true,
            opacity: 0.45
        });

        const earInnerMat = new THREE.MeshStandardMaterial({
            color: 0xfda4af, // Soft pastel rose inner ear
            roughness: 0.65
        });

        const eyeMat = new THREE.MeshStandardMaterial({
            color: 0x180f1a, // Deep rich obsidian blackberry
            roughness: 0.08,
            metalness: 0.4
        });

        const specularMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

        const mouthMat = new THREE.MeshBasicMaterial({ color: 0x9f1239 });
        const tongueMat = new THREE.MeshBasicMaterial({ color: 0xf472b6 });

        const greenSproutMat = new THREE.MeshStandardMaterial({
            color: 0x22c55e, // Vibrant emerald green
            roughness: 0.35
        });

        const flowerBudMat = new THREE.MeshStandardMaterial({
            color: 0xf472b6, // Cute pink flower bud
            roughness: 0.3
        });

        const goldCrownMat = new THREE.MeshStandardMaterial({
            color: 0xfacc15,
            roughness: 0.2,
            metalness: 0.85
        });

        const silverMat = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0,
            roughness: 0.15,
            metalness: 0.9
        });

        const backpackMat = new THREE.MeshStandardMaterial({
            color: 0x0ea5e9, // Bright sky blue bag
            roughness: 0.5
        });

        const scarfMat = new THREE.MeshStandardMaterial({
            color: 0xf43f5e, // Warm winter red/rose knit
            roughness: 0.8
        });

        // 5. Build Minti Character Rig
        const rootGroup = new THREE.Group();
        characterRef.current = rootGroup;
        rootGroup.rotation.y = rotationYRef.current;
        rootGroup.userData = { wobble: 0, blinkTimer: 0, isBlinking: false };
        scene.add(rootGroup);

        // Ground Contact Shadow Disk (so Minti is grounded with depth and never washes out)
        const shadowCanvas = document.createElement("canvas");
        shadowCanvas.width = 64;
        shadowCanvas.height = 64;
        const sCtx = shadowCanvas.getContext("2d");
        const sGrad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 30);
        sGrad.addColorStop(0, "rgba(220, 160, 160, 0.45)");
        sGrad.addColorStop(0.5, "rgba(245, 175, 175, 0.2)");
        sGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
        sCtx.fillStyle = sGrad;
        sCtx.fillRect(0, 0, 64, 64);

        const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
        const groundShadowGeo = new THREE.PlaneGeometry(1.5, 1.5);
        const groundShadowMat = new THREE.MeshBasicMaterial({
            map: shadowTexture,
            transparent: true,
            depthWrite: false
        });
        const groundShadow = new THREE.Mesh(groundShadowGeo, groundShadowMat);
        groundShadow.rotation.x = -Math.PI / 2;
        groundShadow.position.y = -0.73;
        scene.add(groundShadow);

        // Main Body (Cute chubby pear silhouette)
        const bodyGeo = new THREE.SphereGeometry(0.72, 36, 36);
        bodyGeo.scale(1.02, 1.15, 0.95);
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.y = 0;
        bodyMesh.castShadow = true;
        rootGroup.add(bodyMesh);

        // Soft Belly Patch (Warmer subtle cream highlights)
        const bellyGeo = new THREE.SphereGeometry(0.54, 24, 24);
        bellyGeo.scale(0.85, 0.95, 0.3);
        const bellyMesh = new THREE.Mesh(bellyGeo, bellyMat);
        bellyMesh.position.set(0, -0.06, 0.42);
        rootGroup.add(bellyMesh);

        // Cheeks (Rosy Pink Blush)
        const cheekGeo = new THREE.SphereGeometry(0.12, 20, 20);
        cheekGeo.scale(1.25, 0.65, 0.45);

        const leftCheek = new THREE.Mesh(cheekGeo, pinkBlushMat);
        leftCheek.position.set(-0.38, 0.04, 0.62);
        rootGroup.add(leftCheek);

        const rightCheek = new THREE.Mesh(cheekGeo, pinkBlushMat);
        rightCheek.position.set(0.38, 0.04, 0.62);
        rootGroup.add(rightCheek);

        // Eyes Group (Chibi Glossy Anime Eyes with dual sparkles)
        const eyesGroup = new THREE.Group();
        rootGroup.add(eyesGroup);
        rootGroup.userData.eyesGroup = eyesGroup;

        const eyeGeo = new THREE.SphereGeometry(0.13, 28, 28);
        eyeGeo.scale(0.95, 1.25, 0.55);

        // Left Eye
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.25, 0.17, 0.64);
        const leftSpecMain = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 16), specularMat);
        leftSpecMain.position.set(-0.22, 0.22, 0.72);
        const leftSpecSub = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), specularMat);
        leftSpecSub.position.set(-0.28, 0.12, 0.70);
        eyesGroup.add(leftEye, leftSpecMain, leftSpecSub);

        // Right Eye
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.25, 0.17, 0.64);
        const rightSpecMain = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 16), specularMat);
        rightSpecMain.position.set(0.22, 0.22, 0.72);
        const rightSpecSub = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), specularMat);
        rightSpecSub.position.set(0.28, 0.12, 0.70);
        eyesGroup.add(rightEye, rightSpecMain, rightSpecSub);

        // Cute Mouth / Smile with little pink tongue
        const mouthCurve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(-0.065, 0.01, 0.70),
            new THREE.Vector3(0, -0.065, 0.71),
            new THREE.Vector3(0.065, 0.01, 0.70)
        );
        const mouthGeo = new THREE.TubeGeometry(mouthCurve, 16, 0.016, 8, false);
        const mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
        rootGroup.add(mouthMesh);

        const tongueGeo = new THREE.SphereGeometry(0.035, 12, 12);
        tongueGeo.scale(1.2, 0.8, 0.5);
        const tongueMesh = new THREE.Mesh(tongueGeo, tongueMat);
        tongueMesh.position.set(0, -0.045, 0.705);
        rootGroup.add(tongueMesh);

        // Floppy Drooping Ears (with soft rose inner ear)
        const earGeo = new THREE.SphereGeometry(0.22, 24, 24);
        earGeo.scale(0.68, 1.6, 0.48);

        const leftEarGroup = new THREE.Group();
        leftEarGroup.position.set(-0.62, 0.42, 0);
        leftEarGroup.rotation.z = 0.48;
        const leftEar = new THREE.Mesh(earGeo, bodyMat);
        const leftInnerEar = new THREE.Mesh(earGeo, earInnerMat);
        leftInnerEar.scale.set(0.62, 0.78, 0.6);
        leftInnerEar.position.set(0, 0, 0.04);
        leftEarGroup.add(leftEar, leftInnerEar);
        rootGroup.add(leftEarGroup);
        rootGroup.userData.leftEar = leftEarGroup;

        const rightEarGroup = new THREE.Group();
        rightEarGroup.position.set(0.62, 0.42, 0);
        rightEarGroup.rotation.z = -0.48;
        const rightEar = new THREE.Mesh(earGeo, bodyMat);
        const rightInnerEar = new THREE.Mesh(earGeo, earInnerMat);
        rightInnerEar.scale.set(0.62, 0.78, 0.6);
        rightInnerEar.position.set(0, 0, 0.04);
        rightEarGroup.add(rightEar, rightInnerEar);
        rootGroup.add(rightEarGroup);
        rootGroup.userData.rightEar = rightEarGroup;

        // Limbs (Chubby Paws & Feet)
        const armGeo = new THREE.SphereGeometry(0.14, 18, 18);
        armGeo.scale(0.85, 1.35, 0.85);

        const leftArm = new THREE.Mesh(armGeo, bodyMat);
        leftArm.position.set(-0.55, -0.15, 0.25);
        leftArm.rotation.z = 0.32;
        rootGroup.add(leftArm);
        rootGroup.userData.leftArm = leftArm;

        const rightArm = new THREE.Mesh(armGeo, bodyMat);
        rightArm.position.set(0.55, -0.15, 0.25);
        rightArm.rotation.z = -0.32;
        rootGroup.add(rightArm);
        rootGroup.userData.rightArm = rightArm;

        const footGeo = new THREE.SphereGeometry(0.16, 18, 18);
        footGeo.scale(1.2, 0.7, 1.45);
        const leftFoot = new THREE.Mesh(footGeo, bodyMat);
        leftFoot.position.set(-0.3, -0.72, 0.12);
        const rightFoot = new THREE.Mesh(footGeo, bodyMat);
        rightFoot.position.set(0.3, -0.72, 0.12);
        rootGroup.add(leftFoot, rightFoot);

        // 6. Accessories, Jewelry & Outfit Props

        // Signature Sprout on Head (Active unless a full hat is equipped)
        const shouldShowSprout = equippedAccessory === "sprout" || (!equippedHat || equippedHat === "none_hat");
        if (shouldShowSprout) {
            const sproutGroup = new THREE.Group();
            sproutGroup.position.set(0, 0.78, 0);

            const stemCurve = new THREE.QuadraticBezierCurve3(
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0.04, 0.16, 0),
                new THREE.Vector3(0.02, 0.28, 0)
            );
            const stemGeo = new THREE.TubeGeometry(stemCurve, 10, 0.025, 8, false);
            const stemMesh = new THREE.Mesh(stemGeo, greenSproutMat);
            sproutGroup.add(stemMesh);

            const leafGeo = new THREE.SphereGeometry(0.12, 16, 16);
            leafGeo.scale(1.6, 0.22, 0.8);
            const leaf1 = new THREE.Mesh(leafGeo, greenSproutMat);
            leaf1.position.set(0.12, 0.25, 0);
            leaf1.rotation.z = 0.42;
            const leaf2 = new THREE.Mesh(leafGeo, greenSproutMat);
            leaf2.position.set(-0.11, 0.22, 0);
            leaf2.rotation.z = -0.42;
            sproutGroup.add(leaf1, leaf2);

            // Cute Pink Flower Bud on Top (exact matching of reference illustration)
            const flowerBud = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 12), flowerBudMat);
            flowerBud.position.set(0.02, 0.31, 0);
            flowerBud.scale.set(0.9, 1.2, 0.9);
            sproutGroup.add(flowerBud);

            rootGroup.add(sproutGroup);
            rootGroup.userData.sproutGroup = sproutGroup;
        }

        // Backpack on back (Active for classic outfit or when backpack equipped)
        if (equippedOutfit === "classic" || equippedAccessory === "backpack") {
            const backpackGeo = new THREE.BoxGeometry(0.48, 0.58, 0.3);
            const backpackMesh = new THREE.Mesh(backpackGeo, backpackMat);
            backpackMesh.position.set(0, -0.05, -0.65);

            // Pocket & handle details
            const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.1), new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 }));
            pocket.position.set(0, -0.1, -0.18);
            backpackMesh.add(pocket);

            rootGroup.add(backpackMesh);
        }

        // Jewelry & Piercings (Hoops, Star Studs, Ear Cuffs, Chain Necklace)
        if (equippedJewelry === "silver_hoops") {
            const hoopGeo = new THREE.TorusGeometry(0.065, 0.016, 8, 20);
            const leftHoop = new THREE.Mesh(hoopGeo, silverMat);
            leftHoop.position.set(0, -0.32, 0.04);
            leftEarGroup.add(leftHoop);
            const rightHoop = new THREE.Mesh(hoopGeo, silverMat);
            rightHoop.position.set(0, -0.32, 0.04);
            rightEarGroup.add(rightHoop);
        } else if (equippedJewelry === "star_studs") {
            const starGeo = new THREE.ConeGeometry(0.05, 0.03, 5);
            const leftStar = new THREE.Mesh(starGeo, goldCrownMat);
            leftStar.position.set(0, -0.22, 0.06);
            leftStar.rotation.x = Math.PI / 2;
            leftEarGroup.add(leftStar);
            const rightStar = new THREE.Mesh(starGeo, goldCrownMat);
            rightStar.position.set(0, -0.22, 0.06);
            rightStar.rotation.x = Math.PI / 2;
            rightEarGroup.add(rightStar);
        } else if (equippedJewelry === "ear_cuffs") {
            const cuffGeo = new THREE.TorusGeometry(0.05, 0.018, 8, 16, Math.PI * 1.5);
            const leftCuff1 = new THREE.Mesh(cuffGeo, goldCrownMat);
            leftCuff1.position.set(0.06, 0.05, 0.02);
            leftEarGroup.add(leftCuff1);
            const rightCuff1 = new THREE.Mesh(cuffGeo, goldCrownMat);
            rightCuff1.position.set(-0.06, 0.05, 0.02);
            rightEarGroup.add(rightCuff1);
        } else if (equippedJewelry === "chain_necklace") {
            const chainGeo = new THREE.TorusGeometry(0.38, 0.02, 8, 30);
            chainGeo.scale(1, 0.7, 1);
            const chainMesh = new THREE.Mesh(chainGeo, silverMat);
            chainMesh.position.set(0, -0.22, 0.32);
            chainMesh.rotation.x = Math.PI / 3;

            // Mini star pendant
            const pendant = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.03, 5), goldCrownMat);
            pendant.position.set(0, -0.32, 0.58);
            rootGroup.add(chainMesh, pendant);
        }

        // Outfits Custom Props
        if (equippedOutfit === "winter") {
            // Cozy wrapped woolen scarf around neck
            const scarfGeo = new THREE.TorusGeometry(0.42, 0.1, 10, 24);
            const scarfMesh = new THREE.Mesh(scarfGeo, scarfMat);
            scarfMesh.position.set(0, -0.16, 0.28);
            scarfMesh.rotation.x = Math.PI / 3;

            // Hanging scarf tails
            const tailGeo = new THREE.BoxGeometry(0.12, 0.42, 0.04);
            const tail = new THREE.Mesh(tailGeo, scarfMat);
            tail.position.set(0.18, -0.38, 0.56);
            tail.rotation.z = -0.15;
            rootGroup.add(scarfMesh, tail);
        } else if (equippedOutfit === "student") {
            // Academic satchel strap across chest
            const strapCurve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(-0.45, 0.35, 0.35),
                new THREE.Vector3(0, 0, 0.55),
                new THREE.Vector3(0.45, -0.35, 0.45)
            ]);
            const strapGeo = new THREE.TubeGeometry(strapCurve, 16, 0.035, 8, false);
            const strapMesh = new THREE.Mesh(strapGeo, new THREE.MeshStandardMaterial({ color: 0x78350f }));
            rootGroup.add(strapMesh);
        } else if (equippedOutfit === "gaming") {
            // Neon cyan collar line
            const gamingCollarGeo = new THREE.TorusGeometry(0.42, 0.03, 8, 24);
            const gamingCollar = new THREE.Mesh(gamingCollarGeo, new THREE.MeshBasicMaterial({ color: 0x06b6d4 }));
            gamingCollar.position.set(0, -0.18, 0.3);
            gamingCollar.rotation.x = Math.PI / 3;
            rootGroup.add(gamingCollar);
        } else if (equippedOutfit === "hoodie") {
            // Streetwear hoodie collar and drawstrings
            const hoodieCollarGeo = new THREE.TorusGeometry(0.44, 0.09, 8, 24);
            const hoodieMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
            const hoodieCollar = new THREE.Mesh(hoodieCollarGeo, hoodieMat);
            hoodieCollar.position.set(0, -0.18, 0.28);
            hoodieCollar.rotation.x = Math.PI / 3;

            const stringGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.25);
            const strLeft = new THREE.Mesh(stringGeo, silverMat);
            strLeft.position.set(-0.12, -0.34, 0.58);
            const strRight = new THREE.Mesh(stringGeo, silverMat);
            strRight.position.set(0.12, -0.34, 0.58);
            rootGroup.add(hoodieCollar, strLeft, strRight);
        }

        // Hats (Crown, Beanie, Cap, Wizard Hat, Nightcap, Bucket Hat)
        if (equippedHat === "crown" || state === "levelup") {
            const crownGroup = new THREE.Group();
            crownGroup.position.set(0, 0.85, 0);
            const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.35, 0.15, 18), goldCrownMat);
            crownGroup.add(crownBase);
            for (let i = 0; i < 5; i++) {
                const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 6), goldCrownMat);
                const angle = (i / 5) * Math.PI * 2;
                spike.position.set(Math.cos(angle) * 0.3, 0.15, Math.sin(angle) * 0.3);
                crownGroup.add(spike);
            }
            rootGroup.add(crownGroup);
        } else if (equippedHat === "beanie") {
            const beanieGeo = new THREE.SphereGeometry(0.46, 24, 24);
            beanieGeo.scale(1, 0.8, 1);
            const beanieMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6 });
            const beanieMesh = new THREE.Mesh(beanieGeo, beanieMat);
            beanieMesh.position.set(0, 0.65, 0);
            const pompom = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), new THREE.MeshStandardMaterial({ color: 0xffffff }));
            pompom.position.set(0, 0.98, 0);
            beanieMesh.add(pompom);
            rootGroup.add(beanieMesh);
        } else if (equippedHat === "cap") {
            const capGroup = new THREE.Group();
            capGroup.position.set(0, 0.72, 0);
            const capDome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 20), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
            capDome.scale.set(1, 0.65, 1);
            const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.04, 16), new THREE.MeshStandardMaterial({ color: 0xb91c1c }));
            brim.position.set(0, -0.08, 0.15);
            brim.scale.set(1, 1, 1.4);
            capGroup.add(capDome, brim);
            rootGroup.add(capGroup);
        } else if (equippedHat === "wizard_hat") {
            const wizGroup = new THREE.Group();
            wizGroup.position.set(0, 0.75, 0);
            const wizBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 20), new THREE.MeshStandardMaterial({ color: 0x6b21a8 }));
            const wizCone = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.75, 18), new THREE.MeshStandardMaterial({ color: 0x7e22ce }));
            wizCone.position.set(0, 0.38, 0);
            wizGroup.add(wizBrim, wizCone);
            rootGroup.add(wizGroup);
        } else if (equippedHat === "nightcap") {
            const nightGroup = new THREE.Group();
            nightGroup.position.set(0, 0.75, 0);
            const nightCone = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.65, 16), new THREE.MeshStandardMaterial({ color: 0x60a5fa }));
            nightCone.rotation.z = -0.45;
            nightCone.position.set(0.15, 0.25, 0);
            const nightPompom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), specularMat);
            nightPompom.position.set(0.36, 0.48, 0);
            nightGroup.add(nightCone, nightPompom);
            rootGroup.add(nightGroup);
        } else if (equippedHat === "bucket_hat") {
            const bucketGroup = new THREE.Group();
            bucketGroup.position.set(0, 0.72, 0);
            const bucketTop = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.28, 18), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 }));
            const bucketBrim = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.15, 18), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 }));
            bucketBrim.position.y = -0.15;
            bucketGroup.add(bucketTop, bucketBrim);
            rootGroup.add(bucketGroup);
        }

        // Glasses (Round, Sunglasses, Cyber Shades)
        if (equippedGlasses === "round_glasses") {
            const glassesGroup = new THREE.Group();
            glassesGroup.position.set(0, 0.17, 0.66);
            const ringGeo = new THREE.TorusGeometry(0.13, 0.018, 8, 24);
            const glassMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.2 });
            const leftGlass = new THREE.Mesh(ringGeo, glassMat);
            leftGlass.position.x = -0.25;
            const rightGlass = new THREE.Mesh(ringGeo, glassMat);
            rightGlass.position.x = 0.25;
            const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.14), glassMat);
            bridge.rotation.z = Math.PI / 2;
            glassesGroup.add(leftGlass, rightGlass, bridge);
            rootGroup.add(glassesGroup);
        } else if (equippedGlasses === "sunglasses") {
            const shadesGroup = new THREE.Group();
            shadesGroup.position.set(0, 0.17, 0.66);
            const shadeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.8 });
            const leftShade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.04), shadeMat);
            leftShade.position.x = -0.25;
            const rightShade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.04), shadeMat);
            rightShade.position.x = 0.25;
            const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.02), shadeMat);
            shadesGroup.add(leftShade, rightShade, bridge);
            rootGroup.add(shadesGroup);
        } else if (equippedGlasses === "cyber_shades") {
            const visorGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.16, 20, 1, true, -Math.PI / 3, Math.PI * 0.66);
            const visorMat = new THREE.MeshStandardMaterial({
                color: 0x06b6d4,
                emissive: 0x0891b2,
                emissiveIntensity: 0.6,
                roughness: 0.1,
                metalness: 0.9,
                transparent: true,
                opacity: 0.88
            });
            const visorMesh = new THREE.Mesh(visorGeo, visorMat);
            visorMesh.position.set(0, 0.17, 0.42);
            rootGroup.add(visorMesh);
        }

        // Headphones (Pink Lo-Fi or Gaming)
        if (equippedAccessory === "headphones" || equippedOutfit === "gaming") {
            const hpGroup = new THREE.Group();
            hpGroup.position.set(0, 0.38, 0);

            const bandCurve = new THREE.QuadraticBezierCurve3(
                new THREE.Vector3(-0.68, 0, 0),
                new THREE.Vector3(0, 0.62, 0),
                new THREE.Vector3(0.68, 0, 0)
            );
            const bandGeo = new THREE.TubeGeometry(bandCurve, 20, 0.032, 8, false);
            const hpMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.3 });
            const bandMesh = new THREE.Mesh(bandGeo, hpMat);
            hpGroup.add(bandMesh);

            const earCupGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.12, 18);
            const leftCup = new THREE.Mesh(earCupGeo, hpMat);
            leftCup.position.set(-0.68, 0, 0);
            leftCup.rotation.z = Math.PI / 2;
            const rightCup = new THREE.Mesh(earCupGeo, hpMat);
            rightCup.position.set(0.68, 0, 0);
            rightCup.rotation.z = Math.PI / 2;
            hpGroup.add(leftCup, rightCup);

            rootGroup.add(hpGroup);
        }

        // Floating Magic Star Accessory
        if (equippedAccessory === "magic_star") {
            const starGeo = new THREE.ConeGeometry(0.14, 0.08, 5);
            const starMesh = new THREE.Mesh(starGeo, goldCrownMat);
            starMesh.position.set(0.65, 0.55, 0.3);
            rootGroup.add(starMesh);
            rootGroup.userData.magicStar = starMesh;
        }

        // Study Book in hands (Active in 'study' state or student outfit)
        if (state === "study" || equippedOutfit === "student") {
            const bookGroup = new THREE.Group();
            bookGroup.position.set(0, -0.15, 0.62);
            bookGroup.rotation.x = -0.32;

            const coverMat = new THREE.MeshStandardMaterial({ color: 0x059669 });
            const pageMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.8 });

            const leftCover = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.02), coverMat);
            leftCover.position.set(-0.16, 0, 0);
            leftCover.rotation.y = 0.25;

            const rightCover = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.02), coverMat);
            rightCover.position.set(0.16, 0, 0);
            rightCover.rotation.y = -0.25;

            const pages = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.38, 0.06), pageMat);
            bookGroup.add(leftCover, rightCover, pages);
            rootGroup.add(bookGroup);

            // Re-pose arms to hold book
            leftArm.position.set(-0.35, -0.12, 0.55);
            leftArm.rotation.set(-0.4, 0.4, 0.6);
            rightArm.position.set(0.35, -0.12, 0.55);
            rightArm.rotation.set(-0.4, -0.4, -0.6);
        }

        // Streak Flame (Active in 'streak' state)
        if (state === "streak") {
            const flameMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
            const flameGeo = new THREE.ConeGeometry(0.18, 0.45, 12);
            const flameMesh = new THREE.Mesh(flameGeo, flameMat);
            flameMesh.position.set(0.42, 0.15, 0.5);
            rootGroup.add(flameMesh);
            rootGroup.userData.flameMesh = flameMesh;
        }

        // 7. Interactive 360-Degree Pointer Drag / Swipe Orbit Controls
        const handlePointerDown = (e) => {
            if (!interactive) return;
            isDraggingRef.current = true;
            startXRef.current = e.clientX || (e.touches && e.touches[0].clientX) || 0;
            dragDistanceRef.current = 0;
        };

        const handlePointerMove = (e) => {
            if (!isDraggingRef.current || !rootGroup) return;
            const currentX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
            const deltaX = currentX - startXRef.current;
            dragDistanceRef.current += Math.abs(deltaX);
            startXRef.current = currentX;

            rotationYRef.current += deltaX * 0.014;
            rootGroup.rotation.y = rotationYRef.current;
        };

        const handlePointerUp = () => {
            if (!isDraggingRef.current) return;
            isDraggingRef.current = false;
            if (dragDistanceRef.current < 6) {
                // Treated as a click/tap
                triggerClickReaction();
            }
        };

        const domElem = renderer.domElement;
        domElem.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);

        // 8. Animation Loop
        let clock = new THREE.Clock();

        const animate = () => {
            animFrameRef.current = requestAnimationFrame(animate);
            const elapsed = clock.getElapsedTime();

            if (!rootGroup) return;

            // Gentle breathing cycle
            const breath = Math.sin(elapsed * 2.2) * 0.035;
            bodyMesh.scale.y = 1.15 + breath;
            bodyMesh.scale.x = 1.02 - breath * 0.45;

            // Sprout swaying naturally
            if (rootGroup.userData.sproutGroup) {
                rootGroup.userData.sproutGroup.rotation.z = Math.sin(elapsed * 3) * 0.12;
            }

            // Ear twitching
            if (rootGroup.userData.leftEar && rootGroup.userData.rightEar) {
                rootGroup.userData.leftEar.rotation.z = 0.48 + Math.sin(elapsed * 2) * 0.05;
                rootGroup.userData.rightEar.rotation.z = -0.48 - Math.sin(elapsed * 2) * 0.05;
            }

            // Magic Star orbit
            if (rootGroup.userData.magicStar) {
                rootGroup.userData.magicStar.position.x = Math.cos(elapsed * 2) * 0.65;
                rootGroup.userData.magicStar.position.z = Math.sin(elapsed * 2) * 0.65;
                rootGroup.userData.magicStar.rotation.y = elapsed * 4;
            }

            // Natural Eye Blinking
            rootGroup.userData.blinkTimer += 0.016;
            if (rootGroup.userData.blinkTimer > 3.6) {
                eyesGroup.scale.y = 0.08;
                if (rootGroup.userData.blinkTimer > 3.75) {
                    eyesGroup.scale.y = 1.0;
                    rootGroup.userData.blinkTimer = 0;
                }
            }

            // Subtle Idle Swaying when not user-dragging
            if (!isDraggingRef.current) {
                // If rotated far away, slow smooth return towards front or gentle sway
                const idleSway = Math.sin(elapsed * 1.5) * 0.06;
                rootGroup.rotation.y = rotationYRef.current + idleSway;
            }

            // State-specific animations
            if (state === "welcome") {
                // Happy wave
                rightArm.position.set(0.55, 0.25, 0.25);
                rightArm.rotation.z = -1.2 + Math.sin(elapsed * 8) * 0.4;
                rootGroup.position.y = Math.sin(elapsed * 4) * 0.08;
            } else if (state === "completed" || state === "happy") {
                // Happy celebration jump
                rootGroup.position.y = Math.abs(Math.sin(elapsed * 6)) * 0.22;
                leftArm.rotation.z = 0.8 + Math.sin(elapsed * 8) * 0.3;
                rightArm.rotation.z = -0.8 - Math.sin(elapsed * 8) * 0.3;
            } else if (state === "levelup") {
                // Level up celebratory spin
                rotationYRef.current += 0.06;
                rootGroup.position.y = Math.sin(elapsed * 5) * 0.15;
            } else if (state === "streak") {
                // Sway with flame
                rootGroup.position.y = Math.sin(elapsed * 3) * 0.04;
                if (rootGroup.userData.flameMesh) {
                    rootGroup.userData.flameMesh.scale.y = 1.0 + Math.sin(elapsed * 12) * 0.25;
                }
            } else if (state === "sleep") {
                // Resting
                rootGroup.position.y = -0.15;
                rootGroup.rotation.x = 0.12;
                eyesGroup.scale.y = 0.05; // Closed eyes
            } else if (state === "boss_defeat") {
                // Victory celebration
                rootGroup.position.y = Math.sin(elapsed * 7) * 0.18;
            }

            // Click wobble dampening (sets rotation.z smoothly without accumulating)
            if (rootGroup.userData.wobble > 0) {
                rootGroup.rotation.z = Math.sin(elapsed * 24) * rootGroup.userData.wobble * 0.14;
                rootGroup.userData.wobble = Math.max(0, rootGroup.userData.wobble - 0.025);
            } else {
                rootGroup.rotation.z = 0;
            }

            renderer.render(scene, camera);
        };

        animate();

        // Responsive resize
        const handleResize = () => {
            if (!container || !renderer || !camera) return;
            const newW = container.clientWidth;
            const newH = container.clientHeight;
            camera.aspect = newW / newH;
            camera.updateProjectionMatrix();
            renderer.setSize(newW, newH);
        };
        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
            domElem.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            cancelAnimationFrame(animFrameRef.current);
            if (renderer.domElement && renderer.domElement.parentNode) {
                renderer.domElement.parentNode.removeChild(renderer.domElement);
            }
            renderer.dispose();
        };
    }, [state, equippedHat, equippedGlasses, equippedOutfit, equippedAccessory, equippedJewelry, size]);

    return (
        <div 
            className="character-canvas-container"
            title={interactive ? (characterName + " - " + (window.I18N_DICT && window.I18N_DICT.fa && window.I18N_DICT.fa.rotate_hint || "بکشید تا بچرخد")) : ""}
        >
            {speechText && (
                <div className="speech-bubble">
                    {speechText}
                </div>
            )}
            <div ref={mountRef} className="w-full h-full flex items-center justify-center" />
        </div>
    );
}

// ----------------- MAIN APP COMPONENT -----------------

function App() {
    const [lang, setLang] = useState(localStorage.getItem("studymate_lang") || "fa");
    const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, study, planner, friends, challenges, shop, reports, leaderboard, referrals
    const [token, setToken] = useState(localStorage.getItem("studymate_token") || "");
    const [showAuthModal, setShowAuthModal] = useState(!localStorage.getItem("studymate_token"));
    const [authMode, setAuthMode] = useState("login"); // login, register, forgot
    const [toast, setToast] = useState(null);

    // Core data
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState(null);
    const [weeklyChallenge, setWeeklyChallenge] = useState(null);
    const [courses, setCourses] = useState([]);
    const [themes, setThemes] = useState([]);
    const [accessories, setAccessories] = useState([]);
    const [friends, setFriends] = useState([]);
    const [friendRequests, setFriendRequests] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [heatmap, setHeatmap] = useState([]);
    const [referralInfo, setReferralInfo] = useState(null);
    const [sessions, setSessions] = useState([]);

    // Customization & Shop Preview State
    const [previewItem, setPreviewItem] = useState(null); // Item currently tried on in 3D
    const [previewTheme, setPreviewTheme] = useState(null); // Theme currently previewed

    // Reports Analytics State
    const [reportsPeriod, setReportsPeriod] = useState("week"); // 'week', 'month', 'all'
    const [selectedHeatmapDay, setSelectedHeatmapDay] = useState(null);

    // Timer state
    const [timerRunning, setTimerRunning] = useState(false);
    const [timerPaused, setTimerPaused] = useState(false);
    const [targetMins, setTargetMins] = useState(25);
    const [remainingSec, setRemainingSec] = useState(25 * 60);
    const [activePomoId, setActivePomoId] = useState(null);
    const [selectedCourseId, setSelectedCourseId] = useState("");
    const [pomoTopic, setPomoTopic] = useState("");
    const [completedModal, setCompletedModal] = useState(null);
    const [quizData, setQuizData] = useState(null);
    const [characterAnimState, setCharacterAnimState] = useState("idle");

    // Forms state
    const [authForm, setAuthForm] = useState({ username: "", password: "", confirm_password: "", date_of_birth: "", referral_code: "" });
    const [forgotToken, setForgotToken] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
    const [searchUserQuery, setSearchUserQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [shopTab, setShopTab] = useState("themes"); // themes, outfits, hats, glasses, accessories
    const [charNameInput, setCharNameInput] = useState("");
    const [showNameModal, setShowNameModal] = useState(false);
    const [showAchievementModal, setShowAchievementModal] = useState(false);

    // Planner state
    const [plans, setPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [plannerLoading, setPlannerLoading] = useState(false);
    const [plannerForm, setPlannerForm] = useState({
        goal_title: "",
        target_date: "",
        daily_hours: 2.0,
        topics: ""
    });

    const t = (key) => (window.I18N_DICT && window.I18N_DICT[lang] && window.I18N_DICT[lang][key]) || key;

    const notify = (msg, type = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3800);
    };

    useEffect(() => {
        localStorage.setItem("studymate_lang", lang);
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
    }, [lang]);

    // API Helper
    const api = async (endpoint, options = {}) => {
        const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(endpoint, { ...options, headers });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
            setShowAuthModal(true);
            setToken("");
            localStorage.removeItem("studymate_token");
            throw new Error(data.detail || "Unauthorized");
        }
        if (!res.ok) {
            throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
        }
        return data;
    };

    const fetchAllData = async () => {
        if (!token) return;
        try {
            const [u, st, ch, crs, thm, acc, fr, frReq, lb, hm, ref, plns, sess] = await Promise.all([
                api("/users/me"),
                api("/dashboard/stats"),
                api("/challenges/weekly").catch(() => null),
                api("/courses").catch(() => []),
                api("/shop/themes").catch(() => []),
                api("/shop/accessories").catch(() => []),
                api("/friends").catch(() => []),
                api("/friends/requests").catch(() => []),
                api("/leaderboard").catch(() => []),
                api("/dashboard/heatmap").catch(() => []),
                api("/referrals/me").catch(() => null),
                api("/ai/plans").catch(() => []),
                api("/sessions").catch(() => [])
            ]);
            setUser(u);
            setStats(st);
            setWeeklyChallenge(ch);
            setCourses(crs);
            setThemes(thm);
            setAccessories(acc);
            setFriends(fr);
            setFriendRequests(frReq);
            setLeaderboard(lb);
            setHeatmap(hm);
            setReferralInfo(ref);
            setPlans(plns || []);
            setSessions(sess || []);
            setCharNameInput(u.character_name || "Minti");
            const activeThm = u.active_theme || "default";
            document.documentElement.setAttribute("data-user-theme", activeThm);
            localStorage.setItem("studymate_active_theme", activeThm);
        } catch (err) {
            console.error("Fetch error:", err);
        }
    };

    const handleSelectPlan = async (planId) => {
        try {
            const detail = await api(`/ai/plans/${planId}`);
            setSelectedPlan(detail);
        } catch (err) {
            notify(err.message, "error");
        }
    };

    const handleGeneratePlan = async (e) => {
        e.preventDefault();
        setPlannerLoading(true);
        try {
            const topicsList = plannerForm.topics.split(/[,،\n]+/).map(t => t.trim()).filter(Boolean);
            const res = await api("/ai/generate-plan", {
                method: "POST",
                body: JSON.stringify({
                    goal_title: plannerForm.goal_title,
                    target_date: plannerForm.target_date,
                    daily_hours: parseFloat(plannerForm.daily_hours) || 2.0,
                    topics: topicsList.length ? topicsList : ["General Review"],
                    lang: lang
                })
            });
            notify("نقشه راه درسی توسط هوش مصنوعی با موفقیت ساخته شد!", "success");
            setSelectedPlan(res);
            api("/ai/plans").then(setPlans).catch(() => {});
        } catch (err) {
            notify(err.message, "error");
        } finally {
            setPlannerLoading(false);
        }
    };

    const handleTogglePlanDay = async (planId, dayNum) => {
        try {
            const res = await api(`/ai/plans/${planId}/days/${dayNum}/toggle`, { method: "POST" });
            notify(res.message, "success");
            const updated = await api(`/ai/plans/${planId}`);
            setSelectedPlan(updated);
        } catch (err) {
            notify(err.message, "error");
        }
    };

    useEffect(() => {
        if (token) {
            fetchAllData();
            setShowAuthModal(false);
        }
    }, [token]);

    // Timer Interval
    useEffect(() => {
        let interval = null;
        if (timerRunning && !timerPaused && remainingSec > 0) {
            interval = setInterval(() => {
                setRemainingSec(prev => prev - 1);
            }, 1000);
        } else if (remainingSec === 0 && timerRunning) {
            handleCompleteSession();
        }
        return () => clearInterval(interval);
    }, [timerRunning, timerPaused, remainingSec]);

    const handleStartTimer = async (mins) => {
        try {
            const duration = mins || targetMins;
            setTargetMins(duration);
            setRemainingSec(duration * 60);
            const sess = await api("/pomodoro/start", {
                method: "POST",
                body: JSON.stringify({ topic: pomoTopic || "General Study", target_minutes: duration })
            });
            setActivePomoId(sess.id);
            setTimerRunning(true);
            setTimerPaused(false);
            setCharacterAnimState("study");
            notify("جلسه مطالعه شروع شد! تمرکزت رو حفظ کن.", "success");
        } catch (err) {
            notify(err.message, "error");
        }
    };

    const handlePauseResume = () => {
        setTimerPaused(prev => !prev);
    };

    const handleCompleteSession = async () => {
        if (!activePomoId) return;
        try {
            const res = await api(`/pomodoro/${activePomoId}/complete`, { method: "POST" });
            setTimerRunning(false);
            setActivePomoId(null);
            setCharacterAnimState("completed");
            setCompletedModal(res);
            notify(`آفرین! +${res.xp_earned} XP و +${res.coins_earned} سکه دریافت کردی! 🎉`, "success");
            fetchAllData();

            // Load optional quiz
            api(`/pomodoro/${activePomoId}/quiz?lang=${lang}`).then(q => setQuizData(q)).catch(() => {});
        } catch (err) {
            notify(err.message, "error");
        }
    };

    const handleAbandonSession = async () => {
        if (!activePomoId) return;
        try {
            await api(`/pomodoro/${activePomoId}/abandon`, { method: "POST" });
            setTimerRunning(false);
            setActivePomoId(null);
            setRemainingSec(targetMins * 60);
            setCharacterAnimState("idle");
            notify("جلسه لغو شد.", "warning");
        } catch (err) {
            notify(err.message, "error");
        }
    };

    // Auth Handlers
    const handleRegister = async (e) => {
        e.preventDefault();
        try {
            const res = await api("/auth/register", {
                method: "POST",
                body: JSON.stringify(authForm)
            });
            localStorage.setItem("studymate_token", res.access_token);
            setToken(res.access_token);
            setShowAuthModal(false);
            notify("به StudyMate خوش اومدی! اکانت شما ساخته شد.", "success");
        } catch (err) {
            notify(err.message, "error");
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await api("/auth/login", {
                method: "POST",
                body: JSON.stringify({ username: authForm.username, password: authForm.password })
            });
            localStorage.setItem("studymate_token", res.access_token);
            setToken(res.access_token);
            setShowAuthModal(false);
            notify("خوش آمدید!", "success");
        } catch (err) {
            notify(err.message, "error");
        }
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        try {
            const res = await api("/auth/forgot-password", {
                method: "POST",
                body: JSON.stringify({ username_or_email: authForm.username })
            });
            if (res.reset_token) {
                setForgotToken(res.reset_token);
                notify(`کد بازیابی صادر شد: ${res.reset_token}`, "info");
            }
        } catch (err) {
            notify(err.message, "error");
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        try {
            await api("/auth/reset-password", {
                method: "POST",
                body: JSON.stringify({
                    token: forgotToken,
                    new_password: newPassword,
                    confirm_password: newPasswordConfirm
                })
            });
            notify("رمز عبور با موفقیت تغییر یافت. اکنون وارد شوید.", "success");
            setAuthMode("login");
        } catch (err) {
            notify(err.message, "error");
        }
    };

    // Customization & Shop Handlers
    const handleBuyTheme = async (themeId) => {
        try {
            await api("/shop/buy", { method: "POST", body: JSON.stringify({ theme_id: themeId }) });
            await api("/shop/equip", { method: "POST", body: JSON.stringify({ theme_id: themeId }) });
            document.documentElement.setAttribute("data-user-theme", themeId);
            localStorage.setItem("studymate_active_theme", themeId);
            setPreviewTheme(null);
            notify("تم با موفقیت خریداری و فعال شد! ✨", "success");
            setCharacterAnimState("happy");
            setTimeout(() => setCharacterAnimState("idle"), 3000);
            fetchAllData();
        } catch (err) {
            notify(err.message, "error");
        }
    };

    const handleEquipTheme = async (themeId) => {
        try {
            await api("/shop/equip", { method: "POST", body: JSON.stringify({ theme_id: themeId }) });
            document.documentElement.setAttribute("data-user-theme", themeId);
            localStorage.setItem("studymate_active_theme", themeId);
            setPreviewTheme(null);
            notify("تم فعال شد!", "success");
            fetchAllData();
        } catch (err) {
            notify(err.message, "error");
        }
    };

    const handlePreviewTheme = (themeId) => {
        document.documentElement.setAttribute("data-user-theme", themeId);
        setPreviewTheme(themeId);
    };

    const handleCancelThemePreview = () => {
        const activeThm = user ? user.active_theme : "default";
        document.documentElement.setAttribute("data-user-theme", activeThm);
        setPreviewTheme(null);
    };

    const handleTryOn = (item) => {
        setPreviewItem(item);
        setCharacterAnimState("welcome");
        setTimeout(() => setCharacterAnimState("idle"), 2500);
    };

    const handleCancelPreview = () => {
        setPreviewItem(null);
        setCharacterAnimState("idle");
    };

    const handleBuyAccessory = async (item) => {
        try {
            await api("/shop/accessories/buy", {
                method: "POST",
                body: JSON.stringify({ item_id: item.id, category: item.category })
            });
            await api("/shop/accessories/equip", {
                method: "POST",
                body: JSON.stringify({ item_id: item.id, category: item.category })
            });
            setPreviewItem(null);
            notify(`${item.name_fa} با موفقیت خریداری و تجهیز شد! ✨`, "success");
            setCharacterAnimState("happy");
            setTimeout(() => setCharacterAnimState("idle"), 3500);
            fetchAllData();
        } catch (err) {
            notify(err.message, "error");
        }
    };

    const handleEquipAccessory = async (item) => {
        try {
            await api("/shop/accessories/equip", {
                method: "POST",
                body: JSON.stringify({ item_id: item.id, category: item.category })
            });
            setPreviewItem(null);
            notify(`${item.name_fa} تجهیز شد!`, "success");
            setCharacterAnimState("happy");
            setTimeout(() => setCharacterAnimState("idle"), 2500);
            fetchAllData();
        } catch (err) {
            notify(err.message, "error");
        }
    };

    const handleSaveCharacterName = async () => {
        try {
            await api("/character/name", {
                method: "PATCH",
                body: JSON.stringify({ character_name: charNameInput })
            });
            setShowNameModal(false);
            notify("نام دوست دیجیتال تغییر یافت!", "success");
            fetchAllData();
        } catch (err) {
            notify(err.message, "error");
        }
    };

    // Search & Friend Handlers
    const handleSearchUsers = async (q) => {
        setSearchUserQuery(q);
        if (q.trim().length >= 2) {
            try {
                const results = await api(`/users/search?q=${encodeURIComponent(q)}`);
                setSearchResults(results);
            } catch (err) {}
        } else {
            setSearchResults([]);
        }
    };

    const handleFriendAction = async (action, targetId, reqId) => {
        try {
            const res = await api("/friends/action", {
                method: "POST",
                body: JSON.stringify({ action, target_username_or_id: String(targetId || ""), request_id: reqId })
            });
            notify(res.message, "success");
            fetchAllData();
        } catch (err) {
            notify(err.message, "error");
        }
    };

    const formatTime = (totalSec) => {
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    return (
        <div className="flex h-screen overflow-hidden bg-[#FCF8F8] text-[#2D2525]">
            {/* Toast Notification */}
            {toast && (
                <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-lg font-bold text-sm flex items-center gap-2 border transition-all ${
                    toast.type === "error" ? "bg-rose-50 text-rose-700 border-rose-200" :
                    toast.type === "warning" ? "bg-amber-50 text-amber-700 border-amber-200" :
                    "bg-[#FBEFEF] text-[#2D2525] border-[#F5AFAF]"
                }`}>
                    <span>{toast.msg}</span>
                </div>
            )}

            {/* Sidebar Navigation */}
            <aside className="hidden md:flex flex-col w-64 bg-[#FBEFEF] border-e border-[#F9DFDF] p-6 justify-between select-none">
                <div className="space-y-6">
                    {/* Logo & Brand */}
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-[#F5AFAF] flex items-center justify-center shadow-md">
                            <span className="text-2xl">🌱</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-[#2D2525] tracking-tight">{t("app_title")}</h1>
                            <p className="text-xs text-[#8C7777] font-medium">{t("app_slogan")}</p>
                        </div>
                    </div>

                    {/* Navigation Links */}
                    <nav className="space-y-1.5 pt-4">
                        {[
                            { id: "dashboard", icon: "🏠", label: t("nav_dashboard") },
                            { id: "study", icon: "⏱️", label: t("nav_study") },
                            { id: "planner", icon: "📅", label: t("nav_planner") },
                            { id: "friends", icon: "👥", label: t("nav_friends") },
                            { id: "challenges", icon: "⚔️", label: t("nav_challenges") },
                            { id: "shop", icon: "🛍️", label: t("nav_shop") },
                            { id: "reports", icon: "📊", label: t("nav_reports") },
                            { id: "leaderboard", icon: "🏆", label: t("nav_leaderboard") },
                            { id: "referrals", icon: "🎁", label: t("nav_referrals") }
                        ].map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${
                                    activeTab === item.id
                                        ? "bg-[#F5AFAF] text-[#2D2525] shadow-sm translate-x-1"
                                        : "text-[#5A4A4A] hover:bg-[#F9DFDF] hover:text-[#2D2525]"
                                }`}
                            >
                                <span className="text-lg">{item.icon}</span>
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Companion Small Card in Sidebar */}
                {user && (
                    <div className="p-4 rounded-3xl bg-white border border-[#F9DFDF] shadow-sm text-center">
                        <div className="h-28">
                            <MintiCharacter3D
                                state={characterAnimState}
                                equippedHat={user.equipped_hat}
                                equippedGlasses={user.equipped_glasses}
                                equippedOutfit={user.equipped_outfit}
                                equippedAccessory={user.equipped_accessory}
                                equippedJewelry={user.equipped_jewelry}
                                size="sm"
                            />
                        </div>
                        <div className="flex items-center justify-center gap-1.5 mt-1">
                            <span className="font-extrabold text-sm text-[#2D2525]">{user.character_name || "Minti"}</span>
                            <button onClick={() => setShowNameModal(true)} className="text-xs text-[#8C7777] hover:text-[#2D2525]">✏️</button>
                        </div>
                        <p className="text-[11px] text-[#8C7777]">{t("minti_desc")}</p>
                    </div>
                )}
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Header */}
                <header className="h-20 bg-[#FCF8F8] border-b border-[#FBEFEF] px-6 sm:px-10 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg sm:text-xl font-black text-[#2D2525]">
                            {t("greeting_prefix")} {user ? user.username : ""}!
                        </h2>
                        <p className="text-xs text-[#8C7777]">{t("greeting_quote")}</p>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4">
                        {/* Language Toggle */}
                        <div className="flex items-center bg-[#FBEFEF] rounded-2xl p-1 border border-[#F9DFDF]">
                            <button
                                onClick={() => setLang("fa")}
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${lang === "fa" ? "bg-[#F5AFAF] text-[#2D2525]" : "text-[#8C7777]"}`}
                            >
                                FA
                            </button>
                            <button
                                onClick={() => setLang("en")}
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${lang === "en" ? "bg-[#F5AFAF] text-[#2D2525]" : "text-[#8C7777]"}`}
                            >
                                EN
                            </button>
                        </div>

                        {/* User Badges */}
                        {stats && (
                            <div className="hidden sm:flex items-center gap-3">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-[#FBEFEF] border border-[#F9DFDF] text-xs font-black">
                                    <span>🔥</span>
                                    <span>{stats.current_streak} {t("streak_days")}</span>
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-[#FBEFEF] border border-[#F9DFDF] text-xs font-black">
                                    <span>🪙</span>
                                    <span>{stats.coins}</span>
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-[#F5AFAF] text-[#2D2525] text-xs font-black shadow-sm">
                                    <span>Lv.{stats.level}</span>
                                </div>
                            </div>
                        )}

                        {/* Auth / Profile Button */}
                        {user ? (
                            <button
                                onClick={() => { localStorage.removeItem("studymate_token"); setToken(""); setShowAuthModal(true); }}
                                className="w-10 h-10 rounded-2xl bg-[#FBEFEF] hover:bg-[#F9DFDF] border border-[#F9DFDF] flex items-center justify-center font-bold text-sm text-[#2D2525]"
                                title={t("logout")}
                            >
                                🚪
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowAuthModal(true)}
                                className="sm-btn-primary text-xs"
                            >
                                {t("auth_login_btn")}
                            </button>
                        )}
                    </div>
                </header>

                {/* Tab Views */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8">
                    {/* 1. DASHBOARD VIEW (MATCHING REFERENCE IMAGE 2 TOP RIGHT) */}
                    {activeTab === "dashboard" && (
                        <div className="max-w-6xl mx-auto space-y-6">
                            {/* Hero Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                {/* Left/Center Card: 3D Minti + Quick Focus Timer */}
                                <div className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-8 border border-[#F9DFDF] shadow-card flex flex-col justify-between relative overflow-hidden">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
                                            <span className="text-xs font-bold text-[#8C7777]">{t("study_power_quote")}</span>
                                        </div>
                                        <div className="px-3 py-1 rounded-xl bg-[#FBEFEF] border border-[#F9DFDF] text-xs font-extrabold text-[#2D2525]">
                                            {user ? user.character_name : "Minti"} 💖
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center my-auto">
                                        {/* 3D Animated Minti */}
                                        <div className="h-64 sm:h-72">
                                            <MintiCharacter3D
                                                state={timerRunning ? "study" : characterAnimState}
                                                equippedHat={user ? user.equipped_hat : null}
                                                equippedGlasses={user ? user.equipped_glasses : null}
                                                equippedOutfit={user ? user.equipped_outfit : "classic"}
                                                equippedAccessory={user ? user.equipped_accessory : "sprout"}
                                                equippedJewelry={user ? user.equipped_jewelry : null}
                                                size="md"
                                                onCharacterClick={() => setCharacterAnimState("happy")}
                                            />
                                        </div>

                                        {/* Circular Timer & Action Button */}
                                        <div className="flex flex-col items-center justify-center text-center space-y-4">
                                            <div className="relative w-44 h-44 flex items-center justify-center">
                                                <svg className="w-full h-full" viewBox="0 0 160 160">
                                                    <circle cx="80" cy="80" r="68" stroke="#FBEFEF" strokeWidth="12" fill="none" />
                                                    <circle
                                                        cx="80" cy="80" r="68"
                                                        stroke="#F5AFAF" strokeWidth="12" fill="none"
                                                        strokeDasharray={2 * Math.PI * 68}
                                                        strokeDashoffset={(2 * Math.PI * 68) * (1 - (remainingSec / (targetMins * 60)))}
                                                        className="sm-timer-ring-fill"
                                                    />
                                                </svg>
                                                <div className="absolute flex flex-col items-center">
                                                    <span className="text-3xl font-black text-[#2D2525] tracking-tight">
                                                        {formatTime(remainingSec)}
                                                    </span>
                                                    <span className="text-xs font-semibold text-[#8C7777]">{timerRunning ? "تمرکز عمیق" : "آماده"}</span>
                                                </div>
                                            </div>

                                            {/* Action Button */}
                                            {timerRunning ? (
                                                <div className="flex items-center gap-3">
                                                    <button onClick={handlePauseResume} className="sm-btn-secondary px-5 py-2.5 text-xs">
                                                        {timerPaused ? t("timer_resume") : t("timer_pause")}
                                                    </button>
                                                    <button onClick={handleAbandonSession} className="px-5 py-2.5 rounded-2xl bg-rose-50 text-rose-600 font-bold text-xs hover:bg-rose-100">
                                                        {t("timer_end")}
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleStartTimer(25)}
                                                    className="sm-btn-primary px-8 py-3.5 text-sm w-48 shadow-soft flex items-center justify-center gap-2"
                                                >
                                                    <span>{t("start_study")}</span>
                                                    <span>➔</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Goals & Cyber Boss Cards */}
                                <div className="lg:col-span-4 space-y-6">
                                    {/* Daily Goal Card */}
                                    <div className="bg-white rounded-3xl p-6 border border-[#F9DFDF] shadow-card space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">🎯</span>
                                                <span className="font-extrabold text-sm">{t("today_goal")}</span>
                                            </div>
                                            <span className="text-xs font-bold text-[#8C7777]">
                                                {stats ? `${stats.today_study_hours} / ${stats.today_goal_hours} ${t("hours_short")}` : "0 / 2"}
                                            </span>
                                        </div>
                                        <div className="w-full bg-[#FBEFEF] rounded-full h-3 overflow-hidden">
                                            <div
                                                className="bg-[#F5AFAF] h-full rounded-full transition-all duration-500"
                                                style={{ width: `${stats ? stats.today_goal_percentage : 0}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[11px] text-[#8C7777] font-semibold">
                                            <span>پیشرفت روز</span>
                                            <span>{stats ? stats.today_goal_percentage : 0}%</span>
                                        </div>
                                    </div>

                                    {/* Weekly Goal Card (20 Hours baseline requirement) */}
                                    <div className="bg-white rounded-3xl p-6 border border-[#F9DFDF] shadow-card space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">📅</span>
                                                <span className="font-extrabold text-sm">{t("weekly_goal")}</span>
                                            </div>
                                            <span className="text-xs font-bold text-[#8C7777]">
                                                {stats ? `${stats.weekly_study_hours} / 20 ${t("hours_short")}` : "0 / 20"}
                                            </span>
                                        </div>
                                        <div className="w-full bg-[#FBEFEF] rounded-full h-3 overflow-hidden">
                                            <div
                                                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                                                style={{ width: `${stats ? stats.weekly_goal_percentage : 0}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[11px] text-[#8C7777] font-semibold">
                                            <span>{t("weekly_goal_sub")}</span>
                                            <span>{stats ? stats.weekly_goal_percentage : 0}%</span>
                                        </div>
                                    </div>

                                    {/* Weekly Challenge: Defeat Cyber Boss Card */}
                                    {weeklyChallenge && (
                                        <div className="bg-gradient-to-br from-[#FBEFEF] to-[#F9DFDF] rounded-3xl p-6 border border-[#F5AFAF] shadow-card space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-extrabold text-[#2D2525]">⚔️ {weeklyChallenge.boss_name_fa}</span>
                                                <span className="text-[11px] font-bold text-[#8C7777]">{weeklyChallenge.days_remaining} {t("days_left")}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-xl shadow-md">
                                                    👾
                                                </div>
                                                <div className="flex-1 space-y-1.5">
                                                    <div className="w-full bg-white rounded-full h-2.5 overflow-hidden">
                                                        <div
                                                            className="bg-rose-500 h-full rounded-full transition-all"
                                                            style={{ width: `${weeklyChallenge.hp_percentage}%` }}
                                                        />
                                                    </div>
                                                    <div className="flex justify-between text-[11px] font-bold text-[#5A4A4A]">
                                                        <span>HP: {weeklyChallenge.current_hp} / {weeklyChallenge.max_hp}</span>
                                                        <span>{weeklyChallenge.hp_percentage}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button onClick={() => setActiveTab("challenges")} className="w-full py-2 rounded-2xl bg-white hover:bg-[#FCF8F8] text-[#2D2525] font-bold text-xs border border-[#F5AFAF]">
                                                مشاهده و حمله ➔
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Bottom Grid: Stats Row + Online Friends + Leaderboard Snippet */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Stats Summary */}
                                <div className="bg-white rounded-3xl p-6 border border-[#F9DFDF] shadow-card flex items-center justify-around">
                                    <div className="text-center">
                                        <span className="text-2xl">🔥</span>
                                        <p className="text-lg font-black text-[#2D2525] mt-1">{stats ? stats.current_streak : 0}</p>
                                        <p className="text-xs text-[#8C7777] font-bold">{t("streak_label")}</p>
                                    </div>
                                    <div className="h-10 w-px bg-[#FBEFEF]"></div>
                                    <div className="text-center">
                                        <span className="text-2xl">⭐</span>
                                        <p className="text-lg font-black text-[#2D2525] mt-1">{stats ? stats.xp : 0}</p>
                                        <p className="text-xs text-[#8C7777] font-bold">{t("xp_label")}</p>
                                    </div>
                                    <div className="h-10 w-px bg-[#FBEFEF]"></div>
                                    <div className="text-center">
                                        <span className="text-2xl">🪙</span>
                                        <p className="text-lg font-black text-[#2D2525] mt-1">{stats ? stats.coins : 0}</p>
                                        <p className="text-xs text-[#8C7777] font-bold">{t("coins_label")}</p>
                                    </div>
                                </div>

                                {/* Online Friends Snippet */}
                                <div className="bg-white rounded-3xl p-6 border border-[#F9DFDF] shadow-card flex flex-col justify-between">
                                    <div className="flex items-center justify-between">
                                        <span className="font-extrabold text-sm">{t("online_friends")}</span>
                                        <button onClick={() => setActiveTab("friends")} className="text-xs text-[#8C7777] font-bold hover:text-[#2D2525]">
                                            {t("view_all")}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 py-3">
                                        {friends.length > 0 ? (
                                            friends.slice(0, 4).map(f => (
                                                <div key={f.id} className="relative group">
                                                    <div className="w-10 h-10 rounded-2xl bg-[#FBEFEF] border border-[#F9DFDF] flex items-center justify-center font-bold text-xs">
                                                        {f.username[0].toUpperCase()}
                                                    </div>
                                                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white"></span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-xs text-[#8C7777]">هنوز دوستی آنلاین نیست.</p>
                                        )}
                                    </div>
                                    <button onClick={() => setActiveTab("friends")} className="text-xs font-bold text-[#F5AFAF] text-start">
                                        + افزودن دوست جدید
                                    </button>
                                </div>

                                {/* Leaderboard Snippet */}
                                <div className="bg-white rounded-3xl p-6 border border-[#F9DFDF] shadow-card flex flex-col justify-between">
                                    <div className="flex items-center justify-between">
                                        <span className="font-extrabold text-sm">{t("leaderboard_title")}</span>
                                        <button onClick={() => setActiveTab("leaderboard")} className="text-xs text-[#8C7777] font-bold hover:text-[#2D2525]">
                                            {t("view_all")}
                                        </button>
                                    </div>
                                    <div className="space-y-2 py-2">
                                        {leaderboard.slice(0, 3).map((lbUser, idx) => (
                                            <div key={lbUser.user_id} className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-[#8C7777]">{idx + 1}.</span>
                                                    <span className="font-extrabold text-[#2D2525]">{lbUser.username}</span>
                                                </div>
                                                <span className="font-bold text-[#8C7777]">{lbUser.total_study_hours}h</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="text-[11px] text-[#8C7777] font-semibold">
                                        رتبه شما: #{stats ? stats.leaderboard_rank : "-"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. STUDY TIMER VIEW (MATCHING REFERENCE IMAGE 2 MIDDLE LEFT) */}
                    {activeTab === "study" && (
                        <div className="max-w-4xl mx-auto space-y-6">
                            <div className="bg-white rounded-3xl p-8 border border-[#F9DFDF] shadow-card space-y-8 text-center">
                                {/* Header / Subject selector */}
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#FBEFEF] pb-6">
                                    <div className="text-start">
                                        <h3 className="text-2xl font-black text-[#2D2525]">{t("study_timer_title")}</h3>
                                        <p className="text-xs text-[#8C7777]">{t("pomo_rule_banner")}</p>
                                    </div>

                                    {/* Duration Preset Pills */}
                                    <div className="flex items-center gap-2">
                                        {[25, 50, 75].map(m => (
                                            <button
                                                key={m}
                                                disabled={timerRunning}
                                                onClick={() => { setTargetMins(m); setRemainingSec(m * 60); }}
                                                className={`px-4 py-2 rounded-2xl font-bold text-xs transition-all ${
                                                    targetMins === m
                                                        ? "bg-[#F5AFAF] text-[#2D2525] shadow-sm"
                                                        : "bg-[#FBEFEF] text-[#5A4A4A] hover:bg-[#F9DFDF]"
                                                }`}
                                            >
                                                {m} min
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Subject & Topic Input */}
                                <div className="max-w-md mx-auto">
                                    <input
                                        type="text"
                                        disabled={timerRunning}
                                        value={pomoTopic}
                                        onChange={(e) => setPomoTopic(e.target.value)}
                                        placeholder="نام درس یا مبحث (مثلاً ریاضی - فصل ۴: مثلثات)..."
                                        className="w-full px-5 py-3 rounded-2xl bg-[#FBEFEF] border border-[#F9DFDF] text-xs font-bold text-[#2D2525] focus:outline-none focus:border-[#F5AFAF] text-center"
                                    />
                                </div>

                                {/* 3D Character in Study Desk Mode + Timer */}
                                <div className="flex flex-col md:flex-row items-center justify-center gap-10">
                                    <div className="w-56 h-56">
                                        <MintiCharacter3D
                                            state={timerRunning ? "study" : "idle"}
                                            equippedHat={user ? user.equipped_hat : null}
                                            equippedGlasses={user ? user.equipped_glasses : null}
                                            equippedOutfit={user ? user.equipped_outfit : "classic"}
                                            equippedAccessory={user ? user.equipped_accessory : "sprout"}
                                            equippedJewelry={user ? user.equipped_jewelry : null}
                                            size="md"
                                        />
                                    </div>

                                    {/* Huge Circular Timer */}
                                    <div className="relative w-56 h-56 flex items-center justify-center">
                                        <svg className="w-full h-full" viewBox="0 0 200 200">
                                            <circle cx="100" cy="100" r="85" stroke="#FBEFEF" strokeWidth="14" fill="none" />
                                            <circle
                                                cx="100" cy="100" r="85"
                                                stroke="#F5AFAF" strokeWidth="14" fill="none"
                                                strokeDasharray={2 * Math.PI * 85}
                                                strokeDashoffset={(2 * Math.PI * 85) * (1 - (remainingSec / (targetMins * 60)))}
                                                className="sm-timer-ring-fill"
                                            />
                                        </svg>
                                        <div className="absolute flex flex-col items-center">
                                            <span className="text-4xl font-black text-[#2D2525] tracking-tight">
                                                {formatTime(remainingSec)}
                                            </span>
                                            <span className="text-xs font-bold text-[#8C7777] mt-1">
                                                {timerRunning ? "تمرکز عمیق" : "آماده برای شروع"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Reward Preview Card */}
                                <div className="inline-flex items-center gap-6 px-6 py-3 rounded-2xl bg-[#FBEFEF] border border-[#F9DFDF]">
                                    <span className="text-xs font-extrabold text-[#2D2525]">{t("session_rewards_preview")}</span>
                                    <span className="text-xs font-black text-amber-600">⭐ +50 XP</span>
                                    <span className="text-xs font-black text-yellow-600">🪙 +{Math.floor(targetMins / 25) * 10 || 10} سکه</span>
                                    <span className="text-[11px] text-[#8C7777]">({t("session_rewards_sub")})</span>
                                </div>

                                {/* Action Controls */}
                                <div className="flex items-center justify-center gap-4 pt-4">
                                    {timerRunning ? (
                                        <>
                                            <button onClick={handlePauseResume} className="sm-btn-secondary px-6 py-3 text-sm">
                                                {timerPaused ? t("timer_resume") : t("timer_pause")}
                                            </button>
                                            <button onClick={handleAbandonSession} className="px-6 py-3 rounded-2xl bg-rose-50 text-rose-600 font-bold text-sm hover:bg-rose-100">
                                                {t("timer_end")}
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => handleStartTimer()}
                                            className="sm-btn-primary px-10 py-4 text-base shadow-soft"
                                        >
                                            {t("timer_start")} ➔
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STUDY PLANNER VIEW (GEMINI AI ROADMAP) */}
                    {activeTab === "planner" && (
                        <div className="max-w-4xl mx-auto space-y-6">
                            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#F9DFDF] shadow-card space-y-6">
                                <div className="border-b border-[#FBEFEF] pb-4">
                                    <h3 className="text-xl font-black text-[#2D2525]">برنامه‌ریزی هوشمند درسی 📅</h3>
                                    <p className="text-xs text-[#8C7777] mt-1">تولید نقشه راه روزبه‌روز با هوش مصنوعی بر اساس موعد امتحان و اولویت‌های شما</p>
                                </div>

                                <form onSubmit={handleGeneratePlan} className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-3xl bg-[#FCF8F8] border border-[#F9DFDF]">
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-[#8C7777] mb-1">عنوان هدف یا امتحان:</label>
                                        <input
                                            type="text"
                                            required
                                            value={plannerForm.goal_title}
                                            onChange={(e) => setPlannerForm({ ...plannerForm, goal_title: e.target.value })}
                                            placeholder="مثلاً: پایان‌ترم ریاضی و فیزیک..."
                                            className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#F9DFDF] text-xs font-bold text-[#2D2525] focus:outline-none focus:border-[#F5AFAF]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[#8C7777] mb-1">تاریخ موعد امتحان / هدف:</label>
                                        <input
                                            type="date"
                                            required
                                            value={plannerForm.target_date}
                                            onChange={(e) => setPlannerForm({ ...plannerForm, target_date: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#F9DFDF] text-xs font-bold text-[#2D2525] focus:outline-none focus:border-[#F5AFAF]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[#8C7777] mb-1">ساعت مطالعه روزانه:</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            min="1"
                                            max="12"
                                            value={plannerForm.daily_hours}
                                            onChange={(e) => setPlannerForm({ ...plannerForm, daily_hours: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#F9DFDF] text-xs font-bold text-[#2D2525] focus:outline-none focus:border-[#F5AFAF]"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-[#8C7777] mb-1">مباحث یا فصول اصلی (با ویرگول جدا کنید):</label>
                                        <input
                                            type="text"
                                            value={plannerForm.topics}
                                            onChange={(e) => setPlannerForm({ ...plannerForm, topics: e.target.value })}
                                            placeholder="مبحث ۱، مبحث ۲، حل تمرین، مرور جامع..."
                                            className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#F9DFDF] text-xs font-bold text-[#2D2525] focus:outline-none focus:border-[#F5AFAF]"
                                        />
                                    </div>
                                    <div className="sm:col-span-2 text-end">
                                        <button
                                            type="submit"
                                            disabled={plannerLoading}
                                            className="sm-btn-primary px-6 py-2.5 text-xs shadow-soft"
                                        >
                                            {plannerLoading ? "در حال خلق برنامه..." : "✨ تولید نقشه راه هوشمند"}
                                        </button>
                                    </div>
                                </form>

                                {plans.length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="font-extrabold text-sm text-[#2D2525]">برنامه‌های شما:</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {plans.map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => handleSelectPlan(p.id)}
                                                    className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all border ${
                                                        selectedPlan && selectedPlan.id === p.id
                                                            ? "bg-[#F5AFAF] text-[#2D2525] border-[#F5AFAF]"
                                                            : "bg-[#FCF8F8] text-[#5A4A4A] border-[#F9DFDF] hover:bg-[#FBEFEF]"
                                                    }`}
                                                >
                                                    {p.goal_title} ({p.daily_hours}h/روز)
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedPlan && (
                                    <div className="space-y-4 pt-4 border-t border-[#FBEFEF]">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-lg font-black text-[#2D2525]">{selectedPlan.goal_title}</h4>
                                                <p className="text-xs text-[#8C7777] mt-0.5">{selectedPlan.motivational_quote}</p>
                                            </div>
                                            <span className="text-xs font-extrabold px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                {selectedPlan.progress_percentage}% پیشرفت
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            {selectedPlan.schedule && selectedPlan.schedule.map(day => {
                                                const isDone = (selectedPlan.completed_days || []).includes(day.day_number);
                                                return (
                                                    <div
                                                        key={day.day_number}
                                                        onClick={() => handleTogglePlanDay(selectedPlan.id, day.day_number)}
                                                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                                                            isDone
                                                                ? "bg-emerald-50/60 border-emerald-200"
                                                                : "bg-[#FCF8F8] border-[#F9DFDF] hover:border-[#F5AFAF]"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold border ${
                                                                isDone ? "bg-emerald-500 text-white border-emerald-500" : "bg-white border-[#F9DFDF] text-[#8C7777]"
                                                            }`}>
                                                                {isDone ? "✓" : day.day_number}
                                                            </div>
                                                            <div>
                                                                <p className={`text-xs font-extrabold ${isDone ? "line-through text-[#8C7777]" : "text-[#2D2525]"}`}>
                                                                    روز {day.day_number}: {day.focus_topic}
                                                                </p>
                                                                <p className="text-[11px] text-[#8C7777]">{day.action_item}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-end">
                                                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#FBEFEF] text-[#8C7777]">
                                                                +{day.potential_coins} 🪙
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 3. WARDROBE & STORE VIEW (MATCHING REFERENCE IMAGE 1 & 2) */}
                    {activeTab === "shop" && (() => {
                        const previewHat = previewItem?.category === "hat" 
                            ? (previewItem.id === "none_hat" ? null : previewItem.id) 
                            : (user ? user.equipped_hat : null);

                        const previewGlasses = previewItem?.category === "glasses" 
                            ? (previewItem.id === "none_glasses" ? null : previewItem.id) 
                            : (user ? user.equipped_glasses : null);

                        const previewOutfit = previewItem?.category === "outfit" 
                            ? previewItem.id 
                            : (user ? user.equipped_outfit : "classic");

                        const previewAccessory = previewItem?.category === "accessory" 
                            ? previewItem.id 
                            : (user ? user.equipped_accessory : "sprout");

                        const previewJewelry = previewItem?.category === "jewelry" 
                            ? (previewItem.id === "none_jewelry" ? null : previewItem.id) 
                            : (user ? user.equipped_jewelry : null);

                        return (
                            <div className="max-w-6xl mx-auto space-y-6">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                    {/* Left: 3D Minti Live Wardrobe Preview */}
                                    <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-[#F9DFDF] shadow-card text-center space-y-4 sticky top-6">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-extrabold text-[#8C7777]">
                                                {previewItem ? "✨ پیش‌نمایش پرو آیتم" : "پیش‌نمایش زنده ۳بعدی"}
                                            </span>
                                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FBEFEF] text-xs font-black">
                                                <span>🪙 {stats ? stats.coins : 0}</span>
                                            </div>
                                        </div>

                                        {/* 3D Character Canvas */}
                                        <div className="h-80 relative">
                                            <MintiCharacter3D
                                                state={previewItem ? "welcome" : "idle"}
                                                equippedHat={previewHat}
                                                equippedGlasses={previewGlasses}
                                                equippedOutfit={previewOutfit}
                                                equippedAccessory={previewAccessory}
                                                equippedJewelry={previewJewelry}
                                                size="lg"
                                                characterName={user ? user.character_name : "Minti"}
                                            />
                                        </div>

                                        {/* 360-Degree Rotation Pill */}
                                        <div className="flex items-center justify-center gap-2 py-1 px-3 rounded-full bg-[#FBEFEF] text-[11px] font-bold text-[#8C7777] mx-auto w-fit">
                                            <span>🔄</span>
                                            <span>{t("rotate_hint")}</span>
                                        </div>

                                        {/* Item Try-On Action Card */}
                                        {previewItem && (
                                            <div className="p-4 rounded-3xl bg-[#FBEFEF] border-2 border-[#F5AFAF] text-start space-y-3 shadow-md animate-fade-in">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="text-3xl">{previewItem.icon}</span>
                                                        <div>
                                                            <span className="text-[10px] font-black text-rose-600 block uppercase tracking-wider">
                                                                ✨ {t("try_on")}
                                                            </span>
                                                            <h5 className="font-black text-sm text-[#2D2525]">{previewItem.name_fa}</h5>
                                                        </div>
                                                    </div>
                                                    <div className="text-end">
                                                        <span className="text-xs font-black text-[#2D2525] block">
                                                            {previewItem.price === 0 ? "رایگان" : `🪙 ${previewItem.price}`}
                                                        </span>
                                                        <span className={`text-[10px] font-black ${
                                                            previewItem.is_owned
                                                                ? "text-emerald-700"
                                                                : (stats && stats.coins >= previewItem.price ? "text-emerald-600" : "text-rose-500")
                                                        }`}>
                                                            {previewItem.is_owned
                                                                ? t("owned_badge")
                                                                : (stats && stats.coins >= previewItem.price ? t("afford_status_ok") : t("afford_status_low"))}
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-[#5A4A4A]">{previewItem.description_fa}</p>

                                                <div className="flex items-center gap-2 pt-1">
                                                    {previewItem.is_equipped ? (
                                                        <div className="flex-1 py-2 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold text-center">
                                                            ✓ {t("btn_equipped")}
                                                        </div>
                                                    ) : previewItem.is_owned ? (
                                                        <button
                                                            onClick={() => handleEquipAccessory(previewItem)}
                                                            className="sm-btn-primary flex-1 py-2 text-xs font-bold"
                                                        >
                                                            {t("btn_equip")}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            disabled={stats && stats.coins < previewItem.price}
                                                            onClick={() => handleBuyAccessory(previewItem)}
                                                            className="sm-btn-primary flex-1 py-2 text-xs font-bold disabled:opacity-50"
                                                        >
                                                            {t("btn_buy")} {previewItem.price} 🪙
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={handleCancelPreview}
                                                        className="px-3 py-2 rounded-xl bg-white border border-[#F9DFDF] text-[#5A4A4A] text-xs font-bold hover:bg-[#FCF8F8]"
                                                    >
                                                        {t("cancel_preview")}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-1">
                                            <h4 className="text-lg font-black text-[#2D2525]">{user ? user.character_name : "Minti"}</h4>
                                            <p className="text-xs text-[#8C7777]">{t("minti_bio")}</p>
                                        </div>

                                        <button
                                            onClick={() => setShowNameModal(true)}
                                            className="sm-btn-secondary w-full text-xs font-bold"
                                        >
                                            ✏️ {t("minti_edit_name")}
                                        </button>
                                    </div>

                                    {/* Right: Shop Catalog Tabs */}
                                    <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-[#F9DFDF] shadow-card space-y-6">
                                        {/* Tabs with Jewelry category included */}
                                        <div className="flex flex-wrap gap-2 border-b border-[#FBEFEF] pb-4">
                                            {[
                                                { id: "themes", label: t("tab_themes") },
                                                { id: "outfits", label: t("tab_outfits") },
                                                { id: "hats", label: t("tab_hats") },
                                                { id: "glasses", label: t("tab_glasses") },
                                                { id: "jewelry", label: t("tab_jewelry") },
                                                { id: "accessories", label: t("tab_accessories") }
                                            ].map(tab => (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => setShopTab(tab.id)}
                                                    className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition-all ${
                                                        shopTab === tab.id
                                                            ? "bg-[#F5AFAF] text-[#2D2525] shadow-sm"
                                                            : "bg-[#FBEFEF] text-[#5A4A4A] hover:bg-[#F9DFDF]"
                                                    }`}
                                                >
                                                    {tab.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Themes Tab (Coin themes matching Image 2: Jungle, Night, Spring, Snow, Space) */}
                                        {shopTab === "themes" && (
                                            <div className="space-y-4">
                                                {previewTheme && (
                                                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs font-bold text-amber-900">
                                                        <span>🎨 در حال پیش‌نمایش رنگ‌های تم زنده</span>
                                                        <button
                                                            onClick={handleCancelThemePreview}
                                                            className="px-3 py-1 rounded-xl bg-white border border-amber-300 text-xs font-bold hover:bg-amber-100"
                                                        >
                                                            بازگشت به تم قبلی
                                                        </button>
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {themes.map(th => (
                                                        <div
                                                            key={th.id}
                                                            className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                                                                th.is_active
                                                                    ? "border-emerald-400 bg-emerald-50/40"
                                                                    : previewTheme === th.id
                                                                    ? "border-[#F5AFAF] bg-[#FBEFEF] shadow-sm"
                                                                    : "border-[#F9DFDF] bg-[#FCF8F8]"
                                                            }`}
                                                        >
                                                            <div>
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <div className="w-8 h-8 rounded-xl shadow-inner border" style={{ backgroundColor: th.preview_color }}></div>
                                                                    <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-[#FBEFEF]">
                                                                        {th.price === 0 ? "رایگان" : `🪙 ${th.price}`}
                                                                    </span>
                                                                </div>
                                                                <h5 className="font-black text-sm text-[#2D2525]">{th.name_fa}</h5>
                                                                <p className="text-xs text-[#8C7777] mt-1">{th.description_fa}</p>
                                                            </div>

                                                            <div className="pt-3 flex items-center gap-2">
                                                                <button
                                                                    onClick={() => handlePreviewTheme(th.id)}
                                                                    className="px-3 py-2 rounded-xl bg-white border border-[#F9DFDF] text-xs font-bold text-[#5A4A4A] hover:bg-[#FBEFEF]"
                                                                >
                                                                    پیش‌نمایش
                                                                </button>
                                                                {th.is_active ? (
                                                                    <div className="flex-1 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-black text-center border border-emerald-200">
                                                                        ✓ {t("btn_equipped")}
                                                                    </div>
                                                                ) : th.is_owned ? (
                                                                    <button
                                                                        onClick={() => handleEquipTheme(th.id)}
                                                                        className="sm-btn-secondary flex-1 text-xs font-bold py-2"
                                                                    >
                                                                        {t("btn_equip")}
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        disabled={stats && stats.coins < th.price}
                                                                        onClick={() => handleBuyTheme(th.id)}
                                                                        className="sm-btn-primary flex-1 text-xs font-bold py-2 disabled:opacity-50"
                                                                    >
                                                                        {t("btn_buy")} {th.price} 🪙
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Accessories / Outfits / Hats / Glasses / Jewelry */}
                                        {shopTab !== "themes" && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {accessories
                                                    .filter(a => (
                                                        shopTab === "outfits" ? a.category === "outfit" :
                                                        shopTab === "hats" ? a.category === "hat" :
                                                        shopTab === "glasses" ? a.category === "glasses" :
                                                        shopTab === "jewelry" ? a.category === "jewelry" :
                                                        a.category === "accessory"
                                                    ))
                                                    .map(item => {
                                                        const isTryingOn = previewItem && previewItem.id === item.id;
                                                        const canAfford = stats && stats.coins >= item.price;
                                                        return (
                                                            <div
                                                                key={item.id}
                                                                onClick={() => handleTryOn(item)}
                                                                className={`p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between ${
                                                                    isTryingOn
                                                                        ? "border-2 border-[#F5AFAF] bg-[#FBEFEF] shadow-sm transform scale-[1.01]"
                                                                        : item.is_equipped
                                                                        ? "border-emerald-300 bg-emerald-50/20"
                                                                        : "border-[#F9DFDF] bg-[#FCF8F8] hover:border-[#F5AFAF]"
                                                                }`}
                                                            >
                                                                <div>
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <span className="text-3xl">{item.icon}</span>
                                                                        <div className="flex items-center gap-1.5">
                                                                            {isTryingOn && (
                                                                                <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-rose-100 text-rose-700">
                                                                                    در حال پرو
                                                                                </span>
                                                                            )}
                                                                            <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-[#FBEFEF]">
                                                                                {item.price === 0 ? "رایگان" : `🪙 ${item.price}`}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <h5 className="font-black text-sm text-[#2D2525]">{item.name_fa}</h5>
                                                                    <p className="text-xs text-[#8C7777] mt-1">{item.description_fa}</p>
                                                                </div>

                                                                <div className="pt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                                    <button
                                                                        onClick={() => handleTryOn(item)}
                                                                        className={`px-3 py-2 rounded-xl text-xs font-bold ${
                                                                            isTryingOn ? "bg-[#F5AFAF] text-[#2D2525]" : "bg-white border border-[#F9DFDF] text-[#5A4A4A] hover:bg-[#FBEFEF]"
                                                                        }`}
                                                                    >
                                                                        {t("try_on")}
                                                                    </button>

                                                                    {item.is_equipped ? (
                                                                        <div className="flex-1 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-black text-center border border-emerald-200">
                                                                            ✓ {t("btn_equipped")}
                                                                        </div>
                                                                    ) : item.is_owned ? (
                                                                        <button
                                                                            onClick={() => handleEquipAccessory(item)}
                                                                            className="sm-btn-secondary flex-1 text-xs font-bold py-2"
                                                                        >
                                                                            {t("btn_equip")}
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            disabled={!canAfford}
                                                                            onClick={() => handleBuyAccessory(item)}
                                                                            className="sm-btn-primary flex-1 text-xs font-bold py-2 disabled:opacity-50"
                                                                        >
                                                                            {t("btn_buy")} {item.price} 🪙
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* 4. CHALLENGES & BOSS FIGHT VIEW (MATCHING REFERENCE IMAGE 2 MIDDLE RIGHT) */}
                    {activeTab === "challenges" && (
                        <div className="max-w-4xl mx-auto space-y-6">
                            {weeklyChallenge ? (
                                <div className="bg-white rounded-3xl p-8 border border-[#F9DFDF] shadow-card space-y-8 text-center">
                                    <div>
                                        <span className="px-3 py-1 rounded-xl bg-rose-50 text-rose-700 font-extrabold text-xs">
                                            ⚔️ {t("weekly_challenge_title")}
                                        </span>
                                        <h3 className="text-3xl font-black text-[#2D2525] mt-2">{weeklyChallenge.boss_name_fa}</h3>
                                        <p className="text-xs text-[#8C7777] mt-1">{weeklyChallenge.description_fa}</p>
                                    </div>

                                    {/* Boss Visual Avatar & Health Bar */}
                                    <div className="max-w-md mx-auto space-y-4">
                                        <div className="w-32 h-32 rounded-3xl bg-slate-900 mx-auto flex items-center justify-center text-5xl shadow-lg border-2 border-rose-300 animate-pulse-subtle">
                                            👾
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="w-full bg-[#FBEFEF] rounded-full h-4 overflow-hidden border border-[#F9DFDF]">
                                                <div
                                                    className="bg-rose-500 h-full rounded-full transition-all duration-700"
                                                    style={{ width: `${weeklyChallenge.hp_percentage}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-xs font-bold text-[#5A4A4A]">
                                                <span>جان باس: {weeklyChallenge.current_hp} / {weeklyChallenge.max_hp}</span>
                                                <span>{weeklyChallenge.hp_percentage}% باقی‌مانده</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* User Contribution Card */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto text-start">
                                        <div className="p-4 rounded-2xl bg-[#FCF8F8] border border-[#F9DFDF]">
                                            <p className="text-xs text-[#8C7777] font-semibold">ضربه وارد شده توسط شما:</p>
                                            <p className="text-xl font-black text-rose-600 mt-1">{weeklyChallenge.user_damage} HP</p>
                                            <p className="text-[11px] text-[#8C7777]">({weeklyChallenge.user_contribution_percentage}% از کل ضربات)</p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-[#FCF8F8] border border-[#F9DFDF]">
                                            <p className="text-xs text-[#8C7777] font-semibold">پاداش تیمی شکست غول:</p>
                                            <p className="text-xl font-black text-amber-600 mt-1">🪙 {weeklyChallenge.reward_coins} + ⭐ {weeklyChallenge.reward_xp}</p>
                                            <p className="text-[11px] text-[#8C7777]">{weeklyChallenge.days_remaining} روز تا پایان چالش</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setActiveTab("study")}
                                        className="sm-btn-primary px-10 py-3.5 text-sm shadow-soft"
                                    >
                                        حمله با تایمر مطالعه (ادامه مبارزه) ⚔️
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-white rounded-3xl p-12 border border-[#F9DFDF] shadow-card text-center space-y-4">
                                    <span className="text-4xl animate-bounce inline-block">⚔️</span>
                                    <h4 className="text-lg font-black text-[#2D2525]">در حال بارگذاری چالش هفتگی...</h4>
                                    <button onClick={fetchAllData} className="sm-btn-secondary text-xs px-5 py-2">بارگذاری مجدد</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 5. FRIENDS & CLANS VIEW (MATCHING REFERENCE IMAGE 2 MIDDLE CENTER) */}
                    {activeTab === "friends" && (
                        <div className="max-w-4xl mx-auto space-y-6">
                            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#F9DFDF] shadow-card space-y-6">
                                {/* Search Bar */}
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={searchUserQuery}
                                        onChange={(e) => handleSearchUsers(e.target.value)}
                                        placeholder={t("search_users_ph")}
                                        className="w-full px-5 py-3.5 rounded-2xl bg-[#FBEFEF] border border-[#F9DFDF] text-xs font-bold text-[#2D2525] focus:outline-none focus:border-[#F5AFAF]"
                                    />
                                    {searchResults.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-[#F9DFDF] shadow-lg p-3 z-20 space-y-2">
                                            {searchResults.map(sr => (
                                                <div key={sr.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-[#FBEFEF]">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-xl bg-[#F5AFAF] flex items-center justify-center font-bold text-xs">
                                                            {sr.username[0].toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-extrabold text-xs text-[#2D2525]">{sr.username}</p>
                                                            <p className="text-[11px] text-[#8C7777]">{sr.character_name}</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleFriendAction("send", sr.username)}
                                                        className="sm-btn-primary text-xs px-3 py-1.5"
                                                    >
                                                        {t("btn_add_friend")}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Pending Requests */}
                                {friendRequests.length > 0 && (
                                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
                                        <h5 className="font-extrabold text-xs text-amber-800">درخواست‌های دوستی دریافتی ({friendRequests.length})</h5>
                                        <div className="space-y-2">
                                            {friendRequests.map(fr => (
                                                <div key={fr.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-amber-100">
                                                    <div>
                                                        <p className="font-bold text-xs text-[#2D2525]">{fr.sender_username}</p>
                                                        <p className="text-[10px] text-[#8C7777]">{fr.character_name}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleFriendAction("accept", null, fr.id)}
                                                            className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white font-bold text-xs"
                                                        >
                                                            {t("btn_accept")}
                                                        </button>
                                                        <button
                                                            onClick={() => handleFriendAction("reject", null, fr.id)}
                                                            className="px-3 py-1.5 rounded-xl bg-rose-100 text-rose-700 font-bold text-xs"
                                                        >
                                                            {t("btn_reject")}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Friends Cards List */}
                                <div className="space-y-3">
                                    <h5 className="font-black text-sm text-[#2D2525]">{t("tab_friends_list")} ({friends.length})</h5>
                                    {friends.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {friends.map(f => (
                                                <div key={f.id} className="p-4 rounded-3xl bg-[#FCF8F8] border border-[#F9DFDF] flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative">
                                                            <div className="w-12 h-12 rounded-2xl bg-white border border-[#F9DFDF] flex items-center justify-center font-black text-sm">
                                                                {f.username[0].toUpperCase()}
                                                            </div>
                                                            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white"></span>
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-extrabold text-sm text-[#2D2525]">{f.username}</span>
                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#FBEFEF] text-[#8C7777]">Lv.{f.level}</span>
                                                            </div>
                                                            <p className="text-xs text-[#8C7777]">{f.character_name} 🌱 • {f.study_hours}h مطالعه</p>
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={() => handleFriendAction("remove", f.id)}
                                                        className="text-xs text-rose-500 hover:text-rose-700 font-bold px-2 py-1"
                                                        title={t("btn_remove")}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-[#8C7777] text-center py-6">هنوز دوستی به لیست شما اضافه نشده است. با کادر بالا دوستانتان را جستجو کنید!</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 6. REFERRALS & PREMIUM VIEW */}
                    {activeTab === "referrals" && referralInfo && (
                        <div className="max-w-3xl mx-auto space-y-6">
                            <div className="bg-white rounded-3xl p-8 border border-[#F9DFDF] shadow-card space-y-6 text-center">
                                <div className="w-16 h-16 rounded-3xl bg-[#F5AFAF] mx-auto flex items-center justify-center text-3xl shadow-soft">
                                    🎁
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-[#2D2525]">{t("referrals_title")}</h3>
                                    <p className="text-xs text-[#8C7777] mt-1 max-w-md mx-auto">{t("referrals_hero_text")}</p>
                                </div>

                                <div className="p-6 rounded-3xl bg-[#FCF8F8] border border-[#F9DFDF] max-w-md mx-auto space-y-4">
                                    <div>
                                        <p className="text-xs font-bold text-[#8C7777]">{t("my_referral_code")}</p>
                                        <p className="text-2xl font-black text-[#2D2525] tracking-widest mt-1">{referralInfo.referral_code}</p>
                                    </div>
                                    <div className="flex items-center justify-center gap-3">
                                        <button
                                            onClick={() => { navigator.clipboard.writeText(referralInfo.referral_code); notify("کد معرف کپی شد!", "success"); }}
                                            className="sm-btn-primary text-xs py-2 px-5"
                                        >
                                            {t("copy_code")}
                                        </button>
                                        <button
                                            onClick={() => { navigator.clipboard.writeText(referralInfo.referral_link); notify("لینک دعوت کپی شد!", "success"); }}
                                            className="sm-btn-secondary text-xs py-2 px-5"
                                        >
                                            {t("copy_link")}
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto text-start">
                                    <div className="p-4 rounded-2xl bg-[#FBEFEF]">
                                        <p className="text-xs text-[#8C7777]">{t("successful_referrals")}</p>
                                        <p className="text-xl font-black text-[#2D2525] mt-1">{referralInfo.successful_referrals_count} نفر</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-[#FBEFEF]">
                                        <p className="text-xs text-[#8C7777]">{t("premium_status")}</p>
                                        <p className="text-sm font-black text-[#2D2525] mt-1">
                                            {referralInfo.is_premium ? t("premium_active") : t("premium_free")}
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-2 max-w-md mx-auto">
                                    <button
                                        onClick={() => setShowAchievementModal(true)}
                                        className="sm-btn-secondary w-full py-3 text-xs font-bold flex items-center justify-center gap-2"
                                    >
                                        <span>🌟</span>
                                        <span>{t("share_achievement")}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 7. PROGRESS REPORTS & STUDY ANALYTICS DASHBOARD */}
                    {activeTab === "reports" && (() => {
                        const now = new Date();
                        const periodDays = reportsPeriod === "week" ? 7 : reportsPeriod === "month" ? 30 : 9999;
                        const cutoffDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
                        const prevCutoffDate = new Date(now.getTime() - periodDays * 2 * 24 * 60 * 60 * 1000);

                        const filteredSessions = sessions.filter(s => {
                            const sDate = new Date(s.ended_at || s.started_at);
                            return sDate >= cutoffDate;
                        });

                        const prevSessions = sessions.filter(s => {
                            const sDate = new Date(s.ended_at || s.started_at);
                            return sDate >= prevCutoffDate && sDate < cutoffDate;
                        });

                        // 1. Total study time & period comparison
                        const currentMins = filteredSessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
                        const prevMins = prevSessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
                        const totalHours = Math.floor(currentMins / 60);
                        const remainingMins = currentMins % 60;

                        let periodComparisonText = t("period_first");
                        let periodComparisonClass = "bg-[#FBEFEF] text-[#8C7777]";
                        if (prevMins > 0) {
                            const pctDiff = Math.round(((currentMins - prevMins) / prevMins) * 100);
                            if (pctDiff > 0) {
                                periodComparisonText = `+${pctDiff}% ${t("period_comparison_positive")}`;
                                periodComparisonClass = "bg-emerald-100 text-emerald-800";
                            } else if (pctDiff < 0) {
                                periodComparisonText = `${pctDiff}% ${t("period_comparison_negative")}`;
                                periodComparisonClass = "bg-rose-100 text-rose-800";
                            } else {
                                periodComparisonText = "بدون تغییر نسبت به دوره قبل";
                                periodComparisonClass = "bg-slate-100 text-slate-700";
                            }
                        }

                        // 2. Count & averages
                        const sessionsCount = filteredSessions.length;
                        const avgDuration = sessionsCount > 0 ? Math.round(currentMins / sessionsCount) : 0;
                        const activeDaysSet = new Set(filteredSessions.map(s => (s.ended_at || s.started_at || "").slice(0, 10)));
                        const activeDaysCount = activeDaysSet.size;

                        // 3. Peak Day Calculation
                        const dayNamesFa = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
                        const dayTotals = [0, 0, 0, 0, 0, 0, 0];
                        filteredSessions.forEach(s => {
                            const dt = new Date(s.ended_at || s.started_at);
                            if (!isNaN(dt)) dayTotals[dt.getDay()] += (s.duration_minutes || 0);
                        });
                        let peakDayIdx = 0;
                        for (let i = 1; i < 7; i++) {
                            if (dayTotals[i] > dayTotals[peakDayIdx]) peakDayIdx = i;
                        }
                        const peakDayName = dayTotals[peakDayIdx] > 0 ? dayNamesFa[peakDayIdx] : "-";
                        const peakDayMins = dayTotals[peakDayIdx];

                        // 4. Daily Study Trend (Last 7 Days)
                        const last7Days = [];
                        for (let i = 6; i >= 0; i--) {
                            const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
                            const dateStr = d.toISOString().slice(0, 10);
                            const daySessions = sessions.filter(s => (s.ended_at || s.started_at || "").slice(0, 10) === dateStr);
                            const dayMins = daySessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
                            last7Days.push({
                                dateStr,
                                dayLabel: dayNamesFa[d.getDay()].slice(0, 2),
                                dayMins,
                                fullDayName: dayNamesFa[d.getDay()]
                            });
                        }
                        const maxDayMins = Math.max(...last7Days.map(d => d.dayMins), 60);

                        // 5. Subject / Course Breakdown
                        const courseBreakdown = {};
                        filteredSessions.forEach(s => {
                            const cName = s.course_name || s.topic || "مطالعه آزاد";
                            courseBreakdown[cName] = (courseBreakdown[cName] || 0) + (s.duration_minutes || 0);
                        });
                        const courseBreakdownList = Object.entries(courseBreakdown).map(([name, mins]) => ({
                            name,
                            mins,
                            percent: currentMins > 0 ? Math.round((mins / currentMins) * 100) : 0
                        })).sort((a, b) => b.mins - a.mins);

                        // 6. Session Duration Classification
                        const shortSessions = filteredSessions.filter(s => s.duration_minutes < 25).length;
                        const standardSessions = filteredSessions.filter(s => s.duration_minutes >= 25 && s.duration_minutes <= 50).length;
                        const deepSessions = filteredSessions.filter(s => s.duration_minutes > 50).length;

                        // 7. Selected Heatmap Day Details
                        const selectedDaySessions = selectedHeatmapDay
                            ? sessions.filter(s => (s.ended_at || s.started_at || "").slice(0, 10) === selectedHeatmapDay.date)
                            : [];

                        // 8. Streak Milestones Unlocked Status
                        const curStreak = stats ? stats.current_streak : 0;
                        const milestones = [
                            { days: 3, title: "جوانه تمرکز", icon: "🌱", desc: "۳ روز استریک پیاپی" },
                            { days: 7, title: "جنگجوی هفتگی", icon: "⚔️", desc: "۷ روز تعهد و استمرار" },
                            { days: 14, title: "عادت پولادین", icon: "🛡️", desc: "۱۴ روز مطالعه مداوم" },
                            { days: 30, title: "ارباب استادی‌میت", icon: "👑", desc: "یک ماه عادت ناگسستنی" }
                        ];

                        return (
                            <div className="max-w-5xl mx-auto space-y-6">
                                {/* Header & Period Selector */}
                                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#F9DFDF] shadow-card flex flex-col md:flex-row items-center justify-between gap-4">
                                    <div className="text-start space-y-1">
                                        <h3 className="text-2xl font-black text-[#2D2525]">{t("reports_title")}</h3>
                                        <p className="text-xs text-[#8C7777]">{t("reports_sub")}</p>
                                    </div>

                                    {/* Period Pills */}
                                    <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#FBEFEF] border border-[#F9DFDF]">
                                        {[
                                            { id: "week", label: t("period_week") },
                                            { id: "month", label: t("period_month") },
                                            { id: "all", label: t("period_all") }
                                        ].map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => setReportsPeriod(p.id)}
                                                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                                                    reportsPeriod === p.id
                                                        ? "bg-[#F5AFAF] text-[#2D2525] shadow-sm"
                                                        : "text-[#5A4A4A] hover:bg-white"
                                                }`}
                                            >
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Empty State if No Sessions Exist */}
                                {sessions.length === 0 ? (
                                    <div className="bg-white rounded-3xl p-10 border border-[#F9DFDF] shadow-card text-center space-y-6 max-w-lg mx-auto">
                                        <div className="w-24 h-24 rounded-full bg-[#FBEFEF] mx-auto flex items-center justify-center text-5xl">
                                            🌱
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="text-xl font-black text-[#2D2525]">{t("empty_reports_title")}</h4>
                                            <p className="text-xs text-[#8C7777] leading-relaxed">{t("empty_reports_desc")}</p>
                                        </div>
                                        <button
                                            onClick={() => setActiveTab("study")}
                                            className="sm-btn-primary px-8 py-3 text-xs font-bold shadow-soft"
                                        >
                                            ⏱️ {t("start_first_session")}
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {/* 4 Summary Cards */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                            {/* Card 1: Total Study Time */}
                                            <div className="p-5 rounded-3xl bg-white border border-[#F9DFDF] shadow-card space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-2xl">⏳</span>
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${periodComparisonClass}`}>
                                                        {periodComparisonText}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-[#8C7777]">{t("stat_total_time")}</p>
                                                    <h4 className="text-2xl font-black text-[#2D2525] mt-1">
                                                        {totalHours > 0 ? `${totalHours}h ` : ""}{remainingMins}m
                                                    </h4>
                                                </div>
                                                <p className="text-[11px] text-[#8C7777]">مجموع {currentMins} دقیقه تمرکز عمیق</p>
                                            </div>

                                            {/* Card 2: Completed Sessions */}
                                            <div className="p-5 rounded-3xl bg-white border border-[#F9DFDF] shadow-card space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-2xl">🎯</span>
                                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700">
                                                        تکمیل شده
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-[#8C7777]">{t("stat_sessions_count")}</p>
                                                    <h4 className="text-2xl font-black text-[#2D2525] mt-1">
                                                        {sessionsCount} جلسه
                                                    </h4>
                                                </div>
                                                <p className="text-[11px] text-[#8C7777]">در دوره انتخابی</p>
                                            </div>

                                            {/* Card 3: Avg Duration */}
                                            <div className="p-5 rounded-3xl bg-white border border-[#F9DFDF] shadow-card space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-2xl">⚡</span>
                                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700">
                                                        پومودورو
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-[#8C7777]">{t("stat_avg_duration")}</p>
                                                    <h4 className="text-2xl font-black text-[#2D2525] mt-1">
                                                        {avgDuration} دقیقه
                                                    </h4>
                                                </div>
                                                <p className="text-[11px] text-[#8C7777]">میانگین زمان هر بلاک تمرکز</p>
                                            </div>

                                            {/* Card 4: Active Days & Streak */}
                                            <div className="p-5 rounded-3xl bg-white border border-[#F9DFDF] shadow-card space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-2xl">🔥</span>
                                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700">
                                                        استریک {curStreak} روز
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-[#8C7777]">{t("stat_active_days")}</p>
                                                    <h4 className="text-2xl font-black text-[#2D2525] mt-1">
                                                        {activeDaysCount} روز فعال
                                                    </h4>
                                                </div>
                                                <p className="text-[11px] text-[#8C7777]">
                                                    بهترین استریک: {stats ? stats.longest_streak || curStreak : 0} روز
                                                </p>
                                            </div>
                                        </div>

                                        {/* Row 2: Charts & Productive Insights */}
                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                            {/* Left: 7-Day Study Minutes Bar Chart (8 Cols) */}
                                            <div className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-8 border border-[#F9DFDF] shadow-card space-y-6">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h4 className="font-black text-base text-[#2D2525]">روند ۷ روز اخیر مطالعه</h4>
                                                        <p className="text-xs text-[#8C7777]">دقایق مطالعه ثبت‌شده روزانه</p>
                                                    </div>
                                                    <div className="text-end">
                                                        <span className="text-xs font-bold text-[#8C7777]">پربازده‌ترین روز:</span>
                                                        <span className="text-xs font-black text-emerald-700 mx-1">{peakDayName}</span>
                                                    </div>
                                                </div>

                                                {/* Responsive SVG Bar Chart */}
                                                <div className="pt-4">
                                                    <div className="h-44 flex items-end justify-between gap-3 px-2 border-b border-[#FBEFEF] pb-2">
                                                        {last7Days.map((day, idx) => {
                                                            const barHeightPct = Math.max(8, Math.round((day.dayMins / maxDayMins) * 100));
                                                            const isPeak = day.dayMins > 0 && day.dayMins === Math.max(...last7Days.map(d => d.dayMins));
                                                            return (
                                                                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                                                                    <span className="text-[10px] font-black text-[#8C7777] opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        {day.dayMins}m
                                                                    </span>
                                                                    <div
                                                                        style={{ height: `${barHeightPct}%` }}
                                                                        className={`w-full rounded-2xl transition-all duration-500 relative ${
                                                                            isPeak
                                                                                ? "bg-[#F5AFAF] shadow-soft"
                                                                                : day.dayMins > 0
                                                                                ? "bg-[#F9DFDF] hover:bg-[#F5AFAF]"
                                                                                : "bg-[#FBEFEF]"
                                                                        }`}
                                                                        title={`${day.fullDayName}: ${day.dayMins} دقیقه`}
                                                                    />
                                                                    <span className="text-xs font-extrabold text-[#5A4A4A] mt-1">
                                                                        {day.dayLabel}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right: Goals & Session Types Breakdown (4 Cols) */}
                                            <div className="lg:col-span-4 bg-white rounded-3xl p-6 sm:p-8 border border-[#F9DFDF] shadow-card space-y-6 flex flex-col justify-between">
                                                <div>
                                                    <h4 className="font-black text-base text-[#2D2525]">اهداف و تمرکز</h4>
                                                    <p className="text-xs text-[#8C7777]">عملکرد روزانه و هفتگی</p>
                                                </div>

                                                {/* Daily Goal Bar */}
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-xs font-extrabold">
                                                        <span className="text-[#2D2525]">{t("today_goal")} (۲ ساعت)</span>
                                                        <span className="text-emerald-700">{stats ? stats.today_goal_percentage : 0}%</span>
                                                    </div>
                                                    <div className="w-full bg-[#FBEFEF] rounded-full h-3 overflow-hidden border border-[#F9DFDF]">
                                                        <div
                                                            className="bg-[#F5AFAF] h-full rounded-full transition-all duration-500"
                                                            style={{ width: `${Math.min(100, stats ? stats.today_goal_percentage : 0)}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Weekly Goal Bar */}
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-xs font-extrabold">
                                                        <span className="text-[#2D2525]">{t("weekly_goal")} (۲۰ ساعت)</span>
                                                        <span className="text-emerald-700">{stats ? stats.weekly_goal_percentage : 0}%</span>
                                                    </div>
                                                    <div className="w-full bg-[#FBEFEF] rounded-full h-3 overflow-hidden border border-[#F9DFDF]">
                                                        <div
                                                            className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                                                            style={{ width: `${Math.min(100, stats ? stats.weekly_goal_percentage : 0)}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Session Duration Distribution */}
                                                <div className="pt-2 border-t border-[#FBEFEF] space-y-2">
                                                    <span className="text-xs font-bold text-[#8C7777] block">{t("duration_breakdown")}</span>
                                                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                                        <div className="p-2 rounded-xl bg-[#FCF8F8] border border-[#F9DFDF]">
                                                            <p className="font-black text-[#2D2525]">{shortSessions}</p>
                                                            <p className="text-[10px] text-[#8C7777]">&lt; ۲۵ دقیقه</p>
                                                        </div>
                                                        <div className="p-2 rounded-xl bg-[#FBEFEF] border border-[#F9DFDF]">
                                                            <p className="font-black text-[#2D2525]">{standardSessions}</p>
                                                            <p className="text-[10px] text-[#8C7777]">۲۵-۵۰ دقیقه</p>
                                                        </div>
                                                        <div className="p-2 rounded-xl bg-[#F9DFDF] border border-[#F5AFAF]">
                                                            <p className="font-black text-[#2D2525]">{deepSessions}</p>
                                                            <p className="text-[10px] text-[#8C7777]">&gt; ۵۰ دقیقه</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Row 3: Subject Breakdown & Activity Heatmap Matrix */}
                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                            {/* Subject Breakdown (5 Cols) */}
                                            <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-8 border border-[#F9DFDF] shadow-card space-y-4">
                                                <div>
                                                    <h4 className="font-black text-base text-[#2D2525]">{t("subject_distribution")}</h4>
                                                    <p className="text-xs text-[#8C7777]">تفکیک زمان مطالعه بر حسب دروس</p>
                                                </div>

                                                <div className="space-y-3 pt-2">
                                                    {courseBreakdownList.length > 0 ? (
                                                        courseBreakdownList.map((c, i) => (
                                                            <div key={i} className="space-y-1">
                                                                <div className="flex justify-between text-xs font-bold text-[#2D2525]">
                                                                    <span>{c.name}</span>
                                                                    <span>{Math.floor(c.mins / 60)}h {c.mins % 60}m ({c.percent}%)</span>
                                                                </div>
                                                                <div className="w-full bg-[#FBEFEF] rounded-full h-2.5 overflow-hidden">
                                                                    <div
                                                                        className="h-full rounded-full transition-all duration-500"
                                                                        style={{
                                                                            width: `${c.percent}%`,
                                                                            backgroundColor: i === 0 ? "#F5AFAF" : i === 1 ? "#38BDF8" : i === 2 ? "#4ADE80" : "#FBBF24"
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="text-xs text-[#8C7777]">هنوز درسی ثبت نشده است.</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Activity Calendar Matrix Heatmap (7 Cols) */}
                                            <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-[#F9DFDF] shadow-card space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h4 className="font-black text-base text-[#2D2525]">{t("heatmap_activity_calendar")}</h4>
                                                        <p className="text-xs text-[#8C7777]">برای مشاهده جزئیات هر روز، روی خانه آن کلیک کنید</p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#8C7777]">
                                                        <span>کمتر</span>
                                                        <div className="w-2.5 h-2.5 rounded-sm bg-[#FBEFEF]" />
                                                        <div className="w-2.5 h-2.5 rounded-sm bg-emerald-200" />
                                                        <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
                                                        <div className="w-2.5 h-2.5 rounded-sm bg-emerald-600" />
                                                        <span>بیشتر</span>
                                                    </div>
                                                </div>

                                                {/* 12-Week Matrix */}
                                                <div className="p-4 rounded-2xl bg-[#FCF8F8] border border-[#F9DFDF] overflow-x-auto">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {heatmap.slice(-84).map((entry, idx) => {
                                                            const mins = entry ? entry.minutes : 0;
                                                            const bgCol = mins > 90 ? "bg-emerald-600 shadow-sm" :
                                                                          mins > 50 ? "bg-emerald-400" :
                                                                          mins > 0 ? "bg-emerald-200" : "bg-[#FBEFEF]";
                                                            const isSelected = selectedHeatmapDay && selectedHeatmapDay.date === entry.date;
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    onClick={() => setSelectedHeatmapDay(entry)}
                                                                    className={`w-3.5 h-3.5 rounded-sm cursor-pointer transition-transform hover:scale-125 ${bgCol} ${
                                                                        isSelected ? "ring-2 ring-[#F5AFAF] ring-offset-1" : ""
                                                                    }`}
                                                                    title={`${entry.date}: ${mins} دقیقه مطالعه (${entry.sessions_count || 0} جلسه)`}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Selected Day Details Pane */}
                                                {selectedHeatmapDay && (
                                                    <div className="p-3.5 rounded-2xl bg-[#FBEFEF] border border-[#F9DFDF] text-xs space-y-2 animate-fade-in">
                                                        <div className="flex items-center justify-between font-bold text-[#2D2525]">
                                                            <span>📅 تاریخ: {selectedHeatmapDay.date}</span>
                                                            <span className="font-black text-emerald-800">
                                                                {selectedHeatmapDay.minutes} دقیقه مطالعه ({selectedDaySessions.length} جلسه)
                                                            </span>
                                                        </div>
                                                        {selectedDaySessions.length > 0 ? (
                                                            <div className="space-y-1">
                                                                {selectedDaySessions.map(s => (
                                                                    <div key={s.id} className="flex justify-between text-[11px] text-[#5A4A4A] bg-white p-2 rounded-xl">
                                                                        <span>{s.topic || s.course_name || "جلسه تمرکز"}</span>
                                                                        <span className="font-bold">{s.duration_minutes} دقیقه</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-[11px] text-[#8C7777]">جزئیات بیشتری برای این تاریخ ثبت نشده است.</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Row 4: Streak Milestones & Honor Badges */}
                                        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#F9DFDF] shadow-card space-y-4">
                                            <div>
                                                <h4 className="font-black text-base text-[#2D2525]">{t("streak_milestones")}</h4>
                                                <p className="text-xs text-[#8C7777]">نشان‌های افتخار استمرار که با مطالعه منظم باز می‌شوند</p>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                                                {milestones.map((m, i) => {
                                                    const isUnlocked = curStreak >= m.days;
                                                    return (
                                                        <div
                                                            key={i}
                                                            className={`p-4 rounded-2xl border transition-all text-center space-y-2 ${
                                                                isUnlocked
                                                                    ? "border-amber-300 bg-amber-50/40 shadow-sm"
                                                                    : "border-[#F9DFDF] bg-[#FCF8F8] opacity-60"
                                                            }`}
                                                        >
                                                            <span className="text-3xl block">{m.icon}</span>
                                                            <h5 className="font-black text-sm text-[#2D2525]">{m.title}</h5>
                                                            <p className="text-[11px] text-[#8C7777]">{m.desc}</p>
                                                            <div className="pt-1">
                                                                {isUnlocked ? (
                                                                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                                                                        ✓ باز شده
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px]">
                                                                        🔒 نیاز به {m.days - curStreak} روز دیگر
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })()}

                    {/* 8. LEADERBOARD VIEW */}
                    {activeTab === "leaderboard" && (
                        <div className="max-w-4xl mx-auto space-y-6">
                            <div className="bg-white rounded-3xl p-8 border border-[#F9DFDF] shadow-card space-y-6">
                                <h3 className="text-xl font-black text-[#2D2525]">{t("leaderboard_title")}</h3>
                                <div className="space-y-3">
                                    {leaderboard.map((u, i) => (
                                        <div key={u.user_id} className="flex items-center justify-between p-4 rounded-2xl bg-[#FCF8F8] border border-[#F9DFDF]">
                                            <div className="flex items-center gap-3">
                                                <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${
                                                    i === 0 ? "bg-amber-400 text-white" :
                                                    i === 1 ? "bg-slate-300 text-slate-800" :
                                                    i === 2 ? "bg-amber-700 text-white" : "bg-[#FBEFEF] text-[#8C7777]"
                                                }`}>
                                                    {i + 1}
                                                </span>
                                                <div>
                                                    <p className="font-black text-sm text-[#2D2525]">{u.username}</p>
                                                    <p className="text-[11px] text-[#8C7777]">Lv.{u.level} • {u.title_fa}</p>
                                                </div>
                                            </div>
                                            <div className="text-end">
                                                <p className="font-black text-sm text-[#2D2525]">{u.total_study_hours} {t("hours_short")}</p>
                                                <p className="text-[11px] text-[#8C7777]">🪙 {u.total_coins_earned}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </main>

                {/* Mobile Bottom Navigation Bar */}
                <div className="md:hidden bg-white border-t border-[#F9DFDF] h-16 flex items-center justify-around px-2 z-30">
                    {[
                        { id: "dashboard", icon: "🏠", label: t("nav_dashboard") },
                        { id: "study", icon: "⏱️", label: t("nav_study") },
                        { id: "friends", icon: "👥", label: t("nav_friends") },
                        { id: "shop", icon: "🛍️", label: t("nav_shop") },
                        { id: "referrals", icon: "🎁", label: t("nav_referrals") }
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`flex flex-col items-center justify-center p-1 ${
                                activeTab === item.id ? "text-[#E59898]" : "text-[#8C7777]"
                            }`}
                        >
                            <span className="text-lg">{item.icon}</span>
                            <span className="text-[10px] font-bold">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Session Completed Celebration Modal (Matching Reference Image 1) */}
            {completedModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-4xl p-8 max-w-sm w-full border border-[#F9DFDF] shadow-2xl text-center space-y-6">
                        <div className="h-44">
                            <MintiCharacter3D
                                state="completed"
                                equippedHat={user ? user.equipped_hat : null}
                                equippedGlasses={user ? user.equipped_glasses : null}
                                equippedOutfit={user ? user.equipped_outfit : "classic"}
                                equippedAccessory={user ? user.equipped_accessory : "sprout"}
                                equippedJewelry={user ? user.equipped_jewelry : null}
                                size="md"
                            />
                        </div>
                        <div>
                            <h4 className="text-xl font-black text-[#2D2525]">{t("session_completed_title")}</h4>
                            <div className="flex items-center justify-center gap-4 mt-3">
                                <span className="px-4 py-2 rounded-2xl bg-amber-50 text-amber-700 font-black text-sm">
                                    ⭐ +{completedModal.xp_earned} XP
                                </span>
                                <span className="px-4 py-2 rounded-2xl bg-yellow-50 text-yellow-700 font-black text-sm">
                                    🪙 +{completedModal.coins_earned} سکه
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={() => setCompletedModal(null)}
                            className="sm-btn-primary w-full py-3.5 text-sm"
                        >
                            {t("session_completed_btn")}
                        </button>
                    </div>
                </div>
            )}

            {/* Achievement Card Modal (Matching Section 14) */}
            {showAchievementModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-4xl p-8 max-w-sm w-full border border-[#F9DFDF] shadow-2xl text-center space-y-6">
                        <div className="p-6 rounded-3xl bg-gradient-to-br from-[#FCF8F8] to-[#FBEFEF] border border-[#F5AFAF] space-y-4 shadow-sm">
                            <div className="h-36">
                                <MintiCharacter3D
                                    state="completed"
                                    equippedHat={user ? user.equipped_hat : null}
                                    equippedGlasses={user ? user.equipped_glasses : null}
                                    equippedOutfit={user ? user.equipped_outfit : "classic"}
                                    equippedAccessory={user ? user.equipped_accessory : "sprout"}
                                    equippedJewelry={user ? user.equipped_jewelry : null}
                                    size="sm"
                                    interactive={false}
                                />
                            </div>
                            <div>
                                <h4 className="text-xl font-black text-[#2D2525]">{user ? user.username : ""}</h4>
                                <p className="text-xs font-bold text-[#8C7777] mt-0.5">همراه وفادار: {user ? user.character_name : "Minti"} 🌱</p>
                            </div>
                            <div className="flex items-center justify-around py-2 border-t border-b border-[#F9DFDF] text-xs font-bold">
                                <div>
                                    <p className="text-[#8C7777]">سطح</p>
                                    <p className="text-sm font-black text-[#2D2525]">Lv.{stats ? stats.level : 1}</p>
                                </div>
                                <div>
                                    <p className="text-[#8C7777]">استریک</p>
                                    <p className="text-sm font-black text-rose-500">🔥 {stats ? stats.current_streak : 0} روز</p>
                                </div>
                                <div>
                                    <p className="text-[#8C7777]">کل مطالعه</p>
                                    <p className="text-sm font-black text-[#2D2525]">{stats ? stats.total_study_hours : 0}h</p>
                                </div>
                            </div>
                            <p className="text-[11px] text-[#8C7777] font-semibold">StudyMate • Small Steps, Big Dreams</p>
                        </div>

                        <div className="flex items-center justify-center gap-3">
                            <button
                                onClick={() => {
                                    const shareText = `من در استادی‌میت با همراهی ${user ? user.character_name : "Minti"} به استریک ${stats ? stats.current_streak : 0} روزه و سطح ${stats ? stats.level : 1} رسیدم! 🎉🌱`;
                                    navigator.clipboard.writeText(shareText);
                                    notify("متن دستاورد کپی شد!", "success");
                                }}
                                className="sm-btn-primary flex-1 text-xs py-3"
                            >
                                کپی متن دستاورد 📋
                            </button>
                            <button
                                onClick={() => setShowAchievementModal(false)}
                                className="sm-btn-secondary px-5 py-3 text-xs"
                            >
                                بستن
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Character Name Edit Modal */}
            {showNameModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-[#F9DFDF] shadow-xl space-y-4">
                        <h4 className="font-black text-base text-[#2D2525]">{t("minti_name_prompt")}</h4>
                        <input
                            type="text"
                            value={charNameInput}
                            onChange={(e) => setCharNameInput(e.target.value)}
                            maxLength={25}
                            className="w-full px-4 py-2.5 rounded-2xl bg-[#FBEFEF] border border-[#F9DFDF] text-sm font-bold text-[#2D2525] focus:outline-none"
                        />
                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button onClick={() => setShowNameModal(false)} className="sm-btn-secondary text-xs px-4 py-2">انصراف</button>
                            <button onClick={handleSaveCharacterName} className="sm-btn-primary text-xs px-5 py-2">ذخیره</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Auth Modal (Matching Reference Image 2 Top Left) */}
            {showAuthModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-4xl p-8 max-w-md w-full border border-[#F9DFDF] shadow-2xl space-y-6">
                        <div className="text-center space-y-2">
                            <div className="w-14 h-14 rounded-3xl bg-[#F5AFAF] mx-auto flex items-center justify-center text-2xl shadow-soft">
                                🌱
                            </div>
                            <h3 className="text-2xl font-black text-[#2D2525]">{t("auth_welcome")}</h3>
                            <p className="text-xs text-[#8C7777]">{t("auth_welcome_sub")}</p>
                        </div>

                        {/* Tabs */}
                        <div className="flex bg-[#FBEFEF] p-1.5 rounded-2xl">
                            <button
                                onClick={() => setAuthMode("login")}
                                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${authMode === "login" ? "bg-white text-[#2D2525] shadow-sm" : "text-[#8C7777]"}`}
                            >
                                {t("auth_login_tab")}
                            </button>
                            <button
                                onClick={() => setAuthMode("register")}
                                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${authMode === "register" ? "bg-white text-[#2D2525] shadow-sm" : "text-[#8C7777]"}`}
                            >
                                {t("auth_register_tab")}
                            </button>
                        </div>

                        {/* Login Form */}
                        {authMode === "login" && (
                            <form onSubmit={handleLogin} className="space-y-4">
                                <input
                                    type="text"
                                    required
                                    placeholder={t("username")}
                                    value={authForm.username}
                                    onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                                    className="w-full px-4 py-3 rounded-2xl bg-[#FBEFEF] border border-[#F9DFDF] text-xs font-bold text-[#2D2525] focus:outline-none"
                                />
                                <input
                                    type="password"
                                    required
                                    placeholder={t("password")}
                                    value={authForm.password}
                                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                                    className="w-full px-4 py-3 rounded-2xl bg-[#FBEFEF] border border-[#F9DFDF] text-xs font-bold text-[#2D2525] focus:outline-none"
                                />
                                <button type="submit" className="sm-btn-primary w-full py-3.5 text-xs">
                                    {t("login_cta")}
                                </button>
                                <div className="text-center">
                                    <button
                                        type="button"
                                        onClick={() => setAuthMode("forgot")}
                                        className="text-xs text-[#8C7777] hover:text-[#2D2525] font-semibold"
                                    >
                                        {t("forgot_password_link")}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Register Form (Username, Password, Confirm Password, Date of Birth, Referral Code) */}
                        {authMode === "register" && (
                            <form onSubmit={handleRegister} className="space-y-3.5">
                                <input
                                    type="text"
                                    required
                                    placeholder={t("username")}
                                    value={authForm.username}
                                    onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                                    className="w-full px-4 py-3 rounded-2xl bg-[#FBEFEF] border border-[#F9DFDF] text-xs font-bold text-[#2D2525] focus:outline-none"
                                />
                                <input
                                    type="password"
                                    required
                                    placeholder={t("password")}
                                    value={authForm.password}
                                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                                    className="w-full px-4 py-3 rounded-2xl bg-[#FBEFEF] border border-[#F9DFDF] text-xs font-bold text-[#2D2525] focus:outline-none"
                                />
                                <input
                                    type="password"
                                    required
                                    placeholder={t("confirm_password")}
                                    value={authForm.confirm_password}
                                    onChange={(e) => setAuthForm({ ...authForm, confirm_password: e.target.value })}
                                    className="w-full px-4 py-3 rounded-2xl bg-[#FBEFEF] border border-[#F9DFDF] text-xs font-bold text-[#2D2525] focus:outline-none"
                                />
                                <div>
                                    <label className="block text-[11px] font-bold text-[#8C7777] mb-1">{t("date_of_birth")}</label>
                                    <input
                                        type="date"
                                        required
                                        value={authForm.date_of_birth}
                                        onChange={(e) => setAuthForm({ ...authForm, date_of_birth: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-2xl bg-[#FBEFEF] border border-[#F9DFDF] text-xs font-bold text-[#2D2525] focus:outline-none"
                                    />
                                </div>
                                <input
                                    type="text"
                                    placeholder={t("referral_code_optional")}
                                    value={authForm.referral_code}
                                    onChange={(e) => setAuthForm({ ...authForm, referral_code: e.target.value })}
                                    className="w-full px-4 py-3 rounded-2xl bg-[#FBEFEF] border border-[#F9DFDF] text-xs font-bold text-[#2D2525] focus:outline-none"
                                />
                                <button type="submit" className="sm-btn-primary w-full py-3.5 text-xs">
                                    {t("register_cta")}
                                </button>
                            </form>
                        )}

                        {/* Forgot Password Flow */}
                        {authMode === "forgot" && (
                            <div className="space-y-4">
                                <p className="text-xs text-[#8C7777]">{t("forgot_password_desc")}</p>
                                <input
                                    type="text"
                                    placeholder={t("username")}
                                    value={authForm.username}
                                    onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                                    className="w-full px-4 py-3 rounded-2xl bg-[#FBEFEF] border border-[#F9DFDF] text-xs font-bold text-[#2D2525] focus:outline-none"
                                />
                                <button onClick={handleForgotPassword} className="sm-btn-secondary w-full py-2.5 text-xs">
                                    {t("send_recovery_code")}
                                </button>

                                {forgotToken && (
                                    <form onSubmit={handleResetPassword} className="space-y-3 pt-3 border-t border-[#FBEFEF]">
                                        <input
                                            type="text"
                                            required
                                            placeholder={t("reset_token_label")}
                                            value={forgotToken}
                                            onChange={(e) => setForgotToken(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-2xl bg-[#FBEFEF] border border-[#F9DFDF] text-xs font-bold text-[#2D2525]"
                                        />
                                        <input
                                            type="password"
                                            required
                                            placeholder={t("new_password_label")}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-2xl bg-[#FBEFEF] border border-[#F9DFDF] text-xs font-bold text-[#2D2525]"
                                        />
                                        <input
                                            type="password"
                                            required
                                            placeholder={t("confirm_password")}
                                            value={newPasswordConfirm}
                                            onChange={(e) => setNewPasswordConfirm(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-2xl bg-[#FBEFEF] border border-[#F9DFDF] text-xs font-bold text-[#2D2525]"
                                        />
                                        <button type="submit" className="sm-btn-primary w-full py-3 text-xs">
                                            {t("reset_password_btn")}
                                        </button>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
