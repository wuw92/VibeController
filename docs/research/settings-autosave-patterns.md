# 桌面应用设置的即时生效与自动保存

核对日期：2026-11-08。结论来自官方文档和第一方源码；不推测 Codex 的内部实现。

## 结论

常见设计是**修改控件即生效，无须点击保存；持久化、合并写入和异常处理属于底层机制**。常规界面无需持续显示“正在保存／已保存”。只有确实发生错误时才通知用户；这与“没有保存失败处理”是两回事。

| 来源 | 已核实的设计 |
| --- | --- |
| [VS Code 官方设置文档](https://code.visualstudio.com/docs/configure/settings) | 明确说明 “VS Code applies changes to settings directly as you change them.”；通过侧边颜色条标记与默认值不同的设置。相同页面专门解释 “Unable to write settings” 异常，例如设置 JSON 格式损坏。 |
| [VS Code 设置编辑器源码](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts) | `onDidChangeSetting` 自动进入 `updateChangedSetting`，没有保存按钮步骤；通过两个 `Delayer` 合并连续修改，当前快／慢延迟为 200／1000 毫秒。更新成功的路径重绘设置、清除待更新记录和上报遥测，没有每次成功都弹“已保存”的通知；源码注释明确失败由 ConfigurationService 展示错误。 |
| [VS Code 配置写入源码](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/services/configuration/common/configurationEditing.ts) | 写入进入队列以避免竞争；错误会走专门的 `onError`，一般错误调用 `notificationService.error`，配置格式错误提供打开设置文件的操作。它仍然处理写入失败，但不把正常操作变成用户需要管理的保存流程。 |
| [Firefox 偏好设置 UI 源码](https://github.com/mozilla/gecko-dev/blob/master/browser/components/preferences/preferences.js) | 初始化调用 `Preferences.forceEnableInstantApply()`，采用即时应用偏好设置的模型。 |
| [Mozilla 偏好设置技术文档](https://firefox-source-docs.mozilla.org/modules/libpref/index.html) | 偏好修改后等待 500 毫秒，自动在主线程之外保存 `prefs.js`；没有修改时不写入。文档也指出异常崩溃可能使最近修改未落盘，说明“即时生效”和“写入磁盘”并非同一个步骤。 |
| [Microsoft Toggle Switch 设计文档](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/toggles) | Toggle 适用于操作后立刻产生结果的二元设置；若还必须点击 Submit／Next 才应用，应使用 Checkbox。控件外观应表达真实生效方式。 |

## 对 VibeController 的建议

1. 移除映射页和设置页的保存按钮，正常修改不显示常驻“正在保存／已保存”文案；必要时只用一句静态说明“修改自动生效”。
2. 开关、选项选择和完整快捷键的修改直接应用；滑块拖动或连续录入由内部短暂合并写入，不要求用户停止操作等待确认。
3. 保存只提交最近的有效值，并在底层串行处理，避免较早结果覆盖后续选择。不能为了静默体验删掉持久化或异常处理。
4. 只有真实写入失败时显示简短异常通知。若运行时已生效但无法持久化，应准确提示重启后可能丢失；不必把正常流程改成等待磁盘确认。
5. 二元即时设置可采用 Toggle Switch 的视觉表达。自动保存不改变已有灯条、Hook、Agent 映射等功能本身。

## 验证边界

VS Code 和 Firefox 的具体时间属于所读取源码／文档的当前实现，不应当成为本项目的固定设计要求。上述源码检查覆盖设置更新路径，不能据此宣称整款应用从不出现其他保存状态提示。Firefox 用户支持页本次返回客户端挑战页，未作为证据；这里使用其第一方源码和技术文档。
