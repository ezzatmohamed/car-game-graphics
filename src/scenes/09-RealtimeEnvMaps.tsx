import { Scene } from '../common/game';
import ShaderProgram from '../common/shader-program';
import Mesh from '../common/mesh';
import * as MeshUtils from '../common/mesh-utils';
import Input from '../common/input';
import Camera from '../common/camera';
import FlyCameraController from '../common/camera-controllers/fly-camera-controller';
import { vec3, mat4, quat } from 'gl-matrix';
import { Vector, Selector } from '../common/dom-utils';
import { createElement, StatelessProps, StatelessComponent } from 'tsx-create-element';

import { Key } from 'ts-key-enum';

// In this scene we will draw a scene and use framebuffers on a cube map to emulate reflection and refraction.
export default class RealtimeEnvironmentMapScene extends Scene {
    programs: {[name: string]: ShaderProgram} = {};
    camera: Camera;
    // input:Input;
    controller: FlyCameraController;
    meshes: {[name: string]: Mesh} = {};
    textures: {[name: string]: WebGLTexture} = {};
    sampler: WebGLSampler;

    currentMesh: string;
    tint: [number, number, number] = [255, 255, 255];
    refraction: boolean = false;
    refractiveIndex: number = 1.0;

    GameOver: boolean = false;

    objectPosition: vec3 = vec3.fromValues(0, 1, -10);
    objectRotation: vec3 = vec3.fromValues(0, 0, 0);
    objectScale: vec3 = vec3.fromValues(1, 1, 1);

    carPosition:    vec3 = vec3.fromValues(6.3,0.1,-8.99);
    carSpeed:       number = 0.008;
    carMaxSpeed:    number = 0.1;
    carAcc:         number = 0.00005;

    Timer :number = 59;
    Counter:number=60;

    obstacles:[vec3,vec3,vec3,vec3,vec3,vec3,vec3,vec3,vec3,vec3,vec3,vec3] = [vec3.fromValues(6.226348400115967, 0.10000000149011612, 4.3423566818237305),vec3.fromValues(6.3263983726501465, 0.10000000149011612, 25.2528018951416),vec3.fromValues(5.425948619842529, 0.10000000149011612, 35.95822525024414),vec3.fromValues(6.3263983726501465, 0.10000000149011612, 49.2651252746582),vec3.fromValues(6.126298427581787, 0.10000000149011612, 97.08992004394531),        vec3.fromValues(5.626048564910889, 0.10000000149011612, 115.3994140625),
        vec3.fromValues(5.891995429992676, 0.10000000149011612, 8.928543090820312),
        vec3.fromValues(6.3680009841918945, 0.10000000149011612, 14.555791854858398),
        vec3.fromValues(5.7389936447143555, 0.10000000149011612, 19.66914176940918),
        vec3.fromValues(6.146998405456543, 0.10000000149011612, 29.843782424926758),
        vec3.fromValues(5.908995628356934, 0.10000000149011612, 61.22829055786133),
        vec3.fromValues(5.908995628356934, 0.10000000149011612, 61.22829055786133)
    ];


    finishPosition: vec3 = vec3.fromValues(5.918750286102295, 0.10000000149011612, 119.62748718261719);
    frames: {[name: string]:{
        frameBuffer: WebGLFramebuffer,
        camera: Camera,
        target: number
    }} = {};

    readonly CUBEMAP_SIZE = 256;
    // These are the 6 cubemap directions: -x, -y, -z, +x, +y, +z
    static readonly cubemapDirections = ['negx', 'negy', 'negz', 'posx', 'posy', 'posz']

