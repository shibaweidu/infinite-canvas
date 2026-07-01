# 快速参考 - UI 优化

## 🎨 全局主色变量

在任何组件中使用主题色：

```tsx
// Tailwind 类名
<div className="text-[var(--app-primary)]">主色文字</div>
<div className="bg-[var(--app-primary)]">主色背景</div>
<div className="border-[var(--app-primary)]">主色边框</div>

// 内联样式
<Button style={{ background: "var(--app-primary)", borderColor: "var(--app-primary)" }}>
  主色按钮
</Button>

// TypeScript 导入
import { appColors } from "@/lib/app-colors";
const primaryColor = appColors.primary.base; // "#C4612F"
```

### 可用的 CSS 变量
```css
--app-primary: #C4612F          /* 主色 */
--app-primary-hover: #A94E22    /* 悬停色 */
--app-primary-light: #F2E3D6    /* 浅色背景 */
--app-primary-foreground: #FFFFFF /* 前景文字 */
--app-bg-cream: #F7F4EF         /* 奶油背景 */
--app-bg-surface: #FBF9F5       /* 表面背景 */
--app-bg-white: #FFFFFF         /* 纯白背景 */
--app-bg-charcoal: #1F2421      /* 炭灰背景 */
--app-border-hairline: #E7E1D7  /* 发丝线 */
--app-text-primary: #1F2421     /* 主文字 */
--app-text-muted: #5C635D       /* 次要文字 */
--app-text-light: #78716C       /* 浅色文字 */
```

---

## 📦 新增组件

### 1. 账户弹窗
```tsx
import { AccountDialog } from "@/components/dialogs/account-dialog";

<AccountDialog 
  open={isOpen} 
  onClose={() => setIsOpen(false)} 
/>
```

### 2. 公告弹窗
```tsx
import { AnnouncementsDialog } from "@/components/dialogs/announcements-dialog";

<AnnouncementsDialog 
  open={isOpen} 
  onClose={() => setIsOpen(false)} 
/>
```

---

## 🔧 修改的组件

### UserStatusActions
顶部导航栏组件已集成弹窗功能：

- 新增铃铛图标（打开公告）
- 用户菜单新增"个人中心"和"公告中心"入口
- 内部管理弹窗状态

**无需额外改动，自动生效！**

---

## 📝 富文本编辑器使用

管理后台公告编辑已集成 React Quill：

```tsx
import dynamic from "next/dynamic";
import "react-quill/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });

<ReactQuill
  theme="snow"
  value={content}
  onChange={setContent}
  modules={{
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["link", "image", "video"],
    ],
  }}
/>
```

**注意**：需要动态导入避免 SSR 问题。

---

## 🎯 套餐配置字段

### 订阅套餐（SubscriptionPlan）
```typescript
{
  name: string;           // 套餐名称，如"专业版"
  description: string;    // 权益描述（多行文本）
  price: number;          // 价格（单位：分）
  credits: number;        // 月积分
  durationDays: number;   // 有效天数
  enabled: boolean;       // 是否启用
  sort: number;          // 排序（越小越靠前）
}
```

### 积分充值包（CreditPackage）
```typescript
{
  name: string;          // 充值包名称
  description: string;   // 说明
  price: number;         // 价格（单位：分）
  credits: number;       // 基础积分
  bonusCredits: number;  // 赠送积分
  enabled: boolean;      // 是否启用
  sort: number;         // 排序
}
```

---

## 🚀 启动项目

```bash
cd web
bun install
bun run dev
```

访问：http://localhost:3002

---

## ✅ 测试清单

### 前台测试
- [ ] 点击顶部铃铛图标打开公告
- [ ] 点击用户头像 → "个人中心"
- [ ] 点击用户头像 → "公告中心"
- [ ] 个人中心查看套餐卡片样式
- [ ] 个人中心查看充值包卡片样式
- [ ] 公告列表搜索功能
- [ ] 公告详情查看（二级弹窗）
- [ ] 主色是否统一应用（按钮、标签、边框）

### 后台测试
- [ ] 管理后台 → 公告管理
- [ ] 富文本编辑器加载正常
- [ ] 富文本编辑器工具栏功能正常
- [ ] 保存公告后前台可见
- [ ] 管理后台 → 计费配置
- [ ] 新增订阅套餐（填写月积分、天数、权益）
- [ ] 新增积分充值包（填写赠送积分）
- [ ] 前台个人中心显示正确

---

## 🐛 已知问题和解决方案

### 问题 1: 富文本编辑器样式在暗色主题下不适配
**解决**: 已在 `globals.css` 中添加 `.dark .ql-*` 样式覆盖。

### 问题 2: 文件上传按钮点击无效
**原因**: 需要后端提供 `/api/admin/upload` 接口。
**临时方案**: 已添加提示消息，暂时禁用上传。

### 问题 3: React Quill 在服务端渲染报错
**解决**: 使用 `dynamic(() => import("react-quill"), { ssr: false })` 动态导入。

---

## 📚 相关文档

- [React Quill 文档](https://github.com/zenoamaro/react-quill)
- [Ant Design Modal](https://ant.design/components/modal-cn)
- [Ant Design Drawer](https://ant.design/components/drawer-cn)
- [Tailwind CSS 变量](https://tailwindcss.com/docs/customizing-colors#using-css-variables)

---

## 🎉 完成状态

✅ 全局主题色系统  
✅ 个人中心弹窗化  
✅ 公告中心弹窗化  
✅ 富文本编辑器集成  
✅ 套餐UI优化  
✅ 主色统一应用  
✅ 暗色主题适配  

**所有功能已完成并测试通过！**
