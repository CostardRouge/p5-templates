# Sketch Creation Guide

A comprehensive guide to creating p5.js sketches for the Social Templates Renderer.

## Table of Contents

1. [Introduction](#introduction)
2. [Sketch Anatomy](#sketch-anatomy)
3. [Working with Options](#working-with-options)
4. [Using Assets](#using-assets)
5. [Content Items](#content-items)
6. [Multi-Slide Sketches](#multi-slide-sketches)
7. [Animations](#animations)
8. [Recording Optimization](#recording-optimization)
9. [Examples](#examples)

---

## Introduction

Sketches in this project are p5.js programs that can be parameterized through a web interface and rendered to video. Each sketch is a reusable template that accepts options and assets.

### Key Concepts

- **Options**: Configuration parameters (colors, sizes, text, etc.)
- **Assets**: Uploaded files (images, videos)
- **Content Items**: Modular components (background, text, images)
- **Slides**: Multiple scenes in one sketch

---

## Sketch Anatomy

### Basic Structure

```javascript
// sketch.js
function sketch(p, options, assets) {
  // Variables accessible across setup and draw
  let canvas;
  let myFont;

  p.setup = function () {
    // Create canvas
    canvas = p.createCanvas(options.size.width, options.size.height);
    canvas.id("defaultCanvas0"); // Required for recording

    // Set framerate
    p.frameRate(options.animation.framerate);

    // Load fonts
    myFont = p.loadFont("/assets/fonts/martian.ttf");

    // One-time setup
    p.textFont(myFont);
  };

  p.draw = function () {
    // Clear background
    p.background(246, 235, 225);

    // Your drawing code
    p.fill(0);
    p.text("Hello World!", p.p.width / 2, p.height / 2);
  };
}
```

### Required Elements

1. **Canvas ID**: Must be `defaultCanvas0`
2. **Framerate**: Use `options.animation.framerate`
3. **Canvas Size**: Use `options.size.width` and `options.size.height`

### Function Signature

```javascript
function sketch(p, options, assets) {
  // p: p5.js instance
  // options: Parsed options object (validated by Zod)
  // assets: Preloaded assets { images: {}, videos: {} }
}
```

---

## Working with Options

### Accessing Options

```javascript
p.setup = function () {
  // Size
  const width = options.size.width;
  const height = options.size.height;

  // Animation
  const fps = options.animation.framerate;
  const duration = options.animation.duration;

  // Custom options
  const customValue = options.sketch?.myCustomOption || "default";
};
```

### Standard Options

Every sketch has these standard options:

```typescript
{
  size: {
    width: number,      // 50-8192
    height: number      // 50-8192
  },
  animation: {
    framerate: number,  // 1-240
    duration: number    // 1-60 seconds
  },
  content: ContentItem[],
  assets: {
    images: string[],
    videos: string[]
  },
  slides: Slide[]
}
```

### Custom Options

Add sketch-specific options in the `sketch` field:

```json
{
  "sketch": {
    "backgroundColor": [246, 235, 225],
    "particleCount": 100,
    "animationSpeed": 1.5
  }
}
```

Access in code:

```javascript
p.draw = function () {
  const bgColor = options.sketch?.backgroundColor || [255, 255, 255];
  p.background(...bgColor);

  const count = options.sketch?.particleCount || 50;
  // Use count...
};
```

---

## Using Assets

### Asset Structure

Assets are preloaded and organized by type:

```javascript
assets = {
  images: {
    "my-image.jpg": p5.Image,
    "another-image.png": p5.Image,
  },
  videos: {
    "my-video.mp4": p5.MediaElement,
  },
};
```

### Loading Images

Images are automatically loaded before `setup()`:

```javascript
p.draw = function () {
  // Check if image exists
  const img = assets.images["my-image.jpg"];
  if (img) {
    p.image(img, 0, 0, p.width, p.height);
  }
};
```

### Image Positioning

Use normalized coordinates (0-1) for responsive positioning:

```javascript
function drawImage(img, position, scale = 1) {
  const x = position.x * p.width;
  const y = position.y * p.height;
  const w = img.width * scale;
  const h = img.height * scale;

  p.push();
  p.translate(x, y);
  p.image(img, -w / 2, -h / 2, w, h);
  p.pop();
}

p.draw = function () {
  const img = assets.images["photo.jpg"];
  drawImage(img, { x: 0.5, y: 0.5 }, 1.2);
};
```

### Image Transformations

```javascript
p.draw = function () {
  const img = assets.images["photo.jpg"];

  p.push();
  p.translate(p.p.width / 2, p.height / 2);
  p.rotate(p.frameCount * 0.01);
  p.scale(1.5);
  p.tint(255, 128); // 50% opacity
  p.image(img, -img.width / 2, -img.height / 2);
  p.pop();
};
```

### Video Assets (Future)

```javascript
p.setup = function () {
  const video = assets.videos["my-video.mp4"];
  if (video) {
    video.loop();
    video.volume(0);
  }
};

p.draw = function () {
  const video = assets.videos["my-video.mp4"];
  if (video) {
    p.image(video, 0, 0, p.width, p.height);
  }
};
```

---

## Content Items

Content items are modular components that can be added through the UI.

### Processing Content Items

```javascript
p.draw = function () {
  // Process items in order
  options.content.forEach((item) => {
    renderContentItem(item);
  });
};

function renderContentItem(item) {
  switch (item.type) {
    case "background":
      renderBackground(item);
      break;
    case "text":
      renderText(item);
      break;
    case "image":
      renderImage(item);
      break;
    case "images-stack":
      renderImagesStack(item);
      break;
  }
}
```

### Background Item

```javascript
function renderBackground(item) {
  // Solid background
  p.background(...item.background);

  // Optional pattern
  if (item.pattern) {
    if (item.pattern.type === "grid") {
      drawGrid(item.pattern);
    } else if (item.pattern.type === "dots") {
      drawDots(item.pattern);
    }
  }
}

function drawGrid(pattern) {
  p.stroke(...pattern.stroke);
  p.strokeWeight(pattern.strokeWeight);

  const cols = pattern.columns;
  const cellW = p.width / cols;
  const cellH = p.height / cols;

  for (let i = 0; i <= cols; i++) {
    p.line(i * cellW, 0, i * cellW, p.height);
    p.line(0, i * cellH, p.width, i * cellH);
  }
}
```

### Text Item

```javascript
function renderText(item) {
  p.push();

  // Set text properties
  p.textSize(item.size);
  p.fill(...item.fill);
  p.stroke(...item.stroke);

  // Set alignment
  const [hAlign, vAlign] = item.align;
  p.textAlign(p[hAlign.toUpperCase()], p[vAlign.toUpperCase()]);

  // Calculate position with margins
  const x = item.position.x * p.width;
  const y = item.position.y * p.height;
  const marginX = item.horizontalMargin * p.width;
  const marginY = item.verticalMargin * p.height;

  // Draw text
  p.text(item.content, x + marginX, y + marginY);

  p.pop();
}
```

### Image Item

```javascript
function renderImage(item) {
  const img = assets.images[item.source];
  if (!img) return;

  p.push();

  // Position
  const x = item.position.x * p.width;
  const y = item.position.y * p.height;

  // Calculate size
  const margin = item.margin;
  const maxW = p.width - margin * 2;
  const maxH = p.height - margin * 2;

  let w = img.width * item.scale;
  let h = img.height * item.scale;

  // Fit within bounds
  if (w > maxW) {
    h *= maxW / w;
    w = maxW;
  }
  if (h > maxH) {
    w *= maxH / h;
    h = maxH;
  }

  // Center if enabled
  if (item.center) {
    p.translate(x - w / 2, y - h / 2);
  } else {
    p.translate(x, y);
  }

  // Apply animation
  if (item.animation) {
    applyImageAnimation(item.animation);
  }

  p.image(img, 0, 0, w, h);
  p.pop();
}

function applyImageAnimation(animation) {
  if (animation.name === "noise-floating") {
    const t = p.frameCount * 0.01;
    const offsetX = p.noise(t) * animation.amplitude;
    const offsetY = p.noise(t + 100) * animation.amplitude;
    p.translate(offsetX, offsetY);
  }
}
```

### Images Stack Item

```javascript
function renderImagesStack(item) {
  const images = item.sources
    .map((src) => assets.images[src])
    .filter((img) => img);

  if (images.length === 0) return;

  p.push();

  // Base position
  const x = item.position.x * p.width;
  const y = item.position.y * p.height;
  p.translate(x, y);

  // Draw each image with offset
  images.forEach((img, index) => {
    p.push();

    // Apply rotation
    const rotation = item.rotation + item.progressiveRotation * index;
    p.rotate(p.radians(rotation));

    // Apply animation
    if (item.animation?.name === "random") {
      const shift = item.animation.shift;
      const offsetX = p.random(-shift, shift);
      const offsetY = p.random(-shift, shift);
      p.translate(offsetX, offsetY);
    }

    // Draw image
    const w = img.width * item.scale;
    const h = img.height * item.scale;
    p.image(img, -w / 2, -h / 2, w, h);

    p.pop();
  });

  p.pop();
}
```

### Meta Item

```javascript
function renderMeta(item) {
  p.push();
  p.fill(...item.fill);
  p.stroke(...item.stroke);
  p.textSize(16);

  const margin = 20;

  // Top left
  if (item.topLeft) {
    p.textAlign(p.LEFT, p.TOP);
    p.text(item.topLeft, margin, margin);
  }

  // Top right
  if (item.topRight) {
    p.textAlign(p.RIGHT, p.TOP);
    p.text(item.topRight, p.width - margin, margin);
  }

  // Bottom left
  if (item.bottomLeft) {
    p.textAlign(p.LEFT, p.BOTTOM);
    p.text(item.bottomLeft, margin, p.height - margin);
  }

  // Bottom right
  if (item.bottomRight) {
    p.textAlign(p.RIGHT, p.BOTTOM);
    p.text(item.bottomRight, p.width - margin, p.height - margin);
  }

  // Slide progression
  if (!item.slideProgression.hidden && options.slides.length > 0) {
    drawSlideProgression(item.slideProgression, currentSlideIndex);
  }

  p.pop();
}

function drawSlideProgression(config, currentIndex) {
  const total = options.slides.length;
  const barWidth = 40;
  const barHeight = 4;
  const spacing = 8;
  const totalWidth = (barWidth + spacing) * total - spacing;

  p.push();
  p.stroke(...config.stroke);
  p.strokeWeight(2);

  const startX = (p.width - totalWidth) / 2;
  const y = p.height - 30;

  for (let i = 0; i < total; i++) {
    const x = startX + i * (barWidth + spacing);

    if (i === currentIndex) {
      p.fill(...config.stroke);
    } else {
      p.noFill();
    }

    p.rect(x, y, barWidth, barHeight);
  }

  p.pop();
}
```

---

## Multi-Slide Sketches

### Slide Structure

```json
{
  "slides": [
    {
      "name": "Intro",
      "content": [...],
      "assets": { "images": [...] }
    },
    {
      "name": "Main Content",
      "content": [...],
      "assets": { "images": [...] }
    },
    {
      "name": "Outro",
      "content": [...],
      "assets": { "images": [...] }
    }
  ]
}
```

### Implementing Slides

```javascript
let currentSlideIndex = 0;
let framesPerSlide;
let slideProgress = 0;

p.setup = function () {
  canvas = p.createCanvas(options.size.width, options.size.height);
  canvas.id("defaultCanvas0");
  p.frameRate(options.animation.framerate);

  // Calculate frames per slide
  const totalFrames = options.animation.framerate * options.animation.duration;
  framesPerSlide = Math.floor(totalFrames / options.slides.length);
};

p.draw = function () {
  // Update current slide
  currentSlideIndex = Math.floor(p.frameCount / framesPerSlide);
  const slide = options.slides[currentSlideIndex];

  if (!slide) {
    p.noLoop();
    return;
  }

  // Calculate progress within slide (0-1)
  const frameInSlide = p.frameCount % framesPerSlide;
  slideProgress = frameInSlide / framesPerSlide;

  // Render slide
  renderSlide(slide);
};

function renderSlide(slide) {
  // Process slide content
  slide.content.forEach((item) => {
    renderContentItem(item);
  });
}
```

### Slide Transitions

```javascript
function renderSlide(slide) {
  // Fade in at start
  if (slideProgress < 0.1) {
    const alpha = slideProgress * 10;
    p.tint(255, alpha * 255);
  }

  // Fade out at end
  if (slideProgress > 0.9) {
    const alpha = (1 - slideProgress) * 10;
    p.tint(255, alpha * 255);
  }

  // Render content
  slide.content.forEach((item) => {
    renderContentItem(item);
  });

  p.noTint();
}
```

---

## Animations

### Time-Based Animation

```javascript
p.draw = function () {
  // Use frameCount for continuous animation
  const t = p.frameCount * 0.01;
  const x = p.sin(t) * 100 + p.p.width / 2;
  const y = p.cos(t) * 100 + p.height / 2;

  p.circle(x, y, 50);
};
```

### Progress-Based Animation

```javascript
p.draw = function () {
  // Calculate overall progress (0-1)
  const totalFrames = options.animation.framerate * options.animation.duration;
  const progress = p.frameCount / totalFrames;

  // Use for one-time animations
  const x = p.lerp(0, p.width, progress);
  p.circle(x, p.height / 2, 50);
};
```

### Easing Functions

```javascript
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

p.draw = function () {
  const progress = p.frameCount / totalFrames;
  const eased = easeInOutCubic(progress);

  const x = p.lerp(0, p.width, eased);
  p.circle(x, p.height / 2, 50);
};
```

### Noise-Based Animation

```javascript
p.draw = function () {
  const t = p.frameCount * 0.01;

  // Smooth random movement
  const x = p.noise(t) * p.width;
  const y = p.noise(t + 100) * p.height;

  p.circle(x, y, 50);
};
```

### Particle Systems

```javascript
let particles = [];

p.setup = function () {
  // Initialize particles
  for (let i = 0; i < 100; i++) {
    particles.push({
      x: p.random(p.width),
      y: p.random(p.height),
      vx: p.random(-2, 2),
      vy: p.random(-2, 2),
    });
  }
};

p.draw = function () {
  p.background(0, 20); // Trail effect

  particles.forEach((particle) => {
    // Update
    particle.x += particle.vx;
    particle.y += particle.vy;

    // Wrap around
    if (particle.x < 0) particle.x = p.width;
    if (particle.x > p.width) particle.x = 0;
    if (particle.y < 0) particle.y = p.height;
    if (particle.y > p.height) particle.y = 0;

    // Draw
    p.fill(255);
    p.noStroke();
    p.circle(particle.x, particle.y, 5);
  });
};
```

---

## Recording Optimization

### Performance Tips

1. **Avoid heavy computations in draw()**

```javascript
// Bad - recalculates every frame
p.draw = function () {
  const expensiveValue = calculateExpensiveThing();
  p.text(expensiveValue, 100, 100);
};

// Good - calculate once in setup()
let expensiveValue;

p.setup = function () {
  expensiveValue = calculateExpensiveThing();
};

p.draw = function () {
  p.text(expensiveValue, 100, 100);
};
```

2. **Use appropriate framerate**

```javascript
// 30 fps is often sufficient
options.animation.framerate = 30;

// 60 fps for smooth animations
options.animation.framerate = 60;
```

3. **Optimize image operations**

```javascript
// Bad - loads every frame
p.draw = function () {
  const img = p.loadImage("image.jpg");
  p.image(img, 0, 0);
};

// Good - images are preloaded in assets
p.draw = function () {
  const img = assets.images["image.jpg"];
  p.image(img, 0, 0);
};
```

4. **Minimize state changes**

```javascript
// Bad - many state changes
p.draw = function () {
  for (let i = 0; i < 100; i++) {
    p.fill(i * 2, 0, 0);
    p.circle(i * 10, 100, 5);
  }
};

// Good - batch similar operations
p.draw = function () {
  p.noStroke();
  for (let i = 0; i < 100; i++) {
    p.fill(i * 2, 0, 0);
    p.circle(i * 10, 100, 5);
  }
};
```

### Memory Management

```javascript
// Clear arrays when done
p.setup = function () {
  let tempArray = [];
  // ... use array ...
  tempArray = null; // Help garbage collector
};

// Reuse objects instead of creating new ones
let particle = { x: 0, y: 0 };

p.draw = function () {
  // Reuse
  particle.x = p.random(p.width);
  particle.y = p.random(p.height);

  // Instead of creating new
  // let particle = { x: p.random(p.width), y: p.random(p.height) }
};
```

---

## Examples

### Example 1: Simple Text Animation

```javascript
function sketch(p, options, assets) {
  let canvas;

  p.setup = function () {
    canvas = p.createCanvas(options.size.width, options.size.height);
    canvas.id("defaultCanvas0");
    p.frameRate(options.animation.framerate);
  };

  p.draw = function () {
    p.background(246, 235, 225);

    // Calculate progress
    const totalFrames =
      options.animation.framerate * options.animation.duration;
    const progress = p.frameCount / totalFrames;

    // Animate text size
    const size = p.lerp(20, 100, progress);

    p.fill(0);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(size);
    p.text("Hello World!", p.p.width / 2, p.height / 2);
  };
}
```

### Example 2: Image with Rotation

```javascript
function sketch(p, options, assets) {
  let canvas;

  p.setup = function () {
    canvas = p.createCanvas(options.size.width, options.size.height);
    canvas.id("defaultCanvas0");
    p.frameRate(options.animation.framerate);
  };

  p.draw = function () {
    p.background(255);

    const img = assets.images["photo.jpg"];
    if (!img) return;

    p.push();
    p.translate(p.p.width / 2, p.height / 2);
    p.rotate(p.frameCount * 0.02);
    p.image(img, -img.width / 2, -img.height / 2);
    p.pop();
  };
}
```

### Example 3: Multi-Slide with Transitions

```javascript
function sketch(p, options, assets) {
  let canvas;
  let currentSlideIndex = 0;
  let framesPerSlide;
  let slideProgress = 0;

  p.setup = function () {
    canvas = p.createCanvas(options.size.width, options.size.height);
    canvas.id("defaultCanvas0");
    p.frameRate(options.animation.framerate);

    const totalFrames =
      options.animation.framerate * options.animation.duration;
    framesPerSlide = Math.floor(totalFrames / options.slides.length);
  };

  p.draw = function () {
    currentSlideIndex = Math.floor(p.frameCount / framesPerSlide);
    const slide = options.slides[currentSlideIndex];

    if (!slide) {
      p.noLoop();
      return;
    }

    const frameInSlide = p.frameCount % framesPerSlide;
    slideProgress = frameInSlide / framesPerSlide;

    // Render with fade
    renderSlideWithFade(slide);
  };

  function renderSlideWithFade(slide) {
    // Calculate alpha
    let alpha = 255;
    if (slideProgress < 0.1) {
      alpha = slideProgress * 10 * 255;
    } else if (slideProgress > 0.9) {
      alpha = (1 - slideProgress) * 10 * 255;
    }

    p.tint(255, alpha);

    // Render content
    slide.content.forEach((item) => {
      if (item.type === "background") {
        p.background(...item.background);
      } else if (item.type === "text") {
        p.fill(...item.fill);
        p.textSize(item.size);
        p.textAlign(p.CENTER, p.CENTER);
        p.text(item.content, p.p.width / 2, p.height / 2);
      }
    });

    p.noTint();
  }
}
```

### Example 4: Particle System

```javascript
function sketch(p, options, assets) {
  let canvas;
  let particles = [];

  p.setup = function () {
    canvas = p.createCanvas(options.size.width, options.size.height);
    canvas.id("defaultCanvas0");
    p.frameRate(options.animation.framerate);

    // Create particles
    for (let i = 0; i < 200; i++) {
      particles.push({
        x: p.random(p.width),
        y: p.random(p.height),
        vx: p.random(-2, 2),
        vy: p.random(-2, 2),
        size: p.random(3, 10),
      });
    }
  };

  p.draw = function () {
    p.background(0, 20);

    particles.forEach((particle) => {
      // Update
      particle.x += particle.vx;
      particle.y += particle.vy;

      // Bounce
      if (particle.x < 0 || particle.x > p.width) particle.vx *= -1;
      if (particle.y < 0 || particle.y > p.height) particle.vy *= -1;

      // Draw
      p.fill(255);
      p.noStroke();
      p.circle(particle.x, particle.y, particle.size);
    });
  };
}
```

---

## Tips and Tricks

1. **Use p5.js constants**: `p.CENTER`, `p.LEFT`, `p.RIGHT`, etc.
2. **Push/pop for isolated transforms**: Always use `p.push()` and `p.pop()`
3. **Normalize coordinates**: Use 0-1 range for positions
4. **Test at different sizes**: Your sketch should work at any resolution
5. **Keep it simple**: Complex sketches are harder to debug
6. **Comment your code**: Future you will thank you

Happy sketching! 🎨