    public load(): void {
        this.game.loader.load({
            ["texture-cube.vert"]:{url:'shaders/texture-cube.vert', type:'text'},
            ["texture-cube.frag"]:{url:'shaders/texture-cube.frag', type:'text'},
            ["texture.vert"]:{url:'shaders/texture.vert', type:'text'},
            ["texture.frag"]:{url:'shaders/texture.frag', type:'text'},
            ["house-model"]:{url:'models/car/car.obj', type:'text'},
            ["house-texture"]:{url:'models/car/car.png', type:'image'},
            ["sky"]:{url:'models/sky.jpg', type:'image'},
            ["box"]:{url:'models/box/box.obj', type:'text'},
            ["obstacle"]:{url:'models/box/obstacle.jpg', type:'image'},
            // ["obstacle"]:{url:'models/box/obstacle.jpg', type:'image'},
            ["finish"]:{url:'models/FinishLine.bmp', type:'image'},
            ["moon-texture"]:{url:'images/moon.jpg', type:'image'},
            ["ground-texture"]:{url:'models/plane/albedo.jpg', type:'image'},
            ["suzanne"]:{url:'models/Suzanne/Suzanne.obj', type:'text'},
            ["car"]:{url:'models/car.obj', type:'text'},
            ["m4-model"]:{url:'models/m4/m4a1.obj', type:'text'},
            ["m4-texture"]:{url:'models/m4/m4.png', type:'image'},
            
            
        });
    }
    public timer(): void{

    }
    
