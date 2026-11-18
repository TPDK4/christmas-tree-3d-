# 🎄 Grand Luxury Interactive Christmas Tree

An immersive, high-fidelity 3D Christmas tree experience featuring hand gesture control, dynamic chaos-to-order assembly, and luxurious emerald and gold aesthetics.

## 📝 Prompt

Gemini 3 in Google AI Studio and Claude 4.5 Sonnet in Cursor:

```
角色设定： 你是一位精通 React 19、TypeScript 和 Three.js (R3F) 的 3D 创意开发专家。 任务目标： 构建一个名为“豪华互动圣诞树 (Grand Luxury Interactive Christmas Tree)”的高保真 3D Web 应用。视觉风格需呈现“特朗普式”的奢华感，主色调为深祖母绿和高光金色，并伴有电影级的辉光效果。 技术栈： React 19, TypeScript, React Three Fiber, Drei, Postprocessing, Tailwind CSS。
核心逻辑与架构： 状态机： 包含 CHAOS（混沌散落）和 FORMED（聚合成树）两种状态，并在两者间动态变形。 双坐标系统 (Dual-Position System)： 所有元素（针叶、装饰物）初始化时需分配两个坐标： ChaosPosition：球形空间内的随机坐标。 TargetPosition：构成树木圆锥形状的目标坐标。
TargetPosition：构成树木圆锥形状的目标坐标。 在 useFrame 中根据进度 在两者间进行插值 (Lerp)。具体实现细节： 针叶系统 (Foliage)： 使用 THREE.Points 和自定义 ShaderMaterial 渲染大量粒子。 装饰物 (Ornaments)： 使用 InstancedMesh 优化渲染。分为各种颜色的礼物盒（重）、各种颜色的彩球（轻）、各种点缀灯光（极轻），赋予不同的物理推力权重。使用 Lerp 实现丝滑的归位动画。 后期处理： 启用 Bloom 效果（阈值 0.8，强度 1.2），营造“金色光晕”。
场景配置： 摄像机位置 [0, 4, 20]，使用 Lobby HDRI 环境光。
在里面加上很多拍立得样式的照片的装饰。
使用摄像头图像检测手势，手势张开代表 unleash，闭上就变回圣诞树。通过手的移动可以调整视角。
```

## 🛠️ Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd grand-luxury-interactive-christmas-tree
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```
   
   > 📝 Note: Local dev mode uses localStorage for sharing (works in same browser only)
   > For full cloud sharing, see step 4

4. **Configure Cloudflare (Optional - for cloud sharing):**
   - Follow the detailed guide in `cloudflare-setup.md`
   - Copy `env.example` to `.env.local` and fill in your Cloudflare credentials
   - Use `npm run dev:vercel` to test with full Vercel environment

5. **Open your browser:**
   - Navigate to `http://localhost:3010`
   - Allow camera access for gesture control
   - Click "上传照片" to upload your photos


## 🎯 Usage

### Photo Upload & Sharing

1. **Upload Photos:**
   - Click "上传照片" button to select up to 5 images
   - Photos will appear as polaroids on the Christmas tree

2. **Generate Share Link:**
   - After uploading photos, click "生成分享链接"
   - Wait 2-3 seconds for the upload to complete
   - Copy the generated link and share with friends

3. **View Shared Photos:**
   - Friends can open the share link in any browser
   - Photos will automatically load on the Christmas tree
   - No login or app installation required
   - Links expire after 30 days

### Gesture Controls

1. **Position your hand** in front of the webcam (visible in top-right preview)
2. **Move your hand** to control the camera angle:
   - Left/Right: Horizontal rotation
   - Up/Down: Vertical tilt
3. **Open your hand** (spread all fingers): Unleash chaos mode
4. **Close your fist**: Restore tree to formed mode

### Mouse Controls

When no hand is detected, you can:
- **Click and drag** to rotate the view
- **Scroll** to zoom in/out
- **Right-click and drag** to pan (disabled by default)

## 🏗️ Tech Stack

### Frontend
- React 19 with TypeScript
- React Three Fiber (R3F) for 3D rendering
- Three.js for WebGL graphics
- @react-three/drei for helpers
- @react-three/postprocessing for visual effects
- MediaPipe for hand gesture detection
- Tailwind CSS for styling

### Backend (Photo Sharing)
- Vercel Serverless Functions
- Cloudflare R2 (S3-compatible object storage)
- Cloudflare KV (key-value storage)
- AWS SDK S3 Client for R2 integration

### Features
- Hand gesture control via webcam
- Dynamic state transitions (CHAOS ↔ FORMED)
- Photo upload and cloud sharing
- Temporary share links (30-day expiration)
- Instanced rendering for performance
- Bloom and post-processing effects

## 🎅 Happy Holidays!

May your code be merry and bright! 🎄✨
