import { Adjustments } from '../types';

const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main() {
   gl_Position = vec4(a_position, 0, 1);
   v_texCoord = a_texCoord;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_image;

// Adjustments
uniform float u_exposure;
uniform float u_contrast;
uniform float u_temperature;
uniform float u_tint;
uniform float u_saturation;
uniform float u_vibrance;

// Helper constants
const vec3 W = vec3(0.2125, 0.7154, 0.0721);

float clampVal(float val) {
    return clamp(val, 0.0, 1.0);
}

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec3 rgb = color.rgb;

    // 1. Exposure (Smart)
    // CPU: Math.pow(2, adj.exposure / 80);
    float exposureMultiplier = pow(2.0, u_exposure / 80.0);
    rgb *= exposureMultiplier;

    // 2. Contrast
    // CPU formula: factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    // Normalized input (-100 to 100) needs conversion to 255 range for formula or simplified
    // Standard simplified GL formula: (color - 0.5) * factor + 0.5
    // Let's stick to the CPU formula approx mapped to 0-1 range
    // Factor calculation done in JS passed as uniform is cleaner, but let's do logic here
    // C = u_contrast (from -100 to 100) but let's assume passed in raw
    // factor formula adjusted for 0-1 space:
    float c_norm = (u_contrast + 100.0) / 200.0; // 0 to 1
    // Using standard contrast curve for GPU simplicity & speed
    float contrastFactor = 1.0 + u_contrast / 100.0;
    // To match CPU exact complex formula might be heavy, standard approach:
    rgb = (rgb - 0.5) * contrastFactor + 0.5;

    // 3. Temperature & Tint
    // R channel
    float tempR = u_temperature > 0.0 ? 1.0 + (u_temperature / 100.0) * 0.4 : 1.0;
    float tempB = u_temperature < 0.0 ? 1.0 + (abs(u_temperature) / 100.0) * 0.4 : 1.0;
    float tintG = u_tint < 0.0 ? 1.0 + (abs(u_tint) / 100.0) * 0.4 : 1.0;
    float tintRB = u_tint > 0.0 ? 1.0 + (u_tint / 100.0) * 0.2 : 1.0;

    rgb.r *= tempR * tintRB;
    rgb.g *= tintG;
    rgb.b *= tempB * tintRB;

    // 4. Saturation
    float luminance = dot(rgb, W);
    vec3 gray = vec3(luminance);
    
    // Saturation (u_saturation is -100 to 100)
    float sat = u_saturation / 100.0;
    rgb = mix(gray, rgb, 1.0 + sat);

    // 5. Vibrance
    // Vibrance boosts lower saturated colors more
    float vib = u_vibrance / 100.0;
    float max_c = max(rgb.r, max(rgb.g, rgb.b));
    float avg_c = (rgb.r + rgb.g + rgb.b) / 3.0;
    float amt = (abs(max_c - avg_c) * 2.0) * vib * -1.0 + vib;
    rgb = mix(rgb, rgb + (rgb - gray) * amt, 1.0); // logic applied directly

    gl_FragColor = vec4(rgb, color.a);
}
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) {
    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

// Cache the program to avoid recompiling shaders every frame
let cachedProgram: WebGLProgram | null = null;
let positionBuffer: WebGLBuffer | null = null;
let texCoordBuffer: WebGLBuffer | null = null;

export const applyWebGLFilters = (
    canvas: HTMLCanvasElement,
    image: HTMLImageElement,
    adj: Adjustments
) => {
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
    if (!gl) {
        throw new Error("WebGL not supported");
    }

    // Initialize Shaders (Once)
    if (!cachedProgram) {
        const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
        const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
        if (!vs || !fs) return;
        cachedProgram = createProgram(gl, vs, fs);
        
        // Setup Geometry (Full Quad)
        positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
            -1,  1,
             1, -1,
             1,  1,
        ]), gl.STATIC_DRAW);

        texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0, 1,
            1, 1,
            0, 0,
            0, 0,
            1, 1,
            1, 0,
        ]), gl.STATIC_DRAW);
    }

    if (!cachedProgram || !positionBuffer || !texCoordBuffer) return;

    gl.useProgram(cachedProgram);

    // Attributes
    const positionLocation = gl.getAttribLocation(cachedProgram, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const texCoordLocation = gl.getAttribLocation(cachedProgram, "a_texCoord");
    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    gl.uniform1f(gl.getUniformLocation(cachedProgram, "u_exposure"), adj.exposure);
    gl.uniform1f(gl.getUniformLocation(cachedProgram, "u_contrast"), adj.contrast);
    gl.uniform1f(gl.getUniformLocation(cachedProgram, "u_temperature"), adj.temperature);
    gl.uniform1f(gl.getUniformLocation(cachedProgram, "u_tint"), adj.tint);
    gl.uniform1f(gl.getUniformLocation(cachedProgram, "u_saturation"), adj.saturation);
    gl.uniform1f(gl.getUniformLocation(cachedProgram, "u_vibrance"), adj.vibrance);

    // Texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    // Viewport
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    // Cleanup texture to avoid memory leaks
    gl.deleteTexture(texture);
};