    public start(): void {
        // var te = setInterval(this.timer, 1000);
        this.programs['texture-cube'] = new ShaderProgram(this.gl);
        this.programs['texture-cube'].attach(this.game.loader.resources["texture-cube.vert"], this.gl.VERTEX_SHADER);
        this.programs['texture-cube'].attach(this.game.loader.resources["texture-cube.frag"], this.gl.FRAGMENT_SHADER);
        this.programs['texture-cube'].link();

        this.programs['texture'] = new ShaderProgram(this.gl);
        this.programs['texture'].attach(this.game.loader.resources["texture.vert"], this.gl.VERTEX_SHADER);
        this.programs['texture'].attach(this.game.loader.resources["texture.frag"], this.gl.FRAGMENT_SHADER);
        this.programs['texture'].link();

        this.meshes['suzanne'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources['suzanne']);
        this.meshes['m4'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources['m4-model']);
        this.meshes['car'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources['car']); 
        this.meshes['cube'] = MeshUtils.Cube(this.gl);
        this.meshes['moon'] = MeshUtils.Sphere(this.gl);
        this.meshes['ground'] = MeshUtils.Plane(this.gl, {min:[0,0], max:[500,500]});
        this.meshes['finish'] = MeshUtils.Plane(this.gl, {min:[0,0], max:[1,1]});
        this.meshes['sky'] = MeshUtils.Plane(this.gl, {min:[0,0], max:[500,500]});

        this.meshes['house'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources["house-model"]);
        this.meshes['obstacle'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources["box"]);
        // this.meshes['obstacle'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources["box"]);
        
        // this.currentMesh = 'suzanne';

        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
        
        
        this.textures['ground'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['ground']);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.game.loader.resources['ground-texture']);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);

        this.textures['sky'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['sky']);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.game.loader.resources['sky']);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);
        
        
        this.textures['house'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['house']);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.game.loader.resources['house-texture']);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);

        this.textures['finish'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['finish']);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.game.loader.resources['finish']);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);

        this.textures['obstacle'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['obstacle']);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.game.loader.resources['obstacle']);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);



        // These will be our 6 targets for loading the images to the texture
        const target_directions = [
            this.gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
            this.gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
            this.gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
            this.gl.TEXTURE_CUBE_MAP_POSITIVE_X,
            this.gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
            this.gl.TEXTURE_CUBE_MAP_POSITIVE_Z
        ];

        const cameraDirections = [
            [-1,  0,  0],
            [ 0, -1,  0],
            [ 0,  0, -1],
            [ 1,  0,  0],
            [ 0,  1,  0],
            [ 0,  0,  1]
        ];

        const cameraUps = [
            [ 0, -1,  0],
            [ 0,  0, -1],
            [ 0, -1,  0],
            [ 0, -1,  0],
            [ 0,  0, -1],
            [ 0, -1,  0]
        ];

        const miplevels = Math.ceil(Math.log2(this.CUBEMAP_SIZE));
        
        this.textures['environment'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, this.textures['environment']); // Here, we will bind the texture to TEXTURE_CUBE_MAP since it will be a cubemap
        // we only allocate the face storage
        this.gl.texStorage2D(this.gl.TEXTURE_CUBE_MAP, miplevels, this.gl.RGBA8, this.CUBEMAP_SIZE, this.CUBEMAP_SIZE);
        // this.gl.generateMipmap(this.gl.TEXTURE_CUBE_MAP); // Then we generate the mipmaps

        this.textures['environment-depth'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, this.textures['environment-depth']); // Here, we will bind the texture to TEXTURE_CUBE_MAP since it will be a cubemap
        this.gl.texStorage2D(this.gl.TEXTURE_CUBE_MAP, 1, this.gl.DEPTH_COMPONENT16, this.CUBEMAP_SIZE, this.CUBEMAP_SIZE);

        for(let i = 0; i < 6; i++){
            const direction = RealtimeEnvironmentMapScene.cubemapDirections[i];
            
            let camera = new Camera();
            camera.direction = vec3.clone(cameraDirections[i]);
            camera.up = vec3.clone(cameraUps[i]);
            camera.perspectiveFoVy = Math.PI/2;
            camera.aspectRatio = 1;
            
            let frameBuffer = this.gl.createFramebuffer();
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, frameBuffer);
            this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, target_directions[i], this.textures['environment'], 0);
            this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.DEPTH_ATTACHMENT, target_directions[i], this.textures['environment-depth'], 0);

            if(this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER) != this.gl.FRAMEBUFFER_COMPLETE)
                console.error("Frame Buffer is Incomplete");

            this.frames[direction] = {frameBuffer: frameBuffer, camera: camera, target: target_directions[i]};
        }

        this.sampler = this.gl.createSampler();
        this.gl.samplerParameteri(this.sampler, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.samplerParameteri(this.sampler, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.samplerParameteri(this.sampler, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.samplerParameteri(this.sampler, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);

        this.camera = new Camera();
        this.camera.type = 'perspective';
        this.camera.position = vec3.fromValues(6.3,0.26,-9.33);
        this.camera.direction = vec3.fromValues(1,2,100);
        this.camera.aspectRatio = this.gl.drawingBufferWidth/this.gl.drawingBufferHeight;
        
        this.controller = new FlyCameraController(this.camera, this.game.input);
        this.controller.movementSensitivity = 0.01;
        this.controller.fastMovementSensitivity = 0.05;
        // this.controller.
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.cullFace(this.gl.BACK);
        this.gl.frontFace(this.gl.CCW);

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);

        this.gl.clearColor(0,0,0,1);

        this.setupControls();
    }
    
    public draw(deltaTime: number): number {
        if(this.GameOver)
        {
            if(this.game.input.isKeyDown("r"))
            {
                this.GameOver = false;
                this.carPosition = vec3.fromValues(6.3,0.1,-8.99);
                this.camera.position= vec3.fromValues(6.3,0.26,-9.33);
                this.carSpeed = 0.008;
                this.Timer=59;
                let gameover = document.querySelector('#game-over');
                gameover.innerHTML = "";
            }
            else{
                return;
            }
        }
        this.Counter--;
        if ( this.Counter == 0){
            console.log("Second");
            this.Counter = 60;
            this.Timer--;
        }
        console.log(this.carPosition);
        let t = document.querySelector('#timer');
        t.innerHTML = "Timer: "+this.Timer+" Seconds";
        if (this.Timer == 0 )
        {
            let gameover = document.querySelector('#game-over');
            gameover.innerHTML = "Timeout<br>GAME OVER<br>Press 'R' to Restart<br>";
            this.GameOver = true;
        }

        this.controller.update(deltaTime,this.carSpeed);

        let SlowDown = true;
        if(this.game.input.isButtonDown(0)){
                
        
            if(this.game.input.isKeyDown("w"))
            {   
                this.carPosition[2] +=this.carSpeed;
                SlowDown = false;
                
                if (this.carSpeed < this.carMaxSpeed){
                    this.carSpeed+=this.carAcc;
                }
            }
            if(this.game.input.isKeyDown("a"))
            {   
                this.carPosition[0] +=0.017;
            }
            if(this.game.input.isKeyDown("d"))
            {   
                this.carPosition[0] -=0.017;
            }
        
        }
    
        
        for( let i = 0; i < 12; i++)
        {
            if ( this.carPosition[0] < (this.obstacles[i][0]+0.12) && this.carPosition[0] > (this.obstacles[i][0]-0.12))
            {
                if ( this.carPosition[2] < (this.obstacles[i][2]+0.16) && this.carPosition[2] > (this.obstacles[i][2]-0.16))
                {
                    console.log("Collision");
                    let gameover = document.querySelector('#game-over');
                    gameover.innerHTML = "GAME OVER<br>Press 'R' to Restart<br>";
                    
                    this.GameOver = true;
                    // this.carPosition = vec3.fromValues(6.3,0.1,-8.99);
                    // this.camera.position= vec3.fromValues(6.3,0.26,-9.33);
                    
                }
            }
        }
        if ( this.carPosition[0] < (this.finishPosition[0]+0.3) && this.carPosition[0] > (this.finishPosition[0]-0.3))
        {
            if ( this.carPosition[2] > (this.finishPosition[2]-0.16))
            {
                let gameover = document.querySelector('#game-over');
                gameover.innerHTML = "Congratulations, You Won !<br>Press 'R' to Restart<br>";
                
                this.GameOver = true;
                // this.carPosition = vec3.fromValues(6.3,0.1,-8.99);
                // this.camera.position= vec3.fromValues(6.3,0.26,-9.33);
                
            }
        }
        
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        for(let face in this.frames){
            let frame = this.frames[face];
            frame.camera.position = this.objectPosition;
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, frame.frameBuffer);
            this.gl.viewport(0, 0, this.CUBEMAP_SIZE, this.CUBEMAP_SIZE);
            this.drawScene(frame.camera.ViewProjectionMatrix);
        }
        this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, this.textures['environment']);
        this.gl.generateMipmap(this.gl.TEXTURE_CUBE_MAP);
        

        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);

        this.drawScene(this.camera.ViewProjectionMatrix);
        
        let program = this.programs['texture-cube'];
        program.use();

        program.setUniformMatrix4fv("VP", false, this.camera.ViewProjectionMatrix);
        program.setUniform3f("cam_position", this.camera.position);

        let M = mat4.fromRotationTranslationScale(
            mat4.create(),
            quat.fromEuler(quat.create(), this.objectRotation[0], this.objectRotation[1], this.objectRotation[2]),
            this.objectPosition,
            this.objectScale
        );
        
        program.setUniformMatrix4fv("M", false, M);
        // We send the model matrix inverse transpose since normals are transformed by the inverse transpose to get correct world-space normals
        program.setUniformMatrix4fv("M_it", true, mat4.invert(mat4.create(), M));

        program.setUniform4f("tint", [this.tint[0]/255, this.tint[1]/255, this.tint[2]/255, 1]);
        program.setUniform1f('refraction', this.refraction?1:0);
        program.setUniform1f('refractive_index', this.refractiveIndex);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, this.textures['environment']);
        program.setUniform1i('cube_texture_sampler', 0);
        this.gl.bindSampler(0, this.sampler);

        // this.meshes[this.currentMesh].draw(this.gl.TRIANGLES);
        return 1;
    }

    private drawScene(VP: mat4){
        this.gl.clearColor(0.88,0.65,0.15,1);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT); // This will clear the textures attached to the framebuffer
        
        let program = this.programs['texture'];
        program.use();

        let groundMat = mat4.clone(VP);
        mat4.scale(groundMat, groundMat, [3000, 1, 3000.9]);
        mat4.translate(groundMat, groundMat, [1,0,0]);

        program.setUniformMatrix4fv("MVP", false, groundMat);
        program.setUniform4f("tint", [0.96, 0.91, 0.64, 1]);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['ground']);
        program.setUniform1i('texture_sampler', 0);
        
        this.meshes['ground'].draw(this.gl.TRIANGLES);
        // //=====================================================
        // let skyMat = mat4.clone(VP);
        // mat4.scale(skyMat, skyMat, [1000, 1, 1000.9]);
        // mat4.translate(skyMat, skyMat, [1,0.24,0]);
        // mat4.rotateX(skyMat,skyMat,1.1);
        // program.setUniformMatrix4fv("MVP", false, skyMat);
        // program.setUniform4f("tint", [0.96, 0.91, 0.64, 1]);

        // this.gl.activeTexture(this.gl.TEXTURE0);
        // this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['sky']);
        // program.setUniform1i('texture_sampler', 0);
        
        // this.meshes['sky'].draw(this.gl.TRIANGLES);
        //=====================================================
        let houseMat = mat4.clone(VP);
        mat4.translate(houseMat, houseMat, this.carPosition);
        mat4.scale(houseMat,houseMat,[0.05,0.03,0.04]);
        program.setUniformMatrix4fv("MVP", false, houseMat);
        program.setUniform4f("tint", [1, 1, 1, 1]);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['house']);
        program.setUniform1i('texture_sampler', 0);
        
        this.meshes['house'].draw(this.gl.TRIANGLES);

        //===================================================
        for(let i = 0; i < 12;i++)
        {
            let obstacleMat = mat4.clone(VP);
            mat4.translate(obstacleMat, obstacleMat, this.obstacles[i]);
            mat4.scale(obstacleMat,obstacleMat,[0.05,0.03,0.04]);
            program.setUniformMatrix4fv("MVP", false, obstacleMat);
            program.setUniform4f("tint", [1, 1, 1, 1]);

            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['obstacle']);
            program.setUniform1i('texture_sampler', 0);
            
            this.meshes['obstacle'].draw(this.gl.TRIANGLES);
        }
        //=====================================================


        // =====================================================
        let finish = mat4.clone(VP);
        mat4.translate(finish, finish, this.finishPosition);
        mat4.scale(finish,finish,[0.25,0.5,0.1]);
        program.setUniformMatrix4fv("MVP", false, finish);
        program.setUniform4f("tint", [1, 1, 1, 1]);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['finish']);
        program.setUniform1i('texture_sampler', 0);
        
        this.meshes['finish'].draw(this.gl.TRIANGLES);
        //======================================================
      
        //======================================================

        
    }
    
    public end(): void {
        for(let key in this.programs)
            this.programs[key].dispose();
        this.programs = {};
        for(let key in this.meshes)
            this.meshes[key].dispose();
        this.meshes = {};
        for(let key in this.textures)
            this.gl.deleteTexture(this.textures[key]);
        this.textures = {};
        this.gl.deleteSampler(this.sampler);
        this.clearControls();
    }


    /////////////////////////////////////////////////////////
    ////// ADD CONTROL TO THE WEBPAGE (NOT IMPORTNANT) //////
    /////////////////////////////////////////////////////////
    private setupControls() {
        const controls = document.querySelector('#controls');

        const RGBToHex = (rgb: [number, number, number]): string => {
            let arraybuffer = new ArrayBuffer(4);
            let dv = new DataView(arraybuffer);
            dv.setUint8(3, 0);
            dv.setUint8(2, rgb[0]);
            dv.setUint8(1, rgb[1]);
            dv.setUint8(0, rgb[2]);
            return '#' + dv.getUint32(0, true).toString(16);
        }

        const HexToRGB = (hex: string): [number, number, number] => {
            let arraybuffer = new ArrayBuffer(4);
            let dv = new DataView(arraybuffer);
            dv.setUint32(0, Number.parseInt(hex.slice(1), 16), true);
            return [dv.getUint8(2), dv.getUint8(1), dv.getUint8(0)];
        }
        
    }

    private clearControls() {
        const controls = document.querySelector('#controls');
        controls.innerHTML = "";
    }


}