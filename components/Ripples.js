import { Component } from 'React'
import PropTypes from 'prop-types';

export default class Ripples extends Component {
  constructor(props) {
    super(props)
    this.state = {
      gl: {},
      options: {},
      config: {},
      transparentPixels: {},
    }
  }

  componentDidMount() {
    this.loadConfig();
    // this.ripplesInit();
  }

  loadConfig = () => {
    const { canvas } = this;
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    if (!gl) {
      // Browser does not support WebGL.
      return null;
    }

    // Load extensions
    const extensions = {};
    [
      'OES_texture_float',
      'OES_texture_half_float',
      'OES_texture_float_linear',
      'OES_texture_half_float_linear'
    ].forEach(function (name) {
      const extension = gl.getExtension(name);
      if (extension) {
        extensions[name] = extension;
      }
    });

    // If no floating point extensions are supported we can bail out early.
    if (!extensions.OES_texture_float) {
      this.setState({ gl });
      return null;
    }

    const configs = [];

    configs.push(
      this.createConfig('float', gl.FLOAT, Float32Array, extensions)
    );

    if (extensions.OES_texture_half_float) {
      configs.push(
        // Array type should be Uint16Array, but at least on iOS that breaks. In that case we
        // just initialize the textures with data=null, instead of data=new Uint16Array(...).
        // This makes initialization a tad slower, but it's still negligible.
        this.createConfig('half_float', extensions.OES_texture_half_float.HALF_FLOAT_OES, null, extensions)
      );
    }

    // Setup the texture and framebuffer
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Check for each supported texture type if rendering to it is supported
    let config = null;

    for (let i = 0; i < configs.length; i++) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 32, 32, 0, gl.RGBA, configs[i].type, null);

      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
        config = configs[i];
        break;
      }
    }

    this.setState({
      gl,
      config
    })
  }

  createConfig = (type, glType, arrayType, extensions) => {
    const name = 'OES_texture_' + type,
      nameLinear = name + '_linear',
      linearSupport = nameLinear in extensions,
      configExtensions = [name];
    if (linearSupport) {
      configExtensions.push(nameLinear);
    }

    return {
      type: glType,
      arrayType: arrayType,
      linearSupport: linearSupport,
      extensions: configExtensions
    };
  }

  ripplesInit = () => {
    const { options } = this.props;
    const { config } = this.state;
    let { gl } = this.state;

    const setStates = {};
    const transparentPixels = this.createImageData(32, 32);

    // Init properties from options
    setStates.interactive = options.interactive;
    setStates.resolution = options.resolution;
    setStates.textureDelta = new Float32Array([1 / setStates.resolution, 1 / setStates.resolution]);

    setStates.perturbance = options.perturbance;
    setStates.dropRadius = options.dropRadius;

    setStates.crossOrigin = options.crossOrigin;
    setStates.imageUrl = options.imageUrl;

    // Init WebGL canvas
    setStates.context = gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    // Load extensions
    config.extensions.forEach(function (name) {
      gl.getExtension(name);
    });

    // Auto-resize when window size changes.
    // window.addEventListener('resize', (e) => this.constructor.updateSize.apply(this, e));

    // Init rendertargets for ripple data.
    const allTextures = [];
    const allFramebuffers = [];
    const bufferWriteIndex = 0;
    const bufferReadIndex = 1;

    const arrayType = config.arrayType;
    const textureData = arrayType ? new arrayType(setStates.resolution * setStates.resolution * 4) : null;

    for (let i = 0; i < 2; i++) {
      const texture = gl.createTexture();
      const framebuffer = gl.createFramebuffer();

      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, config.linearSupport ? gl.LINEAR : gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, config.linearSupport ? gl.LINEAR : gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.resolution, this.resolution, 0, gl.RGBA, config.type, textureData);

      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

      allTextures.push(texture);
      allFramebuffers.push(framebuffer);
    }

    // Init GL stuff
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
      +1, -1,
      +1, +1,
      -1, +1
    ]), gl.STATIC_DRAW);


    // Plugin is successfully initialized!
    const visible = true;
    const running = true;
    const inited = true;
    const destroyed = false;

    this.setState({
      ...setStates,
      transparentPixels,
      textures: allTextures,
      framebuffers: allFramebuffers,
      bufferWriteIndex,
      bufferReadIndex,
      quad,
      visible,
      running,
      inited,
      destroyed,
    }, () => {
      this.initShaders();
      this.initTexture();
      this.setTransparentTexture();

      // Load the image either from the options or CSS rules
      this.loadImage();

      // Set correct clear color and blend mode (regular alpha blending)
      gl.clearColor(0, 0, 0, 0);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      this.setupPointerEvents();

      window.requestAnimationFrame(this.step);
    })
  }

  // Init animation
  step = () => {
    if (!this.state.destroyed) {
      this.step();
      window.requestAnimationFrame(this.step);
    }
  }

  createImageData = (width, height) => {
    try {
      return new ImageData(width, height);
    }
    catch (e) {
      // Fallback for IE
      const canvas = document.createElement('canvas');
      return canvas.getContext('2d').createImageData(width, height);
    }
  }

  initShaders() {
    const { gl, textureDelta } = this.state
    const vertexShader = `
      attribute vec2 vertex;
      varying vec2 coord;
      void main() {
        coord = vertex * 0.5 + 0.5;
        gl_Position = vec4(vertex, 0.0, 1.0);
      }
    `;

    const dropProgram = this.createProgram(vertexShader,
      `precision highp float;

      const float PI = 3.141592653589793;
      uniform sampler2D texture;
      uniform vec2 center;
      uniform float radius;
      uniform float strength;

      varying vec2 coord;

      void main() {
        vec4 info = texture2D(texture, coord);

        float drop = max(0.0, 1.0 - length(center * 0.5 + 0.5 - coord) / radius);
        drop = 0.5 - cos(drop * PI) * 0.5;

        info.r += drop * strength;

        gl_FragColor = info;
      }`
    );

    const updateProgram = this.createProgram(vertexShader,
      `precision highp float;

      uniform sampler2D texture;
      uniform vec2 delta;

      varying vec2 coord;

      void main() {
        vec4 info = texture2D(texture, coord);

        vec2 dx = vec2(delta.x, 0.0);
        vec2 dy = vec2(0.0, delta.y);

        float average = (
          texture2D(texture, coord - dx).r +
          texture2D(texture, coord - dy).r +
          texture2D(texture, coord + dx).r +
          texture2D(texture, coord + dy).r
        ) * 0.25;

        info.g += (average - info.r) * 2.0;
        info.g *= 0.995;
        info.r += info.g;

        gl_FragColor = info;
      }`
    );
    gl.uniform2fv(updateProgram.locations.delta, textureDelta);

    const renderProgram = this.createProgram(
      `precision highp float;

      attribute vec2 vertex;
      uniform vec2 topLeft;
      uniform vec2 bottomRight;
      uniform vec2 containerRatio;
      varying vec2 ripplesCoord;
      varying vec2 backgroundCoord;
      void main() {
        backgroundCoord = mix(topLeft, bottomRight, vertex * 0.5 + 0.5);
        backgroundCoord.y = 1.0 - backgroundCoord.y;
        ripplesCoord = vec2(vertex.x, -vertex.y) * containerRatio * 0.5 + 0.5;
        gl_Position = vec4(vertex.x, -vertex.y, 0.0, 1.0);
      }`,
      `precision highp float;

      uniform sampler2D samplerBackground;
      uniform sampler2D samplerRipples;
      uniform vec2 delta;

      uniform float perturbance;
      varying vec2 ripplesCoord;
      varying vec2 backgroundCoord;

      void main() {
        float height = texture2D(samplerRipples, ripplesCoord).r;
        float heightX = texture2D(samplerRipples, vec2(ripplesCoord.x + delta.x, ripplesCoord.y)).r;
        float heightY = texture2D(samplerRipples, vec2(ripplesCoord.x, ripplesCoord.y + delta.y)).r;
        vec3 dx = vec3(delta.x, heightX - height, 0.0);
        vec3 dy = vec3(0.0, heightY - height, delta.y);
        vec2 offset = -normalize(cross(dy, dx)).xz;
        float specular = pow(max(0.0, dot(offset, normalize(vec2(-0.6, 1.0)))), 4.0);
        gl_FragColor = texture2D(samplerBackground, backgroundCoord + offset * perturbance) + specular;
      }`
    );
    gl.uniform2fv(renderProgram.locations.delta, textureDelta);
    this.setState({ dropProgram, updateProgram, renderProgram });
  }

  createProgram(vertexSource, fragmentSource, uniformValues) {
    function compileSource(type, source) {
      const shader = Ripples.gl.createShader(type);
      Ripples.gl.shaderSource(shader, source);
      Ripples.gl.compileShader(shader);
      if (!Ripples.gl.getShaderParameter(shader, Ripples.gl.COMPILE_STATUS)) {
        throw new Error('compile error: ' + Ripples.gl.getShaderInfoLog(shader));
      }
      return shader;
    }

    const program = {};

    program.id = Ripples.gl.createProgram();
    Ripples.gl.attachShader(program.id, compileSource(Ripples.gl.VERTEX_SHADER, vertexSource));
    Ripples.gl.attachShader(program.id, compileSource(Ripples.gl.FRAGMENT_SHADER, fragmentSource));
    Ripples.gl.linkProgram(program.id);
    if (!Ripples.gl.getProgramParameter(program.id, Ripples.gl.LINK_STATUS)) {
      throw new Error('link error: ' + Ripples.gl.getProgramInfoLog(program.id));
    }

    // Fetch the uniform and attribute locations
    program.uniforms = {};
    program.locations = {};
    Ripples.gl.useProgram(program.id);
    Ripples.gl.enableVertexAttribArray(0);
    let match, name;
    const regex = /uniform (\w+) (\w+)/g, shaderCode = vertexSource + fragmentSource;
    while ((match = regex.exec(shaderCode)) != null) {
      name = match[2];
      program.locations[name] = Ripples.gl.getUniformLocation(program.id, name);
    }

    return program;
  }

  setRef = (element, name) => {
    this[name] = element;
  };

  render() {
    return (
      <canvas ref={(e) => this.setRef(e, 'canvas')} />
    )
  }

  static defaultProps = {
    options: {},
    width: 0,
    height: 0,
  }
  static propTypes = {
    options: PropTypes.object,
    width: PropTypes.number,
    height: PropTypes.number,
  }
}
