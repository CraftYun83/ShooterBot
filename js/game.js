import * as CANNON from './cannon-es.js'
import * as THREE from './three.module.js'
import {GLTFLoader} from "./gltfloader.js"
import { PointerLockControlsCannon } from './PointerLockControlsCannon.js'
import {PointerLockControls} from "./PointerLockControls.js"

let camera, scene, renderer, controls, ping
let material

var tempname;
if (getQueryVariable("e")) {
    try {
        parseJwt(getQueryVariable("e"))
        tempname = parseJwt(getQueryVariable("e")).name
    } catch {
        alert("Google Authentication Failed. Defaulting To Random Username.")
        tempname = "Player"+Math.floor(Math.random() * 10000);
    }
} else {
    alert("Google Authentication Failed. Defaulting To Random Username.")
    tempname = "Player"+Math.floor(Math.random() * 10000);
}

var ws;
const usernameData = {username: tempname};
var players = {};
let world
var dead = false;
let messages = []
let clock = new THREE.Clock();
let loader = new GLTFLoader();;
const timeStep = 1 / 60;
let bullets = [];
let lastCallTime = performance.now()
let sphereShape
let sphereBody
let physicsMaterial
let noncontrols
let outWeapon;
let intersects;
let health;
let stabbing = false;
let gunModel = undefined;
let meleeModel = undefined;
let gunArmModel = undefined;
let normArmModel = undefined;
let meleeArmModel = undefined;
let playerModel = [];

let cameraShadow = new THREE.Object3D()
let raycaster;

const url = "localhost" // Testing Purposes
const msgicondiv = document.getElementById("message-icon")
const msgicon = document.getElementById("message-icon-svg")

var bar = new ProgressBar.SemiCircle(document.getElementById("healthBar"), {
    strokeWidth: 6,
    color: '#FFEA82',
    trailColor: '#eee',
    trailWidth: 1,
    easing: 'easeInOut',
    duration: 700,
    svgStyle: null,
    text: {
      value: '',
      alignToBottom: false
    },
    from: {color: '#FFEA82'},
    to: {color: '#ED6A5A'},
    // Set default step function for all animate calls
    step: (state, bar) => {
      bar.path.setAttribute('stroke', state.color);
      var value = Math.round(bar.value() * 100);
      if (value === 0) {
        bar.setText('');
      } else {
        bar.setText(value);
      }
  
      bar.text.style.color = "#ED6A5A";
    }
  });

  bar.text.style.fontFamily = "sans-serif";
  bar.text.style.fontSize = '2rem';

  bar.set(1.0)

function parseJwt (token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
};

function getQueryVariable(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) == variable) {
            return decodeURIComponent(pair[1]);
        }
    }
    return false;
}

function updateUser() {
    if (ws.readyState === WebSocket.CLOSED) return;
    ws.send(JSON.stringify({
        type: "pos",
        rot: cameraShadow.rotation,
        pos: sphereBody.position
    }))
}

function loadGunModel() {
    loader.load('../model/fpmodels/gun/model.glb',
    (gungltf)=>{
        gunModel = gungltf.scene
    })
    loader.load('../model/tpmodels/gun/model.glb',
    (armgltf)=>{
        gunArmModel = armgltf.scene
    })
}

function loadMeleeModel() {
    loader.load('../model/fpmodels/knife/model.glb',
    (knifegltf)=>{
        meleeModel = knifegltf.scene
    })
    loader.load('../model/tpmodels/knife/model.glb',
    (armgltf)=>{
        meleeArmModel = armgltf.scene
    })
}

function loadCharacterModel() {

    loader.load('../model/tpmodels/main/head.glb',
        (headgltf)=>{
            loader.load('../model/tpmodels/main/body.glb',
            (bodygltf)=>{
                playerModel = [headgltf.scene, bodygltf.scene]
            })
    })
    loader.load('../model/tpmodels/main/arms.glb',
    (armgltf)=>{
        normArmModel = armgltf.scene
    })
}

loadGunModel();
loadMeleeModel();
loadCharacterModel();

