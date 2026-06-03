# 踩坑记录

## Service Worker 缓存死循环

**现象**：代码 push 到 GitHub Pages 后，页面始终显示旧版本，强制刷新、换设备、清除浏览器缓存均无效。

**根因**：旧版 Service Worker 使用 cache-first 策略，且把 `sw.js` 自身也纳入了缓存列表。浏览器检测到 sw.js 更新后尝试下载新版，但请求被旧 SW 拦截，直接从缓存返回旧 sw.js——永远拿不到新版，形成死循环。

**修复**（commit `221906a`）：

1. `sw.js` — fetch 策略从 cache-first 改为 **network-first**，优先从网络获取
2. `sw.js` — 升级 `CACHE_NAME` 确保旧缓存被清除
3. `index.html` — 添加内联脚本，页面加载时先注销所有已注册的 SW，再重新注册最新版

```html
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(regs) {
      regs.forEach(function(reg) { reg.unregister(); });
    }).then(function() {
      return navigator.serviceWorker.register('./sw.js');
    });
  }
</script>
```

**教训**：SW 的 fetch 监听器中不要对 `sw.js` 自身做 cache-first，否则更新会被自己锁死。

## IME 中文输入兼容

**现象**：搜索框输入中文时，每打一个拼音字母就触发 input 事件导致 DOM 重建，拼音还没选字输入框就被销毁。

**修复**：添加 `compositionstart` / `compositionend` 事件，拼音组合期间跳过 input 处理。

## 搜索覆盖不完整

**现象**：搜索"手雷"找不到结果。因为"手雷"是单位的 keywords 标签，不是能力的 name/summary。

**结论**：keywords 属于单位级别属性，应在「建军阶段」筛选单位时搜索，不应纳入主搜索的能力匹配范围。强行纳入会导致一个单位的所有能力都被搜出（噪音）。
