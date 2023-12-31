import * as THREE from './build/three.module.js';
import { ARButton } from './jsm/webxr/ARButton.js';
import { VRButton } from './jsm/webxr/VRButton.js';
			//
import { OrbitControls } from './jsm/controls/OrbitControls.js';
import { GLTFLoader } from './jsm/loaders/GLTFLoader.js';
import { RGBELoader } from './jsm/loaders/RGBELoader.js';
import { RoughnessMipmapper } from './jsm/utils/RoughnessMipmapper.js';




var container;
var camera, scene, renderer;
var controller;

var reticle, pmremGenerator, current_object, controls, isAR, envmap;

var hitTestSource = null;
var hitTestSourceRequested = false;

init();
animate();

$(document).ready(function() {
    loadModel('1');
});

$("#ARButton").click(function(){
    current_object.visible = false;
    isAR = true;
});

$("#VRButton").click(function(){
    scene.background = envmap;
    scene.position.z = -2;
});

$("#place-button").click(function(){
    arPlace();
});

$("#force-button").click(function(){
    justForce();
});

function arPlace(){
    if ( reticle.visible ) {
        current_object.position.setFromMatrixPosition(reticle.matrix);
        current_object.visible = true;
    }
}

function justForce(){
    if(current_object != null){
    scene.remove(current_object);
    }
    loadModel('1');
    current_object.position.copy( camera.position );
    current_object.rotation.copy( camera.rotation );
    current_object.updateMatrix();
    current_object.visible = true;
}

function loadModel(model){

    new RGBELoader()
        .setDataType(THREE.UnsignedByteType)
        .setPath('textures/')
        .load('photo_studio_01_1k.hdr', function(texture){

            envmap = pmremGenerator.fromEquirectangular(texture).texture;

            scene.environment = envmap;
            texture.dispose();
            pmremGenerator.dispose();
            render();

            var loader = new GLTFLoader().setPath('3d/');
            loader.load(model + ".glb", function(glb) {

                current_object = glb.scene;
                scene.add(current_object);

                arPlace();

                var box = new THREE.Box3();
                box.setFromObject(current_object);
                box.center(controls.target);

                controls.update();
                render();
            });
        });
}

function init() {

    container = document.createElement( 'div' );
    document.getElementById("container").appendChild( container );

    scene = new THREE.Scene();
    window.scene = scene;

    camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.001, 200 );

    var directionalLight = new THREE.DirectionalLight(0xdddddd, 1);
    directionalLight.position.set(0, 5, 0).normalize();
    scene.add(directionalLight);

    var ambientLight = new THREE.AmbientLight(0x222222);
    scene.add(ambientLight);

				//

    renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.xr.enabled = true;
    container.appendChild( renderer.domElement );

    pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    controls = new OrbitControls(camera, renderer.domElement);
    controls.addEventListener('change', render);
    controls.minDistance = 2;
    controls.maxDistance = 10;
    controls.target.set(0, 0, -0.2);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    //VR SETUP
    //document.body.appendChild(VRButton.createButton(renderer));

    //AR SETUP

    let options = {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
        }

    options.domOverlay = { root: document.getElementById('content')};

    document.body.appendChild( ARButton.createButton(renderer, options));

        //document.body.appendChild( ARButton.createButton( renderer, { requiredFeatures: [ 'hit-test' ] } ) );

				//

    reticle = new THREE.Mesh(
        new THREE.RingBufferGeometry( 0.15, 0.2, 32 ).rotateX( - Math.PI / 2 ),
        new THREE.MeshBasicMaterial()
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add( reticle );

				//

    window.addEventListener( 'resize', onWindowResize, false );

    renderer.domElement.addEventListener('touchstart', function(e){
        e.preventDefault();
        touchDown=true;
        touchX = e.touches[0].pageX;
        touchY = e.touches[0].pageY;
    }, false);

    renderer.domElement.addEventListener('touchend', function(e){
        e.preventDefault();
        touchDown = false;
    }, false);

    renderer.domElement.addEventListener('touchmove', function(e){
        e.preventDefault();

        if(!touchDown){
            return;
        }

        deltaX = e.touches[0].pageX - touchX;
        deltaY = e.touches[0].pageY - touchY;
        touchX = e.touches[0].pageX;
        touchY = e.touches[0].pageY;

        rotateObject();

    }, false);

}

var touchDown, touchX, touchY, deltaX, deltaY;

function rotateObject(){
    if(current_object && reticle.visible){
        current_object.rotation.y += deltaX / 100;
    }
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

			//

function animate() {

    renderer.setAnimationLoop( render );
    requestAnimationFrame(animate);
    controls.update();

}

function render( timestamp, frame ) {

    if ( frame && isAR) {

        var referenceSpace = renderer.xr.getReferenceSpace();
        var session = renderer.xr.getSession();

        if ( hitTestSourceRequested === false ) {

            session.requestReferenceSpace( 'viewer' ).then( function ( referenceSpace ) {

                session.requestHitTestSource( { space: referenceSpace } ).then( function ( source ) {

                    hitTestSource = source;

                } );

            } );

            session.addEventListener( 'end', function () {

                hitTestSourceRequested = false;
                hitTestSource = null;

                isAR = false;

                reticle.visible = false;

                var box = new THREE.Box3();
                box.setFromObject(current_object);
                box.center(controls.target);

                document.getElementById("place-button").style.display = "none";
                document.getElementById("place-button").style.display = "none";

            } );

            hitTestSourceRequested = true;

        }

        if ( hitTestSource ) {

            var hitTestResults = frame.getHitTestResults( hitTestSource );

            if ( hitTestResults.length ) {

                var hit = hitTestResults[ 0 ];

                document.getElementById("place-button").style.display = "block";
                document.getElementById("force-button").style.display = "none";

                reticle.visible = true;
                reticle.matrix.fromArray( hit.getPose( referenceSpace ).transform.matrix );

            } else {

                reticle.visible = false;

                document.getElementById("place-button").style.display = "none";
                document.getElementById("force-button").style.display = "block";

            }

        }

    }

    renderer.render( scene, camera );

}