setTimeout(() => {
    function openChat() {
        var greyscreen = document.createElement("div")
        greyscreen.id = "greyscreen"
        document.body.appendChild(greyscreen)
        greyscreen.innerHTML += '<svg xmlns="http://www.w3.org/2000/svg" id="cancelButton" class="icon icon-tabler icon-tabler-x" width="5vw" height="5vw" viewBox="0 0 24 24" stroke-width="1.5" stroke="#ffffff" fill="none" stroke-linecap="round" stroke-linejoin="round"> <path stroke="none" d="M0 0h24v24H0z" fill="none"/> <line x1="18" y1="6" x2="6" y2="18" /> <line x1="6" y1="6" x2="18" y2="18" /> </svg>'
        var cancelButton = document.getElementById("cancelButton")
        cancelButton.onclick = function (e) {
            document.body.removeChild(greyscreen)
        }
        var chatpopup = document.createElement("div")
        var messageEntry = document.createElement("input")
        var chatLogs = document.createElement("div")
    
        controls.unlock();
    
        chatLogs.id = "chatlog"
        messageEntry.id = "messageEntry"
        chatpopup.id = "chatpopup"
        greyscreen.appendChild(chatpopup)
        chatpopup.appendChild(chatLogs)
        chatpopup.appendChild(messageEntry)
    
        messages.forEach((element) => {
            document.getElementById("chatlog").innerHTML += "<h1>"+element.user+": "+element.message+"</h1>"
        })
    
    }
    
    document.addEventListener("keydown", (e) => {
        if (e.keyCode == 13) {
            if (document.getElementById("greyscreen") != null) {
                if (document.getElementById("messageEntry").value.replace(" ", "") !== "") {
                    ws.send("[chat]"+document.getElementById("messageEntry").value)
                    document.getElementById("messageEntry").value = ""
                }
            }
        }
    })
    
    msgicondiv.onmouseover = function (e) {
        msgicondiv.style.width = "4.5vw"
        msgicondiv.style.height = "4.5vw"
        msgicondiv.style.bottom = "0.75vw"
        msgicondiv.style.left = "0.75vw"
        msgicon.style.width = "3.5vw"
        msgicon.style.height = "3.5vw"
    }
    
    msgicondiv.onmouseout = function (e) {
        msgicondiv.style.width = "4vw"
        msgicondiv.style.height = "4vw"
        msgicondiv.style.bottom = "1vw"
        msgicondiv.style.left = "1vw"
        msgicon.style.width = "3vw"
        msgicon.style.height = "3vw"
    }
    
    msgicondiv.onclick = openChat
    
    if (location.protocol === 'https:') {
        ws = new WebSocket("wss://"+url);
    } else {
        ws = new WebSocket("ws://"+url);
    }
    
    initThree()
    initCannon()
    initPointerLock()
    
    ws.addEventListener("open", () =>{
        console.log("Connected as: "+usernameData.username)
    
        ws.send("[name]"+usernameData.username)
    
        clock.start();
    
        animate();
        updatePing();
        antiIdleKick();
    })
    
    ws.addEventListener('message', (data) => {
        var recdata = data.data
        if (recdata.startsWith("[pdata]")) {
            var tempdata = JSON.parse(recdata.replace("[pdata]", ""))
            if (tempdata[usernameData.username]["health"] != health) {
                if (!document.getElementById("hurtTint")) {
                    var hurtTint = document.createElement("div")
                    hurtTint.id = "hurtTint"
                    document.body.appendChild(hurtTint)
                    setTimeout(() => {
                        document.body.removeChild(hurtTint)
                    }, 100)
                }
                bar.animate(tempdata[usernameData.username]["health"]/100)
            }
            health = tempdata[usernameData.username]["health"]
            Object.entries(tempdata).forEach(([key, value]) => {
                if (players[key] == undefined) {
                    if (key !== usernameData.username) {
                        players[key] = value
                        players[key]["mesh"] = []
                        players[key]["mesh"].push(0)
                        players[key]["mesh"].push(1)
                        players[key]["mesh"][0] = playerModel[0].clone()
                        players[key]["mesh"][1] = playerModel[1].clone()
                        players[key]["mesh"][0].bodyType = "head"
                        players[key]["mesh"][1].bodyType = "body"
                        players[key]["mesh"][0].playerName = key
                        players[key]["mesh"][1].playerName = key
                        
                        players[key]["mesh"][0].position.x = value.position.x
                        players[key]["mesh"][0].position.y = value.position.y
                        players[key]["mesh"][0].position.z = value.position.z
                        players[key]["mesh"][1].position.x = value.position.x
                        players[key]["mesh"][1].position.y = value.position.y-0.53
                        players[key]["mesh"][1].position.z = value.position.z
    
                        players[key]["mesh"][0].rotation.x = value.rotation._x
                        players[key]["mesh"][0].rotation.y = value.rotation._y
                        players[key]["mesh"][0].rotation.z = value.rotation._z

                        players[key]["wpn"] = value.wpn

                        if (value.wpn === "melee") {
                            players[key]["mesh"][1].arms = meleeArmModel.clone()
                            players[key]["mesh"][1].add(players[key]["mesh"][1].arms)
                            players[key]["mesh"][1].arms.position.y = -4
                            players[key]["mesh"][1].arms.position.z = 0.1
                        } if (value.wpn === "gun") {
                            players[key]["mesh"][1].arms = gunArmModel.clone()
                            players[key]["mesh"][1].add(players[key]["mesh"][1].arms)
                            players[key]["mesh"][1].arms.position.y = -3.45
                            players[key]["mesh"][1].arms.position.x = -0.14
                        } if (value.wpn === "none") {
                            players[key]["mesh"][1].arms = normArmModel.clone()
                            players[key]["mesh"][1].add(players[key]["mesh"][1].arms)
                            players[key]["mesh"][1].arms.position.z = 0.1
                        }

                        players[key]["mesh"][1].arms.position.y = -4
                        
                        scene.add(players[key]["mesh"][0]);
                        scene.add(players[key]["mesh"][1]);
    
                        messages.push({
                            user: "Server",
                            message: key+" joined the game!"
                        })
    
                        if (document.getElementById("greyscreen") != null) {
                            document.getElementById("chatlog").innerHTML += "<h1>Server: "+key+" joined the game!</h1>"
                        }
                    }
                } else {
                    if (!_.isEqual(players[key], value)) {
                        if (value.health < players[key]["health"]) {
                            players[key]["mesh"][0].traverse((object) => {
                                if (object.isMesh) {
                                    let tempFirstMatColor = object.material.color.clone().getHex()
                                    object.material.color.setHex( 0xFF0000 );
                                    setTimeout(() => {
                                        if (object.isMesh) object.material.color.setHex( tempFirstMatColor );
                                    }, 250)
                                }
                            });
                            players[key]["mesh"][1].traverse((object) => {
                                if (object.isMesh) {
                                    let tempSecondMatColor = object.material.color.clone().getHex()
                                    object.material.color.setHex( 0xFF0000 );
                                    setTimeout(() => {
                                        if (object.isMesh) object.material.color.setHex( tempSecondMatColor );
                                    }, 125)
                                }
                            });
                        }
                        players[key]["health"] = value.health
                        players[key]["mesh"][0].position.x = value.position.x
                        players[key]["mesh"][0].position.y = value.position.y
                        players[key]["mesh"][0].position.z = value.position.z
                        players[key]["mesh"][1].position.x = value.position.x
                        players[key]["mesh"][1].position.y = value.position.y-0.53
                        players[key]["mesh"][1].position.z = value.position.z
    
                        players[key]["mesh"][0].rotation.x = value.rotation._x
                        players[key]["mesh"][0].rotation.y = value.rotation._y
                        players[key]["mesh"][0].rotation.z = value.rotation._z

                        if (value.wpn !== players[key]["wpn"]) {
                            players[key]["wpn"] = value.wpn
                            players[key]["mesh"][1].remove(players[key]["mesh"][1].arms)
                            
                            if (value.wpn === "melee") {
                                players[key]["mesh"][1].arms = meleeArmModel.clone()
                                players[key]["mesh"][1].add(players[key]["mesh"][1].arms)
                                players[key]["mesh"][1].arms.position.y = -4
                                players[key]["mesh"][1].arms.position.z = 0.1
                            } if (value.wpn === "gun") {
                                players[key]["mesh"][1].arms = gunArmModel.clone()
                                players[key]["mesh"][1].add(players[key]["mesh"][1].arms)
                                players[key]["mesh"][1].arms.position.y = -3.45
                                players[key]["mesh"][1].arms.position.x = -0.14
                            } if (value.wpn === "none") {
                                players[key]["mesh"][1].arms = normArmModel.clone()
                                players[key]["mesh"][1].add(players[key]["mesh"][1].arms)
                                players[key]["mesh"][1].arms.position.z = 0.1
                            }
                        }
    
                        var tor = Math.floor(value.rotation._z / 0.523599)
    
                        if (value.rotation._x > 0) {
                            players[key]["mesh"][1].rotation.y = -(tor * 0.349066)
                        } else {
                            players[key]["mesh"][1].rotation.y = (tor * 0.349066)
                        }
                    }
                }
            });
        } if (recdata.startsWith("[pleave]")) {
            var pleave = recdata.replace("[pleave]", "") 
            scene.remove(players[pleave]["mesh"][0])
            scene.remove(players[pleave]["mesh"][1])
            messages.push({
                user: "Server",
                message: pleave+" left the game!"
            })
    
            if (document.getElementById("greyscreen") != null) {
                document.getElementById("chatlog").innerHTML += "<h1>Server: "+pleave+" left the game!</h1>"
            }
    
            delete players[pleave]
        } if (recdata.startsWith("[ping]")) {
            ping = Math.abs((Date.now() - parseInt(recdata.replace("[ping]", ""))))
        } if (recdata.startsWith("[chat]")) {
            var msgJSON = JSON.parse(recdata.replace("[chat]", ""))
            if (msgJSON.user === usernameData.username) {
                msgJSON.user = msgJSON.user+" (YOU)"
            }
            messages.push(msgJSON)
            if (document.getElementById("greyscreen") != null) {
                if (msgJSON.user === usernameData.username) {
                    document.getElementById("chatlog").innerHTML += "<h1>"+msgJSON.user+" (YOU): "+msgJSON.message+"</h1>"
                } else {
                    document.getElementById("chatlog").innerHTML += "<h1>"+msgJSON.user+": "+msgJSON.message+"</h1>"
                }
            }
            
        }
    });
    
    function attack() {
        if (!outWeapon || !controls.enabled || ws.readyState === WebSocket.CLOSED) {
            return;
        }
    
        let validBodies = []
        for ( let i = 0; i < intersects.length; i ++ ) {
            if (intersects[ i ].object.parent.name.includes("robot")) {
                validBodies.push(intersects[i])
            }
        }
    
        let pps = []
        if (outWeapon[0] === "gun") {
            let bullet = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.05, 4, 8), new THREE.MeshBasicMaterial({
                color: "red"
            }));
        
            camera.getWorldPosition(bullet.position);
            bullet.quaternion.copy(cameraShadow.quaternion);
            scene.add(bullet);
            bullets.push(bullet);
    
            for ( let i = 0; i < validBodies.length; i ++ ) {
                if (!pps.includes(intersects[ i ].object.parent.parent.playerName)) {
                    pps.push(intersects[ i ].object.parent.parent.playerName)
                }
            }
        } if (outWeapon[0] === "melee" && !stabbing) {
            let validMeleeBodies = []
            for ( let i = 0; i < validBodies.length; i ++ ) {
                if (validBodies[ i ].object.position.distanceTo(sphereBody.position) < 1.5) {
                    validMeleeBodies.push(validBodies[i])
                }
            }
            for ( let i = 0; i < validMeleeBodies.length; i ++ ) {
                if (validMeleeBodies[ i ].object.position.distanceTo(sphereBody.position) < 1.5) {
                    if (!pps.includes(intersects[ i ].object.parent.parent.playerName)) {
                        pps.push(intersects[ i ].object.parent.parent.playerName)
                    }
                }
            }
            stabbing = true
            setTimeout(() => {
                outWeapon[1].rotation.y = 70
                outWeapon[1].position.z += 0.2
                setTimeout(() => {
                    outWeapon[1].rotation.y = 0
                    outWeapon[1].position.z -= 0.2
                    stabbing = false;
                }, 300)
            }, 300)
    
        }
    
        pps.forEach((element) => {
            ws.send("[dmg]"+element)
        })
    }
    
    window.onclick = attack
    
    function initThree() {
        
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    
        scene = new THREE.Scene()
        scene.background = new THREE.Color("skyblue")
        scene.fog = new THREE.Fog(0x000000, 0, 500)
    
        renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.setSize(window.innerWidth, window.innerHeight)
        renderer.setClearColor(scene.fog.color)
    
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap
    
        document.body.appendChild(renderer.domElement)
    
        const light = new THREE.PointLight( 0xFFFFFF, 10, 10000 );
        light.position.set(10, 9200, 20)
    
        scene.add(light)
    
        material = new THREE.MeshLambertMaterial({ color: 0x964B00 })
    
        const floorGeometry = new THREE.PlaneGeometry(300, 300, 100, 100)
        floorGeometry.rotateX(-Math.PI / 2)
        const floor = new THREE.Mesh(floorGeometry, material)
        floor.receiveShadow = true
        scene.add(floor)
    
        window.addEventListener('resize', onWindowResize)
    }
    
    function takeOutGun() {
        if (outWeapon) {
            camera.remove(outWeapon[1])
        }
        
        gunModel.position.set(0.2, -0.32, 0)
        camera.add(gunModel)
    
        outWeapon = ["gun", gunModel];
    
        ws.send("[wpn]gun")
    }
    
    function takeOutMelee() {
        if (outWeapon) {
            camera.remove(outWeapon[1])
        }
    
        meleeModel.position.set(-0.19, -4.5, 0.1)
        camera.add(meleeModel)
    
        outWeapon = ["melee", meleeModel];
    
        ws.send("[wpn]melee")
        
    }
    
    var down = false;
    document.addEventListener('keydown', function (e) {
        if(down) return;
        down = true;
    
        if (e.code.toLowerCase() === "keyr") {
            takeOutMelee()
        } if (e.code.toLowerCase() === "keyf") {
            takeOutGun()
        }
    }, false);
    
    document.addEventListener('keyup', function () {
        down = false;
    }, false);
    
    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
    }
    
    function initCannon() {
        world = new CANNON.World()
    
        world.defaultContactMaterial.contactEquationStiffness = 1e9
    
        world.defaultContactMaterial.contactEquationRelaxation = 4
    
        const solver = new CANNON.GSSolver()
        solver.iterations = 7
        solver.tolerance = 0.1
        world.solver = new CANNON.SplitSolver(solver)
    
        world.gravity.set(0, -20, 0)
    
        physicsMaterial = new CANNON.Material('physics')
        const physics_physics = new CANNON.ContactMaterial(physicsMaterial, physicsMaterial, {
            friction: 0.0,
            restitution: 0.0,
        })
    
        world.addContactMaterial(physics_physics)
        const radius = 1.3
        sphereShape = new CANNON.Sphere(radius)
        sphereBody = new CANNON.Body({ mass: 10, material: physicsMaterial })
        sphereBody.addShape(sphereShape)
        sphereBody.position.set(0, 5, 0)
        sphereBody.linearDamping = 0.9
        world.addBody(sphereBody)
    
        const groundShape = new CANNON.Plane()
        const groundBody = new CANNON.Body({ mass: 0, material: physicsMaterial })
        groundBody.addShape(groundShape)
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
        world.addBody(groundBody)
    }
    
    function initPointerLock() {
        controls = new PointerLockControlsCannon(camera, sphereBody)
        noncontrols = new PointerLockControls(cameraShadow, renderer.domElement)
        raycaster = new THREE.Raycaster();
    
        raycaster.far = 300
        raycaster.near = 0
    
        scene.add(controls.getObject())
    
        controls.maxPolarAngle = 2.0944
        controls.minPolarAngle = 1.0472
    
        noncontrols.maxPolarAngle = 2.0944
        noncontrols.minPolarAngle = 1.0472
    
        document.addEventListener('click', () => {
            if (document.getElementById("greyscreen")) {
                return;
            }
            controls.lock()
            noncontrols.lock()
        })
    
        controls.addEventListener('lock', () => {
            controls.enabled = true
        })
    
        controls.addEventListener('unlock', () => {
            controls.enabled = false
        })
    }
    
    var delta = 0;
    function animate() {
        requestAnimationFrame(animate)
    
        const time = performance.now() / 1000
        const dt = time - lastCallTime
        lastCallTime = time
    
        cameraShadow.position.copy(sphereBody.position)
    
        var speed = 75;
        delta = clock.getDelta();
        bullets.forEach(b => {
            b.translateZ(-speed * delta);
            if (b.position.distanceTo(sphereBody.position) > 250) {
                bullets.splice(bullets.indexOf(b), 1);
            }
        });
    
        if (health < 1 && !dead) {
            cancelAnimationFrame(animate);
            document.body.innerHTML = "<h1>You Died!</h1>"
            controls.disconnect()
            noncontrols.disconnect()
            dead = true;
            window.onclick = function() {}
            ws.close()
            return;
        }
    
        raycaster.setFromCamera( new THREE.Vector2(0, 0), camera );
    
        intersects = raycaster.intersectObjects( scene.children );
    
        world.step(timeStep, dt)
        updateUser()
    
        controls.update(dt)
        renderer.render(scene, camera)
    }
    
    function antiIdleKick() {
        if (ws.readyState === WebSocket.CLOSED) return;
        updateUser();
        setTimeout(() => {
            antiIdleKick()
        }, 10000)
    }
    
    function updatePing() {
        if (ws.readyState === WebSocket.CLOSED) return;
        document.getElementById("ping").textContent = "Ping: "+ping
        setTimeout(() => {
            updatePing()
        }, 500)
    }
    
    ws.onclose = function (event) {
        if (dead) return;
        cancelAnimationFrame(animate);
        document.body.innerHTML = "<h1>Server Closed</h1>"
        window.onclick = function() {}
        controls.disconnect()
        noncontrols.disconnect()
        ws.close()
        return;
    };
}, 2000)