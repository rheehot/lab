/**   _  _____ _   _   
*    | ||_   _| |_| |
*    | |_ | | |  _  |
*    |___||_| |_| |_|
*    @author lo.th / https://github.com/lo-th
*/



var view = ( function () {

'use strict';


var refEditor = null;
var refUser = null;

var setting = {
	correctLight: false,
    gammaInput: true,
    gammaOutput: true,
    exposure: 1.2,
    whitePoint: 1.0,
    type: "Filmic",
    envIntensity: 1.2,
    sunIntensity: 0.8,
    moonIntensity: 0.25,
};

var toneMappings = {
    None: THREE.NoToneMapping,
    Linear: THREE.LinearToneMapping,
    Reinhard: THREE.ReinhardToneMapping,
    Uncharted2: THREE.Uncharted2ToneMapping,
    Cineon: THREE.CineonToneMapping,
    Filmic: THREE.ACESFilmicToneMapping,
};

var tmpName = [];

//var pause = false;
var isPause = false;

var container = null;
var canvas = null;
var renderer = null;
var camera = null;
var controler = null;
var scene = null;
var content = null;
var followGroup = null;
var loader = null;
var envmap = null;
var environement = null;
var listener = null;
var mouse = null;
var offset = null;

var grid = null;
var ray = null;
var dragPlane = null;

var sun = null;
var moon = null;
var probe = null;
var sphereLight = null;
var camShadow = null;

var check = null;


var fog = null;

var matType = 'Standard';

var lightDistance = 200;
var shadowMat = null;
var shadowGround = null;
var isHighShadow = false;

var campHelper = null;

var isMobile = false;

var isDebug = false;
var isWithJoystick = false;
var isNeedUpdate = false;
var isWithShadow = false;
var isShadowDebug = false;
var isWithSky = false;

var isLight = false;
var isFog = false;
var isRay = false;
var needResize = false;

var t = [0,0,0,0];
var delta = 0;
var fps = 0;

var bg = bg || 0x222322;
var vs = { w:1, h:1, l:0, x:0, y:0 };

var agents = [];
var heros = [];
var cars = [];
var softs = [];
var bodys = [];
var solids = [];
var extraMesh = [];
var extraGeo = [];

var helper = [];

var mesh = {};
var geo = {};
var mat = {};
var txt = {};

var tmpTxt = {};
var tmpMat = {};

var isGl2 = false;
var isInContainer = false;

var autoAddAudio = null;


	
///

view = {

    pause: false,

    byName: {},

    loadCallback: function(){},
    tmpCallback: function(){},
    rayCallBack: function(){},
    resetCallBack: function(){},
    unPause: function(){},

    update: function(){},


    //-----------------------------
    //
    //  RENDER LOOP
    //
    //-----------------------------

    render: function ( stamp ) {

        requestAnimationFrame( view.render );

        t[0] = stamp === undefined ? now() : stamp;
        delta = ( t[0] - t[3] ) * 0.001;
        t[3] = t[0];

        if( view.pause ) isPause = true;
        if( isPause && !view.pause ){ isPause = false; view.unPause(); }

        if( needResize ) view.upResize();

        THREE.SEA3D.AnimationHandler.update( delta ); // sea3d animation

        if( refUser ) refUser.update(); // gamepad
        if( controler.enableDamping ) controler.update();

        TWEEN.update(); // tweener

        view.update( delta );

        renderer.render( scene, camera );

        // fps
        if ( (t[0] - 1000) > t[1] ){ t[1] = t[0]; fps = t[2]; t[2] = 0; }; t[2]++;

    },


    //-----------------------------
    //
    //  INIT THREE VIEW
    //
    //-----------------------------

    init: function ( Callback, noObj, Container, forceGL1, alpha ) {

        alpha = alpha !== undefined ? alpha : false;

        // 1 CANVAS / CONTAINER

        isMobile = this.getMobile();
        container = Container || null;

        canvas = document.createElementNS( 'http://www.w3.org/1999/xhtml', 'canvas' );
        canvas.style.cssText = 'position:absolute; top:0; left:0; pointer-events:auto;'//' image-rendering: pixelated;'

        if( !isMobile ){
            //document.oncontextmenu = function(e){ e.preventDefault(); };
            canvas.ondrop = function(e) { e.preventDefault(); };
        }

        // 2 RENDERER

        try {

            renderer = new THREE.WebGLRenderer( this.getGL( forceGL1, alpha ) );

        } catch( error ) {
            if( intro !== undefined ) intro.message('<p>Sorry, your browser does not support WebGL.</p>'
                        + '<p>This application uses WebGL to quickly draw</p>'
                        + '<p>Physics Labs can be used without WebGL, but unfortunately this application cannot.</p>'
                        + '<p>Have a great day!</p>');
            return;
        }

        console.log('THREE '+THREE.REVISION+' GL'+(isGl2 ? 2 : 1) );

        renderer.setClearColor( bg, (alpha !== undefined ? alpha : true) ? 0:1 );
        renderer.setPixelRatio( isMobile ? 1 : window.devicePixelRatio );

        // 3 CAMERA / CONTROLER / MOUSE

        camera = new THREE.PerspectiveCamera( 50 , 1 , 0.1, 20000 );
        //camera.position.set( 0, 15, 30 );
        controler = new THREE.OrbitControlsExtra( camera, renderer.domElement ); //this.canvas );
        controler.target.set( 0, 0, 0 );
        controler.enableKeys = false;
        controler.screenSpacePanning = true;
        controler.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
        controler.dampingFactor = 0.5;

        this.moveCam({ theta:0, phi:10, distance:30, target:[0,1,0], time:0 });

        mouse = new THREE.Vector3();
        offset = new THREE.Vector3();
        
        // 4 SCENE / GROUP

        scene = new THREE.Scene();

        content = new THREE.Group();
        scene.add( content );

        followGroup = controler.followGroup;
        scene.add( followGroup );

        extraMesh = new THREE.Group();
        scene.add( extraMesh );


        // 5 TEXTURE LOADER / ENVMAP

        loader = new THREE.TextureLoader();
        envmap = null;//new THREE.CubeTexture();
        
        // 6 RESIZE

        this.resize();
        window.addEventListener( 'resize', view.resize, false );

        // 7 KEYBOARD & JOSTICK 

        //if( !isMobile && user ) user.init();

        
        // 8 START BASE

        this.shaderHack();
        this.initGeometry();
        this.initMaterial();
        
        this.setTone();
        this.addLights();
        this.addShadow();
        this.initGrid();

        //if ( !noObj ) this.loadObject( 'basic', Callback );
        //else { if( Callback !== undefined ) Callback(); }

        if( container !== null ) container.appendChild( canvas );
        else document.body.appendChild( canvas );

        


        this.extandGroup();

        this.render( 0 );

        if( Callback !== undefined ) Callback();

    },


    //-----------------------------
    //
    //  RESET THREE VIEW
    //
    //-----------------------------

	reset: function ( full ) {

        this.resetCallBack();

        controler.resetFollow();

        this.setShadow();
        this.removeRay();
        this.removeSky();
        this.removeFog();
        this.resetLight();
        this.removeJoystick();
        this.removeShadowDebug();

        this.removeAudio();

        //isNeedUpdate = false;

        grid.visible = true;
        if( shadowGround !== null ) shadowGround.visible = true;

        while( extraMesh.children.length > 0 ) scene.remove( extraMesh.children.pop() );

        while( extraGeo.length > 0 ) extraGeo.pop().dispose();

        while( bodys.length > 0 ) this.clear( bodys.pop() );
        while( solids.length > 0 ) this.clear( solids.pop() );
        while( heros.length > 0 ) this.clear( heros.pop() );
        while( softs.length > 0 ) this.clear( softs.pop() );
        //while( terrains.length > 0 ) this.scene.remove( terrains.pop() );

        while( cars.length > 0 ){

            var c = cars.pop();
            if( c.userData.helper ){
                c.remove( c.userData.helper );
                c.userData.helper.dispose();
            }
            var i = c.userData.w.length;
            while( i-- ){
                scene.remove( c.userData.w[i] );
            }
            scene.remove( c );
        }
        

        this.update = function () {};
        this.tmpCallback = function(){};
        this.resetCallBack = function(){};

        this.byName = {};

        if( full ){

            for( var m in tmpTxt ){ tmpTxt[m].dispose(); tmpTxt[m] = undefined; }
            for( var m in tmpMat ){ tmpMat[m].dispose(); tmpMat[m] = undefined; }

            tmpMat = {};
            tmpTxt = {};

        }

    },

    clear: function ( b ) {

        var m;
        while( b.children.length > 0 ) {
            m = b.children.pop();
            while( m.children.length > 0 ) m.remove( m.children.pop() );
            b.remove( m );
        }

        if ( b.parent ) b.parent.remove( b );

    },

    //-----------------------------
    //
    //  EXTAND THREE GROUP
    //
    //-----------------------------

    extandGroup: function () {

        Object.defineProperty( THREE.Group.prototype, 'material', {
            get: function() { return this.children[0].material; },
            set: function( value ) { this.children.forEach( function ( b ) { b.material = value; });
                //var i = this.children.length;
                //while(i--) this.children[i].material = value; 
            }
        });
        
        Object.defineProperty( THREE.Group.prototype, 'receiveShadow', {
            get: function() { return this.children[0].receiveShadow; },
            set: function( value ) { this.children.forEach( function ( b ) { b.receiveShadow = value; }); }
        });

        Object.defineProperty( THREE.Group.prototype, 'castShadow', {
            get: function() { return this.children[0].castShadow; },
            set: function( value ) { this.children.forEach( function ( b ) { b.castShadow = value; }); }
        });

    },


    //-----------------------------
    //
    //  GET SYSTEM INFO
    //
    //-----------------------------

    getGL: function ( force, alpha ) {

        var gl;

        var options = { 
            antialias: isMobile ? false : true, alpha: alpha, 
            stencil:false, depth:true, precision: "highp", premultipliedAlpha:true, preserveDrawingBuffer:false 
        }

        if( !force ){
            gl = canvas.getContext( 'webgl2', options );
            if ( !gl ) gl = canvas.getContext( 'experimental-webgl2', options );
            isGl2 = !!gl;
        }

        if( !isGl2 ) {
            gl = canvas.getContext( 'webgl', options );
            if (!gl) gl = canvas.getContext( 'experimental-webgl', options );
        }

        options.canvas = canvas;
        options.context = gl;
        return options;

    },

    getMobile: function () {

        var n = navigator.userAgent;
        if (n.match(/Android/i) || n.match(/webOS/i) || n.match(/iPhone/i) || n.match(/iPad/i) || n.match(/iPod/i) || n.match(/BlackBerry/i) || n.match(/Windows Phone/i)) return true;
        else return false;  

    },


    //-----------------------------
    //
    //  GET
    //
    //-----------------------------

    getGL2: function () { return isGl2; },
    getFps: function () { return fps; },
    getEnvMap: function () { return envmap; },
    getAzimuthal: function (){ return -controler.getAzimuthalAngle(); },
    getGeo: function () { return geo; },
    getMat: function () { return mat; },
    
    getBody: function () { return bodys; },
    getSolid: function () { return solids; },
    getHero: function () { return heros; },

    //getPause: function () { return pause; },

    getControls: function () { return controler; },
    getControler: function () { return controler; },
    getCamera: function () { return camera; },
    getCamShadow: function () { return camShadow; },
    getMouse: function () { return mouse; },
    getDom: function () { return renderer.domElement; },

    getLoader:  function () { return loader; },
    getRenderer: function () { return renderer; },
    getScene: function () { return scene; },

    getSun: function () { return sun; },
    getMoon: function () { return moon; },
    getProbe: function () { return probe },
    getSphereLight: function () { return sphereLight; },
    //getLightProbe: function () { return lightProbe; },

    getLightDistance: function () { return lightDistance; },
    getFollowGroup:  function () { return followGroup; },
    getContent:  function () { return content; },


    //-----------------------------
    //
    //  SET
    //
    //-----------------------------

    setEditor: function ( v ) { refEditor = v; },
    
    setUser: function ( v ) {
        refUser = v; 
        if( !isMobile ) refUser.init(); 
    },

    //-----------------------------
    //
    //  FOCUS
    //
    //-----------------------------

    needFocus: function () {

        if( !refEditor )  return;
        canvas.addEventListener( 'mouseover', refEditor.unFocus, false );

    },

    haveFocus: function () {

        if( !refEditor )  return;
        canvas.removeEventListener( 'mouseover', refEditor.unFocus, false );

    },

    //-----------------------------
    //
    //  RESIZE
    //
    //-----------------------------

    setLeft: function ( x, y ) { 

        vs.x = x;
        vs.y = y;
        this.resize();

    },

	resize: function ( e ) {

        var w, h;

        if(container !== null ){
            w = container.offsetWidth - vs.x - vs.y;
            h = container.offsetHeight; 
        } else {
            w = window.innerWidth - vs.x - vs.y;
            h = window.innerHeight;
        }

		if( vs.w !== w || vs.h !== h ){

			vs.h = h;
            vs.w = w;

            needResize = true;

            if( refEditor ) refEditor.resizeMenu( vs.w );

		}
    },

    upResize: function () {

        canvas.style.left = vs.x +'px';
        camera.aspect = vs.w / vs.h;
        camera.updateProjectionMatrix();
        renderer.setSize( vs.w, vs.h );
        needResize = false;

    },


    //-----------------------------
    //
    //  LOADER
    //
    //-----------------------------

    getName: function ( url ) {

        return url.substring( url.lastIndexOf('/')+1, url.lastIndexOf('.') );

    },

    loadTexture: function ( name ){

        var n = this.getName( name );
        txt[ n ] = loader.load( './assets/textures/'+ name );
        return txt[ n ];

    },

    load: function ( Urls, Callback, autoPath, autoTexture ){

        pool.load( Urls, Callback, autoPath, autoTexture );

    },

    loadObject: function( Urls, Callback ){

        var urls = [];
        tmpName = [];

        if ( typeof Urls == 'string' || Urls instanceof String ){ 
            urls.push( './assets/models/'+ Urls + '.sea' );
            tmpName.push(  Urls );
        } else {
            for(var i=0; i < Urls.length; i++){
                urls.push( './assets/models/'+ Urls[i] + '.sea' );
                tmpName.push(  Urls[i] );
            }
        }
            
        this.loadCallback = Callback || function(){};
        this.tmpCallback = function(p){ this.afterLoad(p) }.bind( this );
        pool.load( urls, this.tmpCallback );

    },

    afterLoad: function ( p ) {

        var o, mesh, j;

        for(var i=0; i < tmpName.length; i++){

            o = p[ tmpName[i] ];
            j = o.length;

            while(j--){

                mesh = o[j];
                geo[mesh.name] = mesh.geometry;

                if( mesh.name === 'wheel' ){

                    geo['wheelR'] = geo.wheel.clone();
                    geo['wheelL'] = geo.wheel.clone();
                    geo.wheelL.rotateY( -Math.PI90 );
                    geo.wheelR.rotateY( Math.PI90 );

                }
                
            }

        }

        // test round geom
        //geo['box'] = new THREE.RoundedBoxGeometry(1,1,1, 0.01, 2)

        tmpName = [];
        this.loadCallback();

    },

    getTexture: function ( name ) {

        var t = pool.getResult()[name];

        if(t.isTexture){
            t.flipY = false;
            return t;
        }else{ // is img
            t = new THREE.Texture( t );
            t.needsUpdate = true;
            t.flipY = false;
            return t;
        }

    },

    getGeometry: function ( name, meshName ) {

        if(this.getMesh( name, meshName )) return this.getMesh( name, meshName ).geometry;
        else return null;

    },

    getMesh: function ( name, meshName ) {

        var m = pool.getMesh( name, meshName );
        if( m ){
            m.castShadow = true;
            m.receiveShadow = true;
        }
        return m;

    },

    add: function ( m ) {

        content.add( m );

    },

    remove: function ( m ) {

        content.remove( m );

    },

    addMesh: function ( m, castS, receiveS ) {

        m.castShadow = castS !== undefined ? castS : true;
        m.receiveShadow = receiveS !== undefined ? receiveS : true;

        extraMesh.add( m );

    },

    testMesh: function ( geom ) {

        var mesh = new THREE.Mesh( geom, mat.basic );
        this.addMesh( mesh );

    },


    //-----------------------------
    //
    // GEOMETRY
    //
    //-----------------------------

    initGeometry: function (){

        geo = {

            agent: new THREE.CircleBufferGeometry( 1, 3 ),
            circle: new THREE.CircleBufferGeometry( 1, 6 ),

            plane:      new THREE.PlaneBufferGeometry(1,1,1,1),
            box:        new THREE.BoxBufferGeometry(1,1,1),
            hardbox:    new THREE.BoxBufferGeometry(1,1,1),
            cone:       new THREE.CylinderBufferGeometry( 0,1,0.5 ),
            wheel:      new THREE.CylinderBufferGeometry( 1,1,1, 18 ),
            sphere:     new THREE.SphereBufferGeometry( 1, 16, 12 ),
            highsphere: new THREE.SphereBufferGeometry( 1, 32, 24 ),
            cylinder:   new THREE.CylinderBufferGeometry( 1,1,1,12,1 ),
            hardcylinder: new THREE.CylinderBufferGeometry( 1,1,1,12,1 ),

        }

        geo.circle.rotateX( -Math.PI90 );
        geo.agent.rotateX( -Math.PI90 );
        geo.agent.rotateY( -Math.PI90 );
        geo.plane.rotateX( -Math.PI90 );
        geo.wheel.rotateZ( -Math.PI90 );

    },


    //-----------------------------
    //
    // MATERIALS
    //
    //-----------------------------

    material: function ( option, type ){

        var name = option.name;

        if( tmpMat[ name ] ){

            for( var o in option ){
                if( o === 'color' ) this.tmpMat[ name ].color.setHex( option[o] );
                else tmpMat[ name ][o] = option[o];
            }

            return tmpMat[ name ];
        }

        type = type || matType;

        if( type !== 'Phong' ){
            delete( option.shininess ); 
            delete( option.specular );
        }

        if( type !== 'Standard' ){
            option.reflectivity = option.metalness || 0.5;
            delete( option.metalness ); 
            delete( option.roughness );
            delete( option.envMapIntensity );
        }

        option.envMap = envmap;
        
        option.shadowSide = option.shadowSide || null;

        tmpMat[ name ] = new THREE['Mesh'+type+'Material']( option );

        /*if( type === 'Standard' ){
            this.tmpMat[ name ].onBeforeCompile = function ( shader ) {

            }
        }*/

        return tmpMat[ name ];

    },

    makeMaterial: function ( option, type ){

        type = type || matType;

        if( type !== 'Phong' ){
            delete( option.shininess ); 
            delete( option.specular );
        }

        if( type !== 'Standard' ){
            option.reflectivity = option.metalness || 0.5;
            delete( option.metalness ); 
            delete( option.roughness );
            
        } else {
            option.envMapIntensity = setting.envIntensity;
        }

        option.envMap = envmap;
        
        //option.shadowSide = false;

        return new THREE['Mesh'+type+'Material']( option );

    },

    resetMaterial: function (){

        for( var m in this.mat ){
            this.mat[m].dispose();
        }

        this.initMaterial();

    },

    initMaterial: function (){

        //check = new THREE.Texture( this.makeCheck() );

        check = this.makeCheck();
        //check.needsUpdate = true;
        //check.repeat = new THREE.Vector2( 2, 2 );
        //check.wrapS = check.wrapT = THREE.RepeatWrapping;

        //http://www.color-hex.com/popular-colors.php

        mat = {

            white: this.makeMaterial({ color:0xFFFFFF, name:'basic',  metalness:0.5, roughness:0.5 }),

            ttest: new THREE.MeshBasicMaterial( { color: 0xffffff, depthTest:true, depthWrite:false } ),//this.makeMaterial({ color:0xFFFFFF, name:'basic', envMap:this.envmap, metalness:0, roughness:0 }),
           

            contactOn: this.makeMaterial({ color:0x33FF33, name:'contactOn', metalness:0.8, roughness:0.5 }),
            contactOff: this.makeMaterial({ color:0xFF3333, name:'contactOff', metalness:0.8, roughness:0.5 }),

            check: this.makeMaterial({ map:check, color:0x808080, name:'check', metalness:0.75, roughness:0.25 }),
            basic: this.makeMaterial({ color:0xDDDEDD, name:'basic',  metalness:0.7, roughness:0.5 }),
            movehigh: this.makeMaterial({ color:0xff4040, name:'movehigh', metalness:0.5, roughness:0.5 }),
            

            sleep: this.makeMaterial({ color:0x8080CC, name:'sleep', metalness:0.5, roughness:0.5 }),
            move: this.makeMaterial({  color:0xCCCCCC, name:'move', metalness:0.5, roughness:0.5 }),
            speed: this.makeMaterial({  color:0xCCAA80, name:'speed', metalness:0.5, roughness:0.5 }),

            statique: this.makeMaterial({ color:0x626362, name:'statique',  transparent:true, opacity:0.3, depthTest:true, depthWrite:false }),
            static: this.makeMaterial({ color:0x626362, name:'static',  transparent:true, opacity:0.3, depthTest:true, depthWrite:false, metalness:0.7, roughness:0.3, premultipliedAlpha:true }),
            plane: new THREE.MeshBasicMaterial({ color:0x111111, name:'plane', wireframe:true }),
           
            kinematic: this.makeMaterial({ name:'kinematic', color:0xD4AF37,  metalness:0.7, roughness:0.4 } ),//0xD4AF37
            donut: this.makeMaterial({ name:'donut', color:0xAA9933,  metalness:0.6, roughness:0.4 }),

            hide: this.makeMaterial({ color:0x000000, name:'hide', wireframe:true, visible:false }, 'Basic'),
            debug: this.makeMaterial({ color:0x11ff11, name:'debug', wireframe:true}, 'Basic'),
            skyUp: this.makeMaterial({ color:0xFFFFFF }, 'Basic'),

            hero: this.makeMaterial({ color:0xffffff, name:'hero', metalness:0.4, roughness:0.6, skinning:true }), 
            soft: this.makeMaterial({ vertexColors:THREE.VertexColors, name:'soft', transparent:true, opacity:0.9, side: THREE.DoubleSide }),

            shadow: new THREE.ShadowMaterial({ name:'shadow', opacity:0.4, depthWrite:false }), 

        }

        for( var m in mat ) mat[m].shadowSide = false;

    },

    /*addMaterial: function( option ) {

        var maptype = ['map', 'emissiveMap', 'lightMap', 'aoMap', 'alphaMap', 'normalMap', 'bumpMap', 'displacementMap', 'roughnessMap', 'metalnessMap'];

        var i = maptype.length;
        while(i--){
            if( option[maptype[i]] ){ 
                option[maptype[i]] = loader.load( './assets/textures/' + option[maptype[i]] );
                option[maptype[i]].flipY = false;
            }
        }
        
        option.envMap = envmap;
        

        mat[option.name] = this.makeMaterial( option );

    },*/

    addMap: function( url, name ) {

        if(mat[name]) return;

        var map = loader.load( './assets/textures/' + url );
        //map.wrapS = THREE.RepeatWrapping;
        //map.wrapT = THREE.RepeatWrapping;
        map.flipY = false;
        mat[name] = this.makeMaterial({ name:name, map:map, envMap:envmap, metalness:0.6, roughness:0.4, shadowSide:false });//

    },


    //-----------------------------
    //
    // TEXTURES
    //
    //-----------------------------

    texture: function ( name, o ) {

    	o = o || {};

    	var n = name.substring( name.lastIndexOf('/')+1, name.lastIndexOf('.') );

        if( tmpTxt[ n ] ) return tmpTxt[ n ];

    	tmpTxt[ n ] = loader.load( './assets/textures/' + name, function ( tx ) {

            tx.flipY = o.flip !== undefined ? o.flip : false;

    		//if( o.flip !== undefined ) tx.flipY = o.flip;
			if( o.repeat !== undefined ){ 
				tx.repeat.set( o.repeat[0], o.repeat[1] );
				if(o.repeat[0]>1) tx.wrapS = THREE.RepeatWrapping;
				if(o.repeat[1]>1) tx.wrapT = THREE.RepeatWrapping;
			}
			if( o.anisotropy !== undefined ) tx.anisotropy = o.anisotropy;

    	});

    	return tmpTxt[ n ];

    },
    

    //-----------------------------
    //
    // TONE MAPING
    //
    //-----------------------------

	setTone : function( o ) {

        o = o || {};

        for( var v in setting ) setting[v] = o[v] !== undefined ? o[v] : setting[v];

        renderer.physicallyCorrectLights = setting.correctLight;
        renderer.gammaInput = setting.gammaInput;
        renderer.gammaOutput = setting.gammaOutput;
        renderer.toneMapping = toneMappings[ setting.type ];
        renderer.toneMappingExposure = setting.exposure;
        renderer.toneMappingWhitePoint = setting.whitePoint;

    },


    //-----------------------------
    //
    // DEBUG
    //
    //-----------------------------

    debug: function () {

        if( !isDebug ){

            helper[0] = new THREE.PointHelper( 20, 0xFFFF00 );
            helper[1] = new THREE.PointHelper( 20, 0x00FFFF );
            helper[2] = new THREE.PointHelper( 5, 0xFF8800 );


            /*this.vMid = new THREE.Vector3( 1,0.1,0 );
            this.camPixel = new THREE.OrthographicCamera( -0.1,0.1,0.1,-0.1, 1, 2 );
            this.scene.add( this.camPixel );
            this.camPixel.lookAt( this.vMid );

            this.helper[2].add(this.camPixel)

            this.scene.add(new THREE.CameraHelper(this.camPixel))
            */

            

            sun.add( helper[0] )
            moon.add( helper[1] )
            followGroup.add( helper[2] )

            isDebug = true;

        } else {

            sun.remove( helper[0] )
            moon.remove( helper[1] )
            followGroup.remove( helper[2] )

            isDebug = false;

        }
        

    },


    //-----------------------------
    //
    // FOG
    //
    //-----------------------------

    addFog: function ( o ) {
        
        if( isFog ) return;

        o = o || {};

        fog = o.exp !== undefined ? new THREE.FogExp2( o.color || 0x3b4c5a, o.exp ) : new THREE.Fog( o.color || 0x3b4c5a, o.near || 1, o.far || 300 );
        scene.fog = fog;
        isFog = true;

    },

    setFogColor: function ( color ) {
        
        if( !isFog ) return;
        fog.color = color;

    },

    removeFog: function () {
        
        if( !isFog ) return;
        fog = null;
        scene.fog = null;
        isFog = false;

    },


    //-----------------------------
    //
    // LIGHT
    //
    //-----------------------------

    resetLight: function () {

        if( !isLight ) return;

        followGroup.position.set(0,0,0);

        lightDistance = 200;

        sun.color.setHex(0xffffff);
        sun.intensity = setting.sunIntensity;

        moon.color.setHex(0x919091);
        moon.intensity = setting.moonIntensity;

        sun.position.set( 0, lightDistance, 10 );
        moon.position.set( 0, -lightDistance, -10 );

    },

    addLights: function () {

        if( isLight ) return;

    	sun = new THREE.DirectionalLight( 0xffffff, setting.sunIntensity );
    	sun.position.set( 0, lightDistance, 10 );

    	moon = new THREE.DirectionalLight( 0x919091, setting.moonIntensity );//new THREE.PointLight( 0x919091, 1, this.lightDistance*2, 2 );
    	moon.position.set( 0, -lightDistance, -10 );

        /*if( this.isWithSphereLight ){
            this.sphereLight = new THREE.HemisphereLight( 0xff0000, this.bg, 0.6 );
            this.sphereLight.position.set( 0, 1, 0 );
            this.followGroup.add( this.sphereLight );
        }*/

        //sphereLight = new THREE.HemisphereLight( 0xff0000, bg, 0.0 );
        //sphereLight.position.set( 0, 0, 0 );
        //followGroup.add( sphereLight );

        //probe = new THREE.LightProbe();
        //followGroup.add( probe );

    	//ambient = new THREE.AmbientLight( 0x202020 );
        //followGroup.add( ambient );
        //this.ambient.position.set( 0, 50, 0 );

    	followGroup.add( sun );
        followGroup.add( sun.target );
    	followGroup.add( moon );
        followGroup.add( moon.target );

    	//this.scene.add( this.ambient );

        /*this.scene.add( this.sun );
        this.scene.add( this.moon );
        this.scene.add( this.ambient );*/

        isLight = true;

    },


    //-----------------------------
    //
    // SHADOW
    //
    //-----------------------------

    addShadow: function( o ){

        o = o || {};

    	if( isWithShadow ) return;
        if( !isLight ) this.addLights();

        if( shadowMat === null ){ 

            shadowMat = new THREE.ShadowMaterial({ opacity:0.5, depthTest:true, depthWrite:false });

            if(isHighShadow){

                // overwrite shadowmap code
                var shaderShadow = THREE.ShaderChunk.shadowmap_pars_fragment;
                shaderShadow = shaderShadow.replace( '#ifdef USE_SHADOWMAP', ShadowPCSS );
                shaderShadow = shaderShadow.replace( '#if defined( SHADOWMAP_TYPE_PCF )',[ "return PCSS( shadowMap, shadowCoord );", "#if defined( SHADOWMAP_TYPE_PCF )"].join( "\n" ) );

                shadowMat.onBeforeCompile = function ( shader ) {

                    var fragment = shader.fragmentShader;
                    fragment = fragment.replace( '#include <shadowmap_pars_fragment>', shaderShadow );
                    shader.fragmentShader = fragment;

                }

            }


        }

        isWithShadow = true;
        renderer.shadowMap.enabled = true;

        if( !isHighShadow ){
            renderer.shadowMap.soft = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        

        shadowGround = new THREE.Mesh( geo.plane, shadowMat );
        shadowGround.scale.set( 200, 1, 200 );
        //this.shadowGround.position.y = 0.001;
        shadowGround.castShadow = false;
        shadowGround.receiveShadow = true;
        scene.add( shadowGround );

        var d = 150;
        //this.camShadow = new THREE.OrthographicCamera( -d, d, d, -d,  100, 300 );
        camShadow = new THREE.OrthographicCamera( d, -d, d, -d,  100, 300 );
        //this.followGroup.add( this.camShadow );
        sun.shadow = new THREE.LightShadow( camShadow );

        sun.shadow.mapSize.width = o.resolution || 2048;
        sun.shadow.mapSize.height = o.resolution || 2048;
        sun.shadow.bias = o.bias || 0.00001;
        //this.sun.shadow.bias = 0.0001;
        sun.castShadow = true;


    },

    setShadow: function ( o ) {

        if( !isWithShadow ) return;

        o = o || {};

        var cam = camShadow;
        var d = ( o.size !== undefined ) ? o.size : 150;
        cam.left =  d;
        cam.right = - d;
        cam.top =  d;
        cam.bottom = - d;
        cam.near = ( o.near !== undefined ) ? o.near : 100;
        cam.far = ( o.far !== undefined ) ? o.far : 300;
        cam.updateProjectionMatrix();

        var gr = o.groundSize || 100;
        var py = o.groundY || 0;

        shadowGround.scale.set( gr*2, 1, gr*2 );
        shadowGround.position.y = py;

        if( o.debug ) this.addShadowDebug();

    },

    addShadowDebug: function () {

        if( isShadowDebug ) {
            campHelper.update();
        } else {
            campHelper = new THREE.CameraHelper( camShadow )
            followGroup.add( campHelper );
            isShadowDebug = true;
        }

    },

    removeShadowDebug: function () {

        if( !isShadowDebug ) return;
        followGroup.remove( campHelper );
        isShadowDebug = false;

    },
    

    //-----------------------------
    //
    // GRID
    //
    //-----------------------------

    initGrid: function ( o ){

        o = o || {};
        grid = new THREE.GridHelper( o.s1 || 40, o.s2 || 16, o.c1 || 0x000000, o.c2 || 0x020202 );
        grid.material = new THREE.LineBasicMaterial( { vertexColors: THREE.VertexColors, transparent:true, opacity:0.15, depthTest:true, depthWrite:false } );
        scene.add( grid );

    },

    hideGrid: function ( notGround ) {

        if( grid.visible ){ grid.visible = false; if( shadowGround !== null && !notGround ) shadowGround.visible = false; }
        else{ grid.visible = true; if( shadowGround !== null && !notGround ) shadowGround.visible = true; }

    },


    //-----------------------------
    //
    //  ENVIRONEMENT
    //  need sky.js
    //
    //-----------------------------

    setEnvMap: function ( v ) {

        envmap = v;

    },

    removeSky: function () {

        if( envmap ) envmap.dispose();
        envmap = null;

        sky.clear();

    },

    setSky: function ( o ) {

        if( !isLight ) this.addLights();
        sky.setSky( o );

    },

    addSky: function ( o ) {

        if( !isLight ) this.addLights();
        sky.setSky( o );

    },

    skyTimelap: function ( t, frame ) {

        sky.timelap( t, frame );

    },

    updateSky: function ( o ) {

        sky.setOption( o );

    },

    updateEnvMap: function () {

        var hdr = sky.getHdr();
        var mt;

        // intern material
        for( var m in mat ){

            mt = mat[m];

            if( mt.envMap !== undefined ){
                if( mt.type === 'MeshStandardMaterial' ) mt.envMap = envmap;
                else mt.envMap =  hdr ? null : envmap;
                if( mt.wireframe ) mt.envMap = null;
                mt.needsUpdate = true;
            }

        }

        // tmp material
        for( var m in tmpMat ){

            mt = tmpMat[m];

            if( mt.envMap !== undefined ){
                if( mt.type === 'MeshStandardMaterial' ) mt.envMap = envmap;
                else mt.envMap =  hdr ? null : envmap;
                if( mt.wireframe ) mt.envMap = null;
                mt.needsUpdate = true;
            }

        }

        this.extraUpdateMat( envmap, hdr );

    },

    extraUpdateMat: function ( env, hdr ) {

    }, 


    //--------------------------------------
    //
    //   CAMERA CONTROL AUTO AND FOLLOW
    //
    //--------------------------------------

    moveCam: function ( o, callback ) {

        controler.moveCam( o, callback );

    },

    setFollow: function( name, o ){

        if( name === 'none' ) controler.resetFollow();
        if( !this.byName[ name ] ) return;
        o = o || {};

        controler.initFollow( this.byName[ name ], o );
        //this.controler.enableDamping = false;

    },


    //-----------------------------
    //
    // RAYCAST
    //
    //-----------------------------

    activeRay: function ( callback, debug, size ) {

        if( isRay ) return;

        ray = new THREE.Raycaster();

        dragPlane = new THREE.Mesh( 
            debug ?  new THREE.PlaneBufferGeometry( 1, 1, 4, 4 ) : new THREE.PlaneBufferGeometry( 1, 1, 1, 1 ),  
            new THREE.MeshBasicMaterial({ color:0x00ff00, transparent:true, opacity:debug ? 0.3 : 0, depthTest:false, depthWrite:false, wireframe: debug ? true : false })
        );

        dragPlane.castShadow = false;
        dragPlane.receiveShadow = false;
        this.setDragPlane( null, size );
        scene.add( dragPlane );

        this.fray = function(e){ this.rayTest(e); }.bind( this );
        this.mDown = function(e){ this.rayTest(e); mouse.z = 1; }.bind( this );
        this.mUp = function(e){ mouse.z = 0; }.bind( this );

        canvas.addEventListener( 'mousemove', this.fray, false );
        canvas.addEventListener( 'mousedown', this.mDown, false );
        document.addEventListener( 'mouseup', this.mUp, false );

        this.rayCallBack = callback;
        isRay = true;

    },

    removeRay: function () {

        if( !isRay ) return;

        canvas.removeEventListener( 'mousemove', this.fray, false );
        canvas.removeEventListener( 'mousedown', this.mDown, false );
        document.removeEventListener( 'mouseup', this.mUp, false );

        this.rayCallBack = function(){};

        scene.remove( dragPlane );

        isRay = false;
        offset.set( 0,0,0 );

    },

    rayTest: function ( e ) {

        mouse.x = ( (e.clientX - vs.x )/ vs.w ) * 2 - 1;
        mouse.y = - ( e.clientY / vs.h ) * 2 + 1;

        ray.setFromCamera( mouse, camera );
        //var intersects = this.ray.intersectObjects( this.content.children, true );
        var intersects = ray.intersectObject( dragPlane );
        if ( intersects.length ){ 
            offset.copy( intersects[0].point );
            this.rayCallBack( offset );
        }

    },

    setDragPlane: function ( pos, size ) {

        size = size || 200;
        dragPlane.scale.set( 1, 1, 1 ).multiplyScalar( size );
        if( pos ){
            dragPlane.position.fromArray( pos );
            dragPlane.rotation.set( 0, controler.getAzimuthalAngle(), 0 );
            //this.dragPlane.lookAt( this.camera.position );
        } else {
            dragPlane.position.set( 0, 0, 0 );
            dragPlane.rotation.set( -Math.PI90, 0, 0 );
        }

    },


    //--------------------------------------
    //
    //   SRC UTILS ViewUtils
    //
    //--------------------------------------

    addUV2: function ( m ) {

        THREE.GeometryTools.addUV2( m.geometry );

    },

    mergeGeometry: function(m){

        return THREE.GeometryTools.mergeGeometryArray( m );

    },

    mergeMesh: function(m){

        return THREE.GeometryTools.mergeGeometryArray( m );

    },

    prepaGeometry: function ( g, type ) {

        return THREE.GeometryTools.prepaGeometry( g, type );

    },

    getGeomtryInfo: function ( o ) {

        return THREE.GeometryTools.getGeomtryInfo( o );

    },


    //--------------------------------------
    //
    //   Joystick support html / mobile
    //
    //--------------------------------------

    addJoystick: function ( o ) {

        if( !editor ) return;
        if( isWithJoystick ) return;

        editor.addJoystick( o );
        isWithJoystick = true;

    },

    removeJoystick: function () {

        if( !editor ) return;
        if( !isWithJoystick ) return;

        editor.removeJoystick();
        isWithJoystick = false;

    },

    //--------------------------------------
    //
    //   FOLLOW
    //
    //--------------------------------------

    getCenterPosition: function () {

        return followGroup.position;

    },

    getDistanceToCenter: function () {

        var p = followGroup.position;
        return Math.sqrt( p.x * p.x + p.z * p.z );

    },


    //--------------------------------------
    //
    //   AUDIO
    //
    //--------------------------------------

    needAudio: function () {

        autoAddAudio = this.autoAudio.bind( this )

        canvas.addEventListener( 'click', view.autoAddAudio, false );

    },

    autoAudio: function( e ){ 

        this.addAudio();
        canvas.removeEventListener( 'click', view.autoAddAudio );
        autoAddAudio = null;

    },

    addAudio: function () {

        //this.needsAudio = true;

        if( listener !== null ) return;
        listener = new THREE.AudioListener();
        camera.add( listener );

    },

    removeAudio: function () {

        //this.needsAudio = false;

        if( listener === null ) return;
        
        camera.remove( listener );
        listener = null;

    },


    addSound: function ( name ){

        if( listener === null ) this.addAudio();

        if(!pool.buffer[name]) return null;

        var audio = new THREE.PositionalAudio( listener );
        //audio.volume = 1;
        audio.setBuffer( pool.buffer[name] );
        return audio;

    },


    //--------------------------------------
    //
    //   SHADER
    //
    //--------------------------------------

    makeCheck: function () {

        var c = document.createElement('canvas');
        c.width = c.height = 128;
        var ctx = c.getContext("2d");

        ctx.beginPath();
        ctx.rect(0, 0, 128, 128);
        ctx.fillStyle = "#ffffff";
        ctx.fill();

        ctx.beginPath();
        ctx.rect(0, 0, 64, 64);
        ctx.rect(64, 64, 64, 64);
        ctx.fillStyle = "#CCCCCC";
        ctx.fill();

        var img = new Image( 128, 128 );
        img.src = c.toDataURL( 'image/png' );

        var t = new THREE.Texture( img );
        t.repeat = new THREE.Vector2( 2, 2 );
        t.wrapS = t.wrapT = THREE.RepeatWrapping;

        img.onload = function(){ t.needsUpdate = true; }

        return t;

    },

    shaderHack: function () {

        THREE.ShaderChunk.aomap_fragment = [
            '#ifdef USE_AOMAP',
            '    float ambientOcclusion = ( texture2D( aoMap, vUv ).r - 1.0 ) * aoMapIntensity + 1.0;',
            '    reflectedLight.indirectDiffuse *= ambientOcclusion;',
            '    #if defined( USE_ENVMAP ) && defined( PHYSICAL )',
            '        float dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );',
            '        reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.specularRoughness );',
            '   #endif',
            '#endif',
        ].join("\n");

    },


    //--------------------------------------
    //
    //   JSON
    //
    //--------------------------------------

    loadJson: function ( link, callback ) {

        var xhr = new XMLHttpRequest();
        xhr.open('GET', link, true );
        xhr.overrideMimeType("application/json");

        xhr.onreadystatechange = function () {

            if ( xhr.readyState === 2 ) { 
            } else if ( xhr.readyState === 3 ) {
            } else if ( xhr.readyState === 4 ) {
                if ( xhr.status === 200 || xhr.status === 0 ) callback( JSON.parse( xhr.response ) );
                else console.error( "Couldn't load ["+ link + "] [" + xhr.status + "]" );
            }

        };
        
        xhr.send( null );

    },

    ////

}

return view;

})();


var ShadowPCSS = [

    "#ifdef USE_SHADOWMAP",
    "#define LIGHT_WORLD_SIZE 0.005",//0.005
    "#define LIGHT_FRUSTUM_WIDTH 3.75",//3.75 // 1.75
    "#define LIGHT_SIZE_UV (LIGHT_WORLD_SIZE / LIGHT_FRUSTUM_WIDTH)",
    "#define NEAR_PLANE 9.5",
    " ",
    "#define NUM_SAMPLES 17",//17
    "#define NUM_RINGS 11",//11
    "#define BLOCKER_SEARCH_NUM_SAMPLES NUM_SAMPLES",
    "#define PCF_NUM_SAMPLES NUM_SAMPLES",
    " ",
    "vec2 poissonDisk[NUM_SAMPLES];",
    " ",
    "void initPoissonSamples( const in vec2 randomSeed ) {",
    "   float ANGLE_STEP = PI2 * float( NUM_RINGS ) / float( NUM_SAMPLES );",
    "   float INV_NUM_SAMPLES = 1.0 / float( NUM_SAMPLES );",

    // jsfiddle that shows sample pattern: https://jsfiddle.net/a16ff1p7/
    "   float angle = rand( randomSeed ) * PI2;",
    "   float radius = INV_NUM_SAMPLES;",
    "   float radiusStep = radius;",

    "   for( int i = 0; i < NUM_SAMPLES; i ++ ) {",
    "       poissonDisk[i] = vec2( cos( angle ), sin( angle ) ) * pow( abs(radius), 0.75 );",
    "       radius += radiusStep;",
    "       angle += ANGLE_STEP;",
    "   }",
    "}",

    "float penumbraSize( const in float zReceiver, const in float zBlocker ) { ",// Parallel plane estimation
    "   return (zReceiver - zBlocker) / zBlocker;",
    "}",

    "float findBlocker( sampler2D shadowMap, const in vec2 uv, const in float zReceiver ) {",
        // This uses similar triangles to compute what
        // area of the shadow map we should search
    "   float searchRadius = LIGHT_SIZE_UV * ( zReceiver - NEAR_PLANE ) / zReceiver;",
    "   float blockerDepthSum = 0.0;",
    "   int numBlockers = 0;",

    "   for( int i = 0; i < BLOCKER_SEARCH_NUM_SAMPLES; i++ ) {",
    "       float shadowMapDepth = unpackRGBAToDepth(texture2D(shadowMap, uv + poissonDisk[i] * searchRadius));",
    "       if ( shadowMapDepth < zReceiver ) {",
    "           blockerDepthSum += shadowMapDepth;",
    "           numBlockers ++;",
    "       }",
    "   }",

    "    if( numBlockers == 0 ) return -1.0;",

    "    return blockerDepthSum / float( numBlockers );",
    "}",

    "float PCF_Filter( sampler2D shadowMap, vec2 uv, float zReceiver, float filterRadius ) {",
    "    float sum = 0.0;",
    "    for( int i = 0; i < PCF_NUM_SAMPLES; i ++ ) {",
    "        float depth = unpackRGBAToDepth( texture2D( shadowMap, uv + poissonDisk[ i ] * filterRadius ) );",
    "        if( zReceiver <= depth ) sum += 1.0;",
    "    }",
    "    for( int i = 0; i < PCF_NUM_SAMPLES; i ++ ) {",
    "        float depth = unpackRGBAToDepth( texture2D( shadowMap, uv + -poissonDisk[ i ].yx * filterRadius ) );",
    "        if( zReceiver <= depth ) sum += 1.0;",
    "    }",
    "    return sum / ( 2.0 * float( PCF_NUM_SAMPLES ) );",
    "}",

    "float PCSS ( sampler2D shadowMap, vec4 coords ) {",
    "    vec2 uv = coords.xy;",
    "    float zReceiver = coords.z;", // Assumed to be eye-space z in this code

    "    initPoissonSamples( uv );",
        // STEP 1: blocker search
    "    float avgBlockerDepth = findBlocker( shadowMap, uv, zReceiver );",

        //There are no occluders so early out (this saves filtering)
    "    if( avgBlockerDepth == -1.0 ) return 1.0;",

        // STEP 2: penumbra size
    "    float penumbraRatio = penumbraSize( zReceiver, avgBlockerDepth );",
    "    float filterRadius = penumbraRatio * LIGHT_SIZE_UV * NEAR_PLANE / zReceiver;",
        
        // STEP 3: filtering
        // return avgBlockerDepth;
    "    return PCF_Filter( shadowMap, uv, zReceiver, filterRadius );",
    "}",

].join( "\n" );